import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  FiArrowLeft,
  FiImage,
  FiMinus,
  FiPlus,
  FiPrinter,
  FiSave,
  FiShoppingBag,
  FiTrash2,
} from "react-icons/fi";
import AppSidebarLayout from "../components/AppSidebarLayout";
import {
  getRolePermissions,
  getStoredUser,
  isLineOwnedByUser,
} from "../lib/accessControl";
import { API, apiUrl } from "../lib/api";
import {
  clearSaleDraft,
  readSaleDraft,
  writeSaleDraft,
} from "../lib/saleDrafts";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function getProductDisplayPosition(product) {
  const parsedValue = Number(product?.display_position);
  return Number.isFinite(parsedValue) && parsedValue >= 1 ? parsedValue : 9999;
}

function sortProductsForDisplay(items) {
  return [...(items || [])].sort((leftItem, rightItem) => {
    const categoryComparison = String(leftItem.category_name || "").localeCompare(
      String(rightItem.category_name || ""),
    );

    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    const positionComparison =
      getProductDisplayPosition(leftItem) - getProductDisplayPosition(rightItem);

    if (positionComparison !== 0) {
      return positionComparison;
    }

    return String(leftItem.name || "").localeCompare(String(rightItem.name || ""));
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatThermalDateTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());

  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatThermalOrderNumber(value) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return String(Math.trunc(numericValue)).padStart(5, "0");
  }

  return String(value || "-").trim() || "-";
}

function getRequestErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.trim();
  }

  if (responseData?.error) {
    return String(responseData.error);
  }

  if (responseData?.detail) {
    return String(responseData.detail);
  }

  if (error?.message) {
    return String(error.message);
  }

  return fallbackMessage;
}

function buildCartKey(item) {
  const ownerSegment = item.created_by_user_id
    ? `-owner-${item.created_by_user_id}`
    : item.created_by_username
      ? `-owner-${String(item.created_by_username).trim().toLowerCase()}`
      : "";

  if (item.id) {
    return `line-${item.id}`;
  }

  if (item.product_id) {
    return `product-${item.product_id}${ownerSegment}`;
  }

  return `name-${item.item_name || item.name}${ownerSegment}`;
}

function requiresKitchenToken(item) {
  return Boolean(String(item?.printer_target || "").trim());
}

function mapProductToCartItem(product, currentUser) {
  const requiresToken = requiresKitchenToken(product);

  return {
    cartKey: buildCartKey({
      product_id: product.id,
      item_name: product.name,
      created_by_user_id: currentUser?.id ?? null,
      created_by_username: currentUser?.username || null,
    }),
    product_id: product.id,
    name: product.name,
    sale_price: Number(product.sale_price || 0),
    qty: 1,
    tax_mode: product.tax_mode || "NO_TAX",
    printer_name: product.printer_name || null,
    printer_target: product.printer_target || null,
    sale_item_id: null,
    kot_printed_qty: 0,
    pending_qty: requiresToken ? 1 : 0,
    created_by_user_id: currentUser?.id ?? null,
    created_by_username: currentUser?.username || null,
  };
}

function mapSaleItemToCartItem(item) {
  const requiresToken = requiresKitchenToken(item);
  const qty = Number(item.qty || 0);
  const kotPrintedQty = Number(item.kot_printed_qty || 0);

  return {
    cartKey: buildCartKey(item),
    sale_item_id: item.id || null,
    product_id: item.product_id || null,
    name: item.item_name,
    sale_price: Number(item.unit_price || 0),
    qty,
    tax_mode: item.tax_mode || "NO_TAX",
    printer_name: item.printer_name || null,
    printer_target: item.printer_target || null,
    kot_printed_qty: kotPrintedQty,
    pending_qty:
      item.pending_qty != null
        ? Number(item.pending_qty || 0)
        : requiresToken
          ? Math.max(qty - kotPrintedQty, 0)
          : 0,
    created_by_user_id: item.created_by_user_id ?? null,
    created_by_username: item.created_by_username || null,
  };
}

function openPrintWindow(title, bodyHtml) {
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("Allow popups to print token");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm 3mm; }
          body {
            width: 72mm;
            margin: 0 auto;
            font-family: "Courier New", Courier, monospace;
            font-size: 12px;
            line-height: 1.3;
            color: #111111;
            background: #ffffff;
          }
          .ticket, .ticket * { font-weight: 700; }
          .ticket + .ticket {
            margin-top: 14px;
            padding-top: 10px;
            border-top: 1px dashed #111111;
          }
          .token-table-name {
            text-align: center;
            font-size: 24px;
            text-transform: uppercase;
            margin: 4px 0 10px;
            letter-spacing: 0.03em;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 2px 0;
          }
          .divider {
            margin: 8px 0;
            border-top: 1px dashed #111111;
          }
          .token-line-head,
          .token-line {
            display: grid;
            grid-template-columns: 16mm minmax(0, 1fr);
            column-gap: 4px;
            align-items: start;
          }
          .token-line-head {
            text-transform: uppercase;
          }
          .token-line {
            padding: 3px 0;
            font-size: 14px;
            text-transform: uppercase;
          }
          .token-name {
            word-break: break-word;
          }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

function buildTokenTicketHtml({
  tableLabel,
  orderNumber,
  updatedAt,
  senderLabel,
  items,
}) {
  return `
    <section class="ticket">
      <div class="token-table-name">${escapeHtml(tableLabel)}</div>
      <div class="meta-row"><span>Order No:</span><span>${escapeHtml(
        orderNumber,
      )}</span></div>
      <div class="meta-row"><span>Date:</span><span>${escapeHtml(
        formatThermalDateTime(updatedAt),
      )}</span></div>
      <div class="meta-row"><span>Sender:</span><span>${escapeHtml(
        senderLabel,
      )}</span></div>
      <div class="divider"></div>
      <div class="token-line-head">
        <div>QTY</div>
        <div>ITEM</div>
      </div>
      <div class="divider"></div>
      ${items
        .map(
          (item) => `
            <div class="token-line">
              <div>${escapeHtml(item.qty)}X</div>
              <div class="token-name">${escapeHtml(item.item_name)}</div>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

export default function WaiterOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tableId } = useParams();
  const currentUser = getStoredUser();
  const role = currentUser.role;
  const permissions = getRolePermissions(role);
  const [tableInfo, setTableInfo] = useState(location.state?.table || null);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [cart, setCart] = useState([]);
  const [saleMeta, setSaleMeta] = useState({
    id: null,
    order_number: null,
    updated_at: null,
    created_at: null,
    status: "VACANT",
    pending_units: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("idle");
  const currentOrderRef = useRef(null);
  const liveSyncActionRef = useRef(() => {});
  const hasLoadedSaleRef = useRef(false);
  const skipAutosaveRef = useRef(false);
  const lastSavedSignatureRef = useRef("");

  const buildPayloadFromValues = (items) => ({
    items: items.map((item) => ({
      sale_item_id: item.sale_item_id || null,
      product_id: item.product_id,
      item_name: item.name,
      unit_price: Number(item.sale_price || 0),
      qty: item.qty,
      tax_mode: item.tax_mode || "NO_TAX",
      printer_name: item.printer_name || null,
      printer_target: item.printer_target || null,
      created_by_user_id: item.created_by_user_id ?? null,
      created_by_username: item.created_by_username || null,
    })),
    customer_paid: null,
  });

  const buildPayloadSignature = (items) =>
    JSON.stringify(buildPayloadFromValues(items));

  const buildSaleDataFromDraft = (draft) => {
    const items = Array.isArray(draft?.items)
      ? draft.items.map((item) => ({
          id: null,
          product_id: item.product_id ?? null,
          item_name: item.item_name,
          unit_price: Number(item.unit_price || 0),
          qty: Number(item.qty || 0),
          tax_mode: item.tax_mode || "NO_TAX",
          printer_name: item.printer_name || null,
          printer_target: item.printer_target || null,
          line_total: Number(item.unit_price || 0) * Number(item.qty || 0),
          kot_printed_qty: 0,
          pending_qty: requiresKitchenToken(item) ? Number(item.qty || 0) : 0,
          created_by_user_id: item.created_by_user_id ?? null,
          created_by_username: item.created_by_username || null,
        }))
      : [];
    const units = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const total = items.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );

    return {
      id: null,
      order_number: draft?.order_number || null,
      table_id: Number(tableId),
      table_name: draft?.table_name || null,
      floor_name: draft?.floor_name || null,
      customer_paid: null,
      lines: items.length,
      units,
      pending_units: items.reduce(
        (sum, item) => sum + Number(item.pending_qty || 0),
        0,
      ),
      status: items.length > 0 ? "OCCUPIED" : "VACANT",
      subtotal: total,
      total,
      balance: null,
      items,
      created_at: draft?.updated_at || null,
      updated_at: draft?.updated_at || null,
    };
  };

  const writeLocalDraft = (items, tableContext, options = {}) => {
    const payload = buildPayloadFromValues(items);
    const hasDraft = payload.items.length > 0;

    if (!hasDraft) {
      clearSaleDraft(tableId);
      return;
    }

    writeSaleDraft(tableId, {
      ...payload,
      order_number: options.orderNumber ?? saleMeta.order_number ?? null,
      table_name: tableContext?.name || `Table ${tableId}`,
      floor_name: tableContext?.floor || null,
      updated_at: options.updatedAt || new Date().toISOString(),
      server_updated_at: options.serverUpdatedAt ?? saleMeta.updated_at ?? null,
      pending_sync: Boolean(options.pendingSync),
      payload_signature: buildPayloadSignature(items),
    });
  };

  const applySaleMeta = (saleData) => {
    setSaleMeta({
      id: saleData.id || null,
      order_number: saleData.order_number || null,
      updated_at: saleData.updated_at || null,
      created_at: saleData.created_at || null,
      status: saleData.status || "VACANT",
      pending_units: Number(saleData.pending_units || 0),
    });

    if (saleData.table_name || saleData.floor_name) {
      setTableInfo((currentValue) => ({
        id: currentValue?.id || Number(tableId),
        name: currentValue?.name || saleData.table_name || `Table ${tableId}`,
        floor: currentValue?.floor || saleData.floor_name || null,
        floor_id: currentValue?.floor_id || location.state?.selectedFloorId || null,
      }));
    }
  };

  const applySaleData = (saleData) => {
    const savedItems = (saleData.items || []).map(mapSaleItemToCartItem);
    skipAutosaveRef.current = true;
    hasLoadedSaleRef.current = true;
    lastSavedSignatureRef.current = buildPayloadSignature(savedItems);
    startTransition(() => {
      setCart(savedItems);
      applySaleMeta(saleData);
    });
    writeLocalDraft(
      savedItems,
      {
        id: Number(tableId),
        name:
          saleData.table_name ||
          currentTableRecord?.name ||
          location.state?.table?.name ||
          tableInfo?.name ||
          `Table ${tableId}`,
        floor:
          saleData.floor_name ||
          currentTableRecord?.floor ||
          location.state?.table?.floor ||
          tableInfo?.floor ||
          null,
      },
      {
        orderNumber: saleData.order_number || null,
        updatedAt: saleData.updated_at || saleData.created_at || new Date().toISOString(),
        serverUpdatedAt: saleData.updated_at || saleData.created_at || null,
        pendingSync: false,
      },
    );
  };

  const refreshOrderSale = async (options = {}) => {
    const { silent = false, fallbackToLocal = true } = options;
    const localDraft = readSaleDraft(tableId);

    try {
      const saleResponse = await axios.get(`${API}/sales/table/${tableId}`);
      const remoteUpdatedAt = Date.parse(saleResponse.data.updated_at || 0);
      const localUpdatedAt = Date.parse(localDraft?.updated_at || 0);
      const shouldUseLocalDraft =
        Boolean(localDraft?.pending_sync) && localUpdatedAt > remoteUpdatedAt;

      applySaleData(
        shouldUseLocalDraft
          ? buildSaleDataFromDraft(localDraft)
          : saleResponse.data,
      );
      return saleResponse.data;
    } catch (error) {
      console.warn("Saved sale endpoint unavailable", error);

      if (fallbackToLocal && localDraft) {
        applySaleData(buildSaleDataFromDraft(localDraft));
        return buildSaleDataFromDraft(localDraft);
      }

      if (!silent) {
        alert(getRequestErrorMessage(error, "Failed to load waiter order"));
      }

      return null;
    }
  };

  const loadOrderData = async () => {
    try {
      setLoading(true);
      hasLoadedSaleRef.current = false;

      const [productsResponse, tablesResponse] = await Promise.all([
        axios.get(`${API}/stock/products`),
        axios.get(`${API}/tables`),
      ]);

      const matchedTable =
        (tablesResponse.data || []).find(
          (table) => String(table.id) === String(tableId),
        ) || null;
      startTransition(() => {
        // Products already come back ordered from the backend.
        setProducts(productsResponse.data || []);
        setTables(tablesResponse.data || []);

        if (matchedTable) {
          setTableInfo(matchedTable);
        }
      });

      const refreshedSale = await refreshOrderSale({
        silent: true,
        fallbackToLocal: true,
      });

      if (!refreshedSale && !readSaleDraft(tableId)) {
        applySaleData({
          id: null,
          order_number: null,
          items: [],
          customer_paid: null,
          updated_at: null,
          created_at: null,
        });
      }
    } catch (error) {
      console.error(error);
      alert("Failed to load waiter order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderData();
  }, [tableId]);

  const deferredSearch = useDeferredValue(search);
  const normalizedProductSearch = deferredSearch.trim().toLowerCase();
  const categories = [
    "ALL",
    ...new Set(products.map((product) => product.category_name).filter(Boolean)),
  ];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      normalizedProductSearch.length === 0 ||
      product.name.toLowerCase().includes(normalizedProductSearch);
    const matchesCategory =
      categoryFilter === "ALL" || product.category_name === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const productCartQtyById = cart.reduce((accumulator, item) => {
    if (!item.product_id) {
      return accumulator;
    }

    accumulator[item.product_id] =
      (accumulator[item.product_id] || 0) + Number(item.qty || 0);
    return accumulator;
  }, {});

  const scrollToCurrentOrder = () => {
    currentOrderRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const currentTableRecord =
    tables.find((table) => String(table.id) === String(tableId)) || tableInfo;
  const currentTableName = tableInfo?.name || `Table ${tableId}`;
  const localPendingUnits = cart.reduce(
    (sum, item) => sum + Number(item.pending_qty || 0),
    0,
  );
  const totalUnits = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.sale_price || 0) * item.qty,
    0,
  );

  const canManageCartItem = (item) => {
    if (!item || !permissions.addItems) {
      return false;
    }

    return isLineOwnedByUser(item, currentUser);
  };
  const getPrintedTokenQty = (item) => Number(item?.kot_printed_qty || 0);
  const hasPrintedTokenLock = (item) => getPrintedTokenQty(item) > 0;
  const getPrintedTokenLockMessage = (item) =>
    `${item?.name || "This item"} already sent to token. You can add more quantity, but you cannot reduce or delete the printed quantity. Finalize the bill instead.`;

  const addToCart = (product) => {
    if (!permissions.addItems) {
      alert("You do not have permission to add items");
      return;
    }

    const nextItem = mapProductToCartItem(product, currentUser);

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.cartKey === nextItem.cartKey,
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.cartKey === nextItem.cartKey
            ? {
                ...item,
                qty: item.qty + 1,
                pending_qty: requiresKitchenToken(item)
                  ? Math.max(
                      item.qty + 1 - Number(item.kot_printed_qty || 0),
                      0,
                    )
                  : 0,
              }
            : item,
        );
      }

      return [...currentCart, nextItem];
    });
  };

  const setCartItemQuantity = (itemKey, qty) => {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.cartKey !== itemKey) {
          return [item];
        }

        const printedQty = Number(item.kot_printed_qty || 0);
        const nextQty = Math.max(Number(qty || 0), printedQty);

        if (nextQty <= 0) {
          return [];
        }

        return [
          {
            ...item,
            qty: nextQty,
            kot_printed_qty: Math.min(printedQty, nextQty),
            pending_qty: requiresKitchenToken(item)
              ? Math.max(nextQty - Math.min(printedQty, nextQty), 0)
              : 0,
          },
        ];
      }),
    );
  };

  const updateQty = (itemKey, change) => {
    const currentItem = cart.find((item) => item.cartKey === itemKey);

    if (!currentItem) {
      return;
    }

    if (!canManageCartItem(currentItem)) {
      alert("Waiter can edit only own line items");
      return;
    }

    if (change < 0 && Number(currentItem.qty || 0) <= getPrintedTokenQty(currentItem)) {
      alert(getPrintedTokenLockMessage(currentItem));
      return;
    }

    setCartItemQuantity(itemKey, currentItem.qty + change);
  };

  const removeLine = (item) => {
    if (!canManageCartItem(item)) {
      alert("Waiter can delete only own line items");
      return;
    }

    if (hasPrintedTokenLock(item)) {
      alert(getPrintedTokenLockMessage(item));
      return;
    }

    setCart((currentCart) =>
      currentCart.filter((cartItem) => cartItem.cartKey !== item.cartKey),
    );
  };

  useEffect(() => {
    if (!hasLoadedSaleRef.current) {
      return;
    }

    if (skipAutosaveRef.current) {
      return;
    }

    writeLocalDraft(
      cart,
      currentTableRecord || location.state?.table || tableInfo,
      {
        pendingSync: true,
      },
    );
  }, [
    cart,
    tableId,
    currentTableRecord?.id,
    currentTableRecord?.name,
    currentTableRecord?.floor,
    tableInfo?.name,
    tableInfo?.floor,
    saleMeta.order_number,
  ]);

  const hasPendingLocalChanges = () =>
    hasLoadedSaleRef.current &&
    buildPayloadSignature(cart) !== lastSavedSignatureRef.current;

  liveSyncActionRef.current = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    if (busyAction || hasPendingLocalChanges()) {
      return;
    }

    refreshOrderSale({ silent: true, fallbackToLocal: false });
  };

  const persistSale = async (actionLabel, options = {}) => {
    const payload = buildPayloadFromValues(cart);
    const payloadSignature = JSON.stringify(payload);

    try {
      setBusyAction(actionLabel);
      const response = await axios.post(`${API}/sales/table/${tableId}`, payload);

      if (response.data.error) {
        alert(response.data.error);
        return null;
      }

      if (response.data.message === "Sale cleared") {
        lastSavedSignatureRef.current = payloadSignature;
        setAutosaveStatus("saved");
        clearSaleDraft(tableId);
        applySaleData({
          id: null,
          order_number: null,
          items: [],
          customer_paid: null,
          updated_at: null,
          created_at: null,
          status: "VACANT",
          pending_units: 0,
        });
        return response.data;
      }

      lastSavedSignatureRef.current = payloadSignature;
      setAutosaveStatus("saved");
      applySaleData(response.data);
      return response.data;
    } catch (error) {
      console.error(error);
      setAutosaveStatus("error");
      writeLocalDraft(
        cart,
        currentTableRecord || location.state?.table || tableInfo,
        {
          pendingSync: true,
        },
      );

      if (options.allowLocalFallback) {
        return {
          ...buildSaleDataFromDraft({
            ...payload,
            order_number: saleMeta.order_number || null,
            table_name: currentTableRecord?.name || tableInfo?.name || null,
            floor_name: currentTableRecord?.floor || tableInfo?.floor || null,
            updated_at: new Date().toISOString(),
          }),
          local_only: true,
        };
      }

      if (!options.suppressErrorAlert) {
        alert(getRequestErrorMessage(error, "Failed to save order"));
      }

      return null;
    } finally {
      setBusyAction("");
    }
  };

  useEffect(() => {
    if (!hasLoadedSaleRef.current || loading || busyAction) {
      return undefined;
    }

    const payloadSignature = buildPayloadSignature(cart);

    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      lastSavedSignatureRef.current = payloadSignature;
      return undefined;
    }

    if (payloadSignature === lastSavedSignatureRef.current) {
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setAutosaveStatus("saving");
        const response = await axios.post(
          `${API}/sales/table/${tableId}`,
          buildPayloadFromValues(cart),
        );

        if (response.data.error) {
          setAutosaveStatus("error");
          return;
        }

        lastSavedSignatureRef.current = payloadSignature;
        applySaleMeta(response.data);
        writeLocalDraft(
          cart,
          currentTableRecord || location.state?.table || tableInfo,
          {
            orderNumber: response.data.order_number || saleMeta.order_number || null,
            updatedAt: response.data.updated_at || new Date().toISOString(),
            serverUpdatedAt: response.data.updated_at || null,
            pendingSync: false,
          },
        );
        setAutosaveStatus("saved");
      } catch (error) {
        console.error(error);
        setAutosaveStatus("error");
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [cart, loading, busyAction, tableId]);

  useEffect(() => {
    if (autosaveStatus !== "saved") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setAutosaveStatus("idle");
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [autosaveStatus]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const syncOrderFromServer = () => liveSyncActionRef.current();

    const intervalId = window.setInterval(syncOrderFromServer, 4000);
    window.addEventListener("focus", syncOrderFromServer);
    document.addEventListener("visibilitychange", syncOrderFromServer);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncOrderFromServer);
      document.removeEventListener("visibilitychange", syncOrderFromServer);
    };
  }, [loading, tableId]);

  useEffect(() => {
    if (loading || typeof window === "undefined") {
      return undefined;
    }

    const eventSource = new EventSource(
      apiUrl(`/sales/table/${tableId}/events`),
    );

    eventSource.onmessage = () => {
      liveSyncActionRef.current();
    };

    return () => {
      eventSource.close();
    };
  }, [loading, tableId]);

  const buildFloorViewState = () => ({
    selectedFloorId: location.state?.selectedFloorId
      ? String(location.state.selectedFloorId)
      : currentTableRecord?.floor_id
        ? String(currentTableRecord.floor_id)
        : undefined,
    selectedTableId: String(tableId),
  });

  const saveAndReturn = async () => {
    const result = await persistSale("save-order", {
      allowLocalFallback: true,
      suppressErrorAlert: true,
    });

    if (!result) {
      alert("Failed to save order");
      return;
    }

    navigate("/waiter", { state: buildFloorViewState() });
  };

  const printKitchenOrderTicket = async (manual = true) => {
    if (!permissions.printKitchenTicket) {
      alert("You do not have permission to print token");
      return;
    }

    if (cart.length === 0) {
      if (manual) {
        alert("Add items before printing token");
      }
      return;
    }

    const savedSale = await persistSale("kitchen", { showMessage: false });

    if (!savedSale || savedSale.error) {
      return;
    }

    try {
      const senderLabel = String(
        currentUser?.username || currentUser?.role || "STAFF",
      )
        .trim()
        .toUpperCase();
      const response = await axios.post(
        `${API}/sales/table/${tableId}/kot`,
        null,
        {
          params: {
            sender_name: senderLabel,
          },
        },
      );

      if (response.data.error) {
        if (manual) {
          alert(response.data.error);
        }
        return;
      }

      setCart((currentCart) =>
        currentCart.map((item) =>
          requiresKitchenToken(item)
            ? {
                ...item,
                kot_printed_qty: item.qty,
                pending_qty: 0,
              }
            : item,
        ),
      );
      setSaleMeta((currentValue) => ({
        ...currentValue,
        updated_at: response.data.updated_at || currentValue.updated_at,
        status: response.data.status || "OCCUPIED",
        pending_units: 0,
      }));

      if (response.data.system_printed) {
        return;
      }

      const printerGroups =
        Array.isArray(response.data.printer_groups) &&
        response.data.printer_groups.length > 0
          ? response.data.printer_groups
          : [
              {
                items: response.data.items || [],
              },
            ];
      const tableLabel = currentTableName;
      const orderNumber = formatThermalOrderNumber(
        response.data.order_number || saleMeta.order_number || response.data.bill_number,
      );
      const bodyHtml = printerGroups
        .map((group) =>
          buildTokenTicketHtml({
            tableLabel,
            orderNumber,
            updatedAt: response.data.updated_at || new Date(),
            senderLabel,
            items: group.items || [],
          }),
        )
        .join("");

      openPrintWindow("Kitchen Order Ticket", bodyHtml);
    } catch (error) {
      console.error(error);
      if (manual) {
        alert(getRequestErrorMessage(error, "Failed to print token"));
      }
    }
  };

  return (
    <AppSidebarLayout role={role} currentPage="waiter-order" onRefresh={loadOrderData}>
      <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#eef6ff_100%)] p-5 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.65)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Waiter Order
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {currentTableName}
            </h1>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>{tableInfo?.floor ? `Floor ${tableInfo.floor}` : "No Floor"}</span>
              <span>Order No: {saleMeta.order_number || "New"}</span>
              <span>
                Auto Save:{" "}
                {autosaveStatus === "saving"
                  ? "Saving..."
                  : autosaveStatus === "saved"
                    ? "Saved"
                    : autosaveStatus === "error"
                      ? "Error"
                      : "Ready"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/waiter", { state: buildFloorViewState() })}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <FiArrowLeft className="h-4 w-4" />
              Tables
            </button>
            <button
              type="button"
              onClick={saveAndReturn}
              disabled={busyAction !== ""}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FiSave className="h-4 w-4" />
              Save
            </button>
            <button
              type="button"
              onClick={() => printKitchenOrderTicket(true)}
              disabled={busyAction !== ""}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FiPrinter className="h-4 w-4" />
              Token Print
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 pb-24 xl:grid-cols-[360px_minmax(0,1fr)] xl:pb-0">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Lines
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {cart.length}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Units
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {totalUnits}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Pending
                </div>
                <div className="mt-2 text-2xl font-bold">{localPendingUnits}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 py-5 text-center text-3xl font-bold text-white shadow-[0_20px_35px_-24px_rgba(2,132,199,0.85)]">
              {formatMoney(subtotal)}
            </div>
          </div>

          <div
            ref={currentOrderRef}
            className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Current Order
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Waiter can edit only own line items
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {cart.length > 0 ? (
                cart.map((item) => {
                  const canManage = canManageCartItem(item);
                  const canDecrease =
                    canManage &&
                    Number(item.qty || 0) > getPrintedTokenQty(item);
                  const canRemove = canManage && !hasPrintedTokenLock(item);

                  return (
                    <div
                      key={item.cartKey}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">
                            {item.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {formatMoney(item.sale_price)} each
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {item.created_by_username && (
                              <span>By {item.created_by_username}</span>
                            )}
                            {hasPrintedTokenLock(item) && (
                              <span className="text-sky-700">
                                Printed {getPrintedTokenQty(item)}
                              </span>
                            )}
                            {requiresKitchenToken(item) && item.pending_qty > 0 && (
                              <span className="text-amber-600">
                                Pending {item.pending_qty}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-slate-900">
                            {formatMoney(item.sale_price * item.qty)}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            Qty {item.qty}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
                          <button
                            type="button"
                            onClick={() => updateQty(item.cartKey, -1)}
                            disabled={!canDecrease}
                            className="rounded-full p-2 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            <FiMinus className="h-4 w-4" />
                          </button>
                          <div className="min-w-[42px] text-center text-sm font-semibold text-slate-900">
                            {item.qty}
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQty(item.cartKey, 1)}
                            disabled={!canManage}
                            className="rounded-full p-2 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            <FiPlus className="h-4 w-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeLine(item)}
                          disabled={!canRemove}
                          className="inline-flex items-center gap-2 rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
                        >
                          <FiTrash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>

                      {hasPrintedTokenLock(item) && (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                          Printed token quantity is locked. You can add more, but
                          you cannot reduce or delete the printed quantity.
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Add items below to start this table order.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Items</div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 sm:max-w-xs"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    categoryFilter === category
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {category === "ALL" ? "All Items" : category}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Loading items...
                </div>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const inCartQty = productCartQtyById[product.id] || 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50"
                    >
                      <div className="flex gap-3">
                        {product.image_url ? (
                          <img
                            src={`${API}${product.image_url}`}
                            alt={product.name}
                            className="h-14 w-14 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                            <FiImage className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {product.name}
                            </div>
                            {inCartQty > 0 && (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                In Cart {inCartQty}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate text-[11px] text-slate-500">
                            {product.category_name}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-lg font-bold text-slate-900">
                              {formatMoney(product.sale_price)}
                            </div>
                            <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                              Add
                            </div>
                          </div>
                          <div className="mt-1 truncate text-[11px] text-slate-400">
                            {product.printer_name || "No Token Printer"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  No items found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <button
          type="button"
          onClick={scrollToCurrentOrder}
          className="fixed bottom-4 left-4 right-4 z-40 flex items-center gap-3 rounded-full bg-gradient-to-r from-slate-900 via-sky-900 to-cyan-700 px-5 py-3 text-white shadow-[0_24px_45px_-24px_rgba(15,23,42,0.85)] sm:left-auto sm:right-4 sm:w-auto sm:min-w-[240px]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <FiShoppingBag className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-bold">
              {totalUnits} item{totalUnits === 1 ? "" : "s"} added
            </span>
            <span className="block text-xs text-slate-200">
              View cart • {formatMoney(subtotal)}
            </span>
          </span>
        </button>
      )}
    </AppSidebarLayout>
  );
}
