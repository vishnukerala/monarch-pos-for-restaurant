import { useEffect, useState } from "react";
import axios from "axios";
import {
  FiCreditCard,
  FiDollarSign,
  FiImage,
  FiMinus,
  FiPlus,
  FiPrinter,
  FiSmartphone,
  FiTrash2,
} from "react-icons/fi";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getRolePermissions, getStoredUser } from "../lib/accessControl";
import { API } from "../lib/api";

function getTodayDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function getErrorMessage(error, fallbackMessage) {
  const responseError = error?.response?.data?.error;

  if (typeof responseError === "string" && responseError.trim()) {
    return responseError;
  }

  if (typeof error?.response?.data === "string" && error.response.data.trim()) {
    return error.response.data;
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function formatPaymentMethod(value) {
  if (!value) {
    return "-";
  }

  if (value === "MIXED") {
    return "Mixed";
  }

  return value;
}

const QUICK_PAYMENT_METHOD_OPTIONS = ["CASH", "CARD", "UPI"];

function formatBillChangeState(value) {
  const normalizedValue = String(value || "ACTIVE")
    .trim()
    .toUpperCase();

  if (normalizedValue === "DELETED") {
    return "Deleted";
  }

  if (normalizedValue === "EDITED") {
    return "Edited";
  }

  return "Active";
}

function getBillChangeStateClass(value) {
  const normalizedValue = String(value || "ACTIVE")
    .trim()
    .toUpperCase();

  if (normalizedValue === "DELETED") {
    return "bg-rose-100 text-rose-700";
  }

  if (normalizedValue === "EDITED") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function formatHistoryAction(value) {
  const normalizedValue = String(value || "EDITED")
    .trim()
    .toUpperCase();

  if (normalizedValue === "CREATED") {
    return "Created";
  }

  if (normalizedValue === "DELETED") {
    return "Deleted";
  }

  return "Edited";
}

function getHistoryActionClass(value) {
  const normalizedValue = String(value || "EDITED")
    .trim()
    .toUpperCase();

  if (normalizedValue === "CREATED") {
    return "bg-sky-100 text-sky-700";
  }

  if (normalizedValue === "DELETED") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-amber-100 text-amber-700";
}

function getPrinterLabel(item) {
  if (!item.printer_name) {
    return "No Printer";
  }

  if (!item.printer_target) {
    return item.printer_name;
  }

  return `${item.printer_name} (${item.printer_target})`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openPrintWindow(title, bodyHtml) {
  const printWindow = window.open("", "_blank", "width=960,height=720");

  if (!printWindow) {
    alert("Allow popups to print");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 24px;
            color: #0f172a;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 28px;
          }
          .meta {
            margin: 0 0 16px;
            color: #475569;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
          }
          th,
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #cbd5e1;
            text-align: left;
            font-size: 14px;
          }
          th {
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #475569;
            font-size: 12px;
          }
          .totals {
            margin-top: 18px;
            width: 320px;
            margin-left: auto;
          }
          .totals div {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .totals div:last-child {
            font-weight: 700;
            font-size: 18px;
            border-bottom: none;
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

function printBillDocument(bill) {
  const paymentBreakdown = [
    Number(bill.cash_paid || 0) > 0 ? `Cash ${formatMoney(bill.cash_paid)}` : null,
    Number(bill.card_paid || 0) > 0 ? `Card ${formatMoney(bill.card_paid)}` : null,
    Number(bill.upi_paid || 0) > 0 ? `UPI ${formatMoney(bill.upi_paid)}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  const balance = Number(bill.balance || 0);

  const bodyHtml = `
    <h1>${escapeHtml(bill.bill_number || "Bill")}</h1>
    <div class="meta">
      Table: ${escapeHtml(bill.table_name || "-")}<br />
      Floor: ${escapeHtml(bill.floor_name || "-")}<br />
      Updated: ${escapeHtml(bill.created_at || "-")}<br />
      Payment: ${escapeHtml(formatPaymentMethod(bill.payment_method))}
      ${paymentBreakdown ? `<br />${escapeHtml(paymentBreakdown)}` : ""}
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Tax</th>
          <th>Total</th>
          <th>Printer</th>
        </tr>
      </thead>
      <tbody>
        ${(bill.items || [])
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.item_name)}</td>
                <td>${escapeHtml(formatMoney(item.unit_price))}</td>
                <td>${escapeHtml(item.qty)}</td>
                <td>${escapeHtml(
                  item.tax_mode === "GST_INCLUDED" ? "GST Included" : "No Tax",
                )}</td>
                <td>${escapeHtml(formatMoney(item.line_total))}</td>
                <td>${escapeHtml(getPrinterLabel(item))}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${escapeHtml(formatMoney(bill.subtotal))}</span></div>
      <div><span>Total</span><span>${escapeHtml(formatMoney(bill.total))}</span></div>
      <div><span>Paid</span><span>${escapeHtml(formatMoney(bill.customer_paid))}</span></div>
      ${
        Number(bill.cash_paid || 0) > 0
          ? `<div><span>Cash</span><span>${escapeHtml(formatMoney(bill.cash_paid))}</span></div>`
          : ""
      }
      ${
        Number(bill.card_paid || 0) > 0
          ? `<div><span>Card</span><span>${escapeHtml(formatMoney(bill.card_paid))}</span></div>`
          : ""
      }
      ${
        Number(bill.upi_paid || 0) > 0
          ? `<div><span>UPI</span><span>${escapeHtml(formatMoney(bill.upi_paid))}</span></div>`
          : ""
      }
      <div><span>${escapeHtml(balance >= 0 ? "Balance" : "Due")}</span><span>${escapeHtml(
        formatMoney(Math.abs(balance)),
      )}</span></div>
    </div>
  `;

  openPrintWindow("Bill Reprint", bodyHtml);
}

function normalizeAmountInput(value) {
  if (value == null || String(value).trim() === "") {
    return 0;
  }

  const parsedValue = Number(value);
  return Number.isNaN(parsedValue) ? 0 : Math.max(parsedValue, 0);
}

function normalizeQtyInput(value) {
  if (value == null || String(value).trim() === "") {
    return 0;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(Math.trunc(parsedValue), 0);
}

function getResolvedPaymentMethod(cashPaid, cardPaid, upiPaid) {
  const activeMethods = [];

  if (Number(cashPaid || 0) > 0) {
    activeMethods.push("CASH");
  }

  if (Number(cardPaid || 0) > 0) {
    activeMethods.push("CARD");
  }

  if (Number(upiPaid || 0) > 0) {
    activeMethods.push("UPI");
  }

  if (activeMethods.length > 1) {
    return "MIXED";
  }

  return activeMethods[0] || "CASH";
}

const EDITOR_PAYMENT_METHOD_OPTIONS = ["CASH", "CARD", "UPI", "MIXED"];

function createEditorItem(item = {}) {
  return {
    clientKey:
      item.clientKey ||
      `bill-item-${item.id || "new"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id: item.id || null,
    product_id: item.product_id || null,
    item_name: item.item_name || "",
    unit_price:
      item.unit_price == null ? "" : String(Number(item.unit_price || 0)),
    qty: item.qty == null ? "1" : String(item.qty),
    tax_mode: item.tax_mode || "NO_TAX",
    printer_name: item.printer_name || "",
    printer_target: item.printer_target || "",
  };
}

function createEditorItemFromProduct(product) {
  return createEditorItem({
    product_id: product.id,
    item_name: product.name,
    unit_price: Number(product.sale_price || 0),
    qty: 1,
    tax_mode: product.tax_mode || "NO_TAX",
    printer_name: product.printer_name || "",
    printer_target: product.printer_target || "",
  });
}

export default function EditSalesPage() {
  const currentUser = getStoredUser();
  const { role } = currentUser;
  const permissions = getRolePermissions(role);
  const isAdminView = role === "ADMIN";
  const canManageCashClose = permissions.manageExpenses;
  const canEditBills = permissions.editBilledSales;
  const canReprintBills = permissions.reprintBill;
  const isReprintOnlyView = canReprintBills && !canEditBills;
  const todayDate = getTodayDateValue();
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [billsUnavailable, setBillsUnavailable] = useState(false);
  const [billPaymentMethodDrafts, setBillPaymentMethodDrafts] = useState({});
  const [changingPaymentBillId, setChangingPaymentBillId] = useState(null);
  const [dateFrom, setDateFrom] = useState(
    isAdminView ? "" : isReprintOnlyView ? "" : todayDate,
  );
  const [dateTo, setDateTo] = useState(
    isAdminView ? "" : isReprintOnlyView ? "" : todayDate,
  );
  const [billNumberSearch, setBillNumberSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [changeFilter, setChangeFilter] = useState("ACTIVE");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [deletingBill, setDeletingBill] = useState(false);
  const [reprintingBillId, setReprintingBillId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBill, setHistoryBill] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [cashClosingInfo, setCashClosingInfo] = useState({
    business_date: null,
    is_closed: false,
    closed_at: null,
    closed_by_username: "",
  });
  const [loadingCashClosing, setLoadingCashClosing] = useState(false);
  const [closingCash, setClosingCash] = useState(false);
  const [showCloseCashDialog, setShowCloseCashDialog] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedEditorItemId, setSelectedEditorItemId] = useState(null);

  const closeCashDate = dateTo || dateFrom || todayDate;

  const loadProductCatalog = async () => {
    try {
      setLoadingProducts(true);
      const response = await axios.get(`${API}/stock/products`);
      setProducts(Array.isArray(response.data) ? response.data : []);
      setCatalogUnavailable(false);
    } catch (error) {
      console.error(error);
      setProducts([]);
      setCatalogUnavailable(true);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadBills = async (filters = {}) => {
    const nextDateFrom = filters.dateFrom ?? dateFrom;
    const nextDateTo = filters.dateTo ?? dateTo;
    const nextBillNumber = filters.billNumberSearch ?? billNumberSearch;
    const nextPaymentFilter = filters.paymentFilter ?? paymentFilter;
    const nextChangeFilter = filters.changeFilter ?? changeFilter;
    const normalizedBillNumber = nextBillNumber.trim();
    const useExactBillNumberSearch = Boolean(
      !isAdminView && normalizedBillNumber,
    );
    const defaultLimitedList = !isAdminView && !normalizedBillNumber;

    try {
      setLoadingBills(true);
      const response = await axios.get(`${API}/sales/bills`, {
        params: {
          date_from:
            defaultLimitedList || useExactBillNumberSearch
              ? undefined
              : nextDateFrom || undefined,
          date_to:
            defaultLimitedList || useExactBillNumberSearch
              ? undefined
              : nextDateTo || undefined,
          bill_number: normalizedBillNumber || undefined,
          bill_number_exact: useExactBillNumberSearch || undefined,
          payment_method:
            defaultLimitedList || useExactBillNumberSearch || nextPaymentFilter === "ALL"
              ? undefined
              : nextPaymentFilter,
          change_filter: isAdminView ? nextChangeFilter : undefined,
          limit: defaultLimitedList ? 10 : undefined,
        },
      });
      setBills(Array.isArray(response.data) ? response.data : []);
      setBillPaymentMethodDrafts({});
      setBillsUnavailable(false);
    } catch (error) {
      console.error(error);
      setBills([]);
      setBillsUnavailable(true);
    } finally {
      setLoadingBills(false);
    }
  };

  const loadCashClosingStatus = async (businessDate = closeCashDate) => {
    if (!canManageCashClose || !businessDate) {
      return;
    }

    try {
      setLoadingCashClosing(true);
      const response = await axios.get(`${API}/sales/expenses`, {
        params: {
          expense_date: businessDate,
        },
      });

      setCashClosingInfo(
        response.data?.cash_closing || {
          business_date: businessDate,
          is_closed: false,
          closed_at: null,
          closed_by_username: "",
        },
      );
    } catch (error) {
      console.error(error);
      setCashClosingInfo({
        business_date: businessDate,
        is_closed: false,
        closed_at: null,
        closed_by_username: "",
      });
    } finally {
      setLoadingCashClosing(false);
    }
  };

  useEffect(() => {
    loadBills({
      dateFrom: isAdminView ? "" : isReprintOnlyView ? "" : todayDate,
      dateTo: isAdminView ? "" : isReprintOnlyView ? "" : todayDate,
      billNumberSearch: "",
      paymentFilter: "ALL",
      changeFilter: "ACTIVE",
    });
  }, [isAdminView, isReprintOnlyView, todayDate]);

  useEffect(() => {
    void loadCashClosingStatus(closeCashDate);
  }, [canManageCashClose, closeCashDate]);

  useEffect(() => {
    if (
      !editorOpen ||
      !canEditBills ||
      loadingProducts ||
      catalogUnavailable ||
      products.length > 0
    ) {
      return;
    }

    void loadProductCatalog();
  }, [
    canEditBills,
    catalogUnavailable,
    editorOpen,
    loadingProducts,
    products.length,
  ]);

  useEffect(() => {
    if (!editorOpen || !editingBill) {
      if (selectedEditorItemId !== null) {
        setSelectedEditorItemId(null);
      }
      return;
    }

    if (editingBill.items.length === 0) {
      setSelectedEditorItemId(null);
      return;
    }

    const hasSelectedItem = editingBill.items.some(
      (item) => item.clientKey === selectedEditorItemId,
    );

    if (!hasSelectedItem) {
      setSelectedEditorItemId(editingBill.items[0].clientKey);
    }
  }, [editingBill, editorOpen, selectedEditorItemId]);

  const searchBills = () => {
    loadBills();
  };

  const resetBillFilters = () => {
    setDateFrom(isAdminView ? "" : isReprintOnlyView ? "" : todayDate);
    setDateTo(isAdminView ? "" : isReprintOnlyView ? "" : todayDate);
    setBillNumberSearch("");
    setPaymentFilter("ALL");
    setChangeFilter("ACTIVE");
    loadBills({
      dateFrom: isAdminView ? "" : isReprintOnlyView ? "" : todayDate,
      dateTo: isAdminView ? "" : isReprintOnlyView ? "" : todayDate,
      billNumberSearch: "",
      paymentFilter: "ALL",
      changeFilter: "ACTIVE",
    });
  };

  const closeCashForCurrentDate = async () => {
    if (!closeCashDate) {
      alert("Select a valid date before closing cash");
      return;
    }

    try {
      setClosingCash(true);
      const response = await axios.put(`${API}/sales/cash-closing`, {
        business_date: closeCashDate,
        cash_in_hand: 0,
        actor_user_id: currentUser.id,
        actor_username: currentUser.username,
        actor_role: currentUser.role,
      });

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      setShowCloseCashDialog(false);
      await loadCashClosingStatus(closeCashDate);

      if (response.data?.report_email_warning) {
        alert(`Cash closed. ${response.data.report_email_warning}`);
        return;
      }

      alert(
        response.data?.report_email_message
          ? `Cash closed. ${response.data.report_email_message}`
          : response.data?.message || "Cash closed successfully",
      );
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to close cash"));
    } finally {
      setClosingCash(false);
    }
  };

  const closeEditor = (force = false) => {
    if ((savingBill || deletingBill) && !force) {
      return;
    }

    setEditorOpen(false);
    setEditingBill(null);
    setSelectedEditorItemId(null);
  };

  const openBillEditor = async (billId) => {
    if (!canEditBills) {
      return;
    }

    try {
      setLoadingEditor(true);
      setEditorOpen(true);
      setProductSearch("");
      setCategoryFilter("ALL");
      setSelectedEditorItemId(null);
      const response = await axios.get(`${API}/sales/bills/${billId}`);

      if (response.data?.error) {
        alert(response.data.error);
        setEditorOpen(false);
        return;
      }

      const bill = response.data;

      if (bill.is_deleted) {
        alert("Deleted bills are read-only. Use bill history to review changes.");
        setEditorOpen(false);
        return;
      }

      const editorItems =
        Array.isArray(bill.items) && bill.items.length > 0
          ? bill.items.map((item) => createEditorItem(item))
          : [createEditorItem()];

      setEditingBill({
        id: bill.id,
        billNumber: bill.bill_number,
        tableName: bill.table_name || "-",
        floorName: bill.floor_name || "-",
        createdAt: bill.created_at || "-",
        changeState: bill.change_state || "ACTIVE",
        isDeleted: Boolean(bill.is_deleted),
        editedAt: bill.edited_at || null,
        editedByUsername: bill.edited_by_username || "",
        deletedAt: bill.deleted_at || null,
        deletedByUsername: bill.deleted_by_username || "",
        printEnabled: bill.print_enabled !== false,
        items: editorItems,
        cashPaidInput:
          Number(bill.cash_paid || 0) > 0 ? String(bill.cash_paid) : "",
        cardPaidInput:
          Number(bill.card_paid || 0) > 0 ? String(bill.card_paid) : "",
        upiPaidInput:
          Number(bill.upi_paid || 0) > 0 ? String(bill.upi_paid) : "",
        paymentMethodInput:
          bill.payment_method ||
          getResolvedPaymentMethod(
            Number(bill.cash_paid || 0),
            Number(bill.card_paid || 0),
            Number(bill.upi_paid || 0),
          ),
      });
      setSelectedEditorItemId(editorItems[0]?.clientKey || null);
    } catch (error) {
      console.error(error);
      alert("Failed to load bill details");
      setEditorOpen(false);
    } finally {
      setLoadingEditor(false);
    }
  };

  const closeBillHistory = () => {
    setHistoryOpen(false);
    setHistoryBill(null);
    setHistoryEntries([]);
    setLoadingHistory(false);
  };

  const openBillHistory = async (bill) => {
    if (!isAdminView || !bill?.id) {
      return;
    }

    setHistoryBill({
      id: bill.id,
      billNumber: bill.bill_number || bill.billNumber || "-",
      tableName: bill.table_name || bill.tableName || "-",
      floorName: bill.floor_name || bill.floorName || "-",
      changeState: bill.change_state || bill.changeState || "ACTIVE",
    });
    setHistoryEntries([]);
    setHistoryOpen(true);
    setLoadingHistory(true);

    try {
      const response = await axios.get(`${API}/sales/bills/${bill.id}/history`);

      if (response.data?.error) {
        alert(response.data.error);
        closeBillHistory();
        return;
      }

      setHistoryEntries(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(error);
      alert("Failed to load bill history");
      closeBillHistory();
    } finally {
      setLoadingHistory(false);
    }
  };

  const reprintBill = async (billId) => {
    try {
      setReprintingBillId(billId);
      const response = await axios.get(`${API}/sales/bills/${billId}`);

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      printBillDocument(response.data);
    } catch (error) {
      console.error(error);
      alert("Failed to reprint bill");
    } finally {
      setReprintingBillId(null);
    }
  };

  const getBillPaymentMethodDraft = (bill) =>
    billPaymentMethodDrafts[bill.id] || bill.payment_method || "CASH";

  const changeBillPaymentMethod = async (bill) => {
    if (!canEditBills || !bill || bill.is_deleted) {
      return;
    }

    const nextPaymentMethod = getBillPaymentMethodDraft(bill);

    if (!nextPaymentMethod || nextPaymentMethod === bill.payment_method) {
      return;
    }

    try {
      setChangingPaymentBillId(bill.id);
      const response = await axios.put(
        `${API}/sales/bills/${bill.id}/payment-method`,
        {
          payment_method: nextPaymentMethod,
          actor_user_id: currentUser.id,
          actor_username: currentUser.username,
          actor_role: currentUser.role,
        },
      );

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      await loadBills();
      alert("Payment method updated");
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to change payment method"));
    } finally {
      setChangingPaymentBillId(null);
    }
  };

  const updateEditorItem = (clientKey, field, value) => {
    setEditingBill((currentValue) => {
      if (!currentValue) {
        return currentValue;
      }

      return {
        ...currentValue,
        items: currentValue.items.map((item) =>
          item.clientKey === clientKey ? { ...item, [field]: value } : item,
        ),
      };
    });
  };

  const removeEditorItem = (clientKey) => {
    setEditingBill((currentValue) => {
      if (!currentValue) {
        return currentValue;
      }

      if (currentValue.items.length <= 1) {
        return {
          ...currentValue,
          items: [createEditorItem()],
        };
      }

      return {
        ...currentValue,
        items: currentValue.items.filter((item) => item.clientKey !== clientKey),
      };
    });
  };

  const setEditingBillField = (field, value) => {
    setEditingBill((currentValue) =>
      currentValue ? { ...currentValue, [field]: value } : currentValue,
    );
  };

  const setEditorPaymentMethod = (nextMethod) => {
    const normalizedMethod = String(nextMethod || "CASH")
      .trim()
      .toUpperCase();

    setEditingBill((currentValue) => {
      if (!currentValue) {
        return currentValue;
      }

      const normalizedTotalPaid = Number(
        (
          normalizeAmountInput(currentValue.cashPaidInput) +
          normalizeAmountInput(currentValue.cardPaidInput) +
          normalizeAmountInput(currentValue.upiPaidInput)
        ).toFixed(2),
      );
      const paymentAmountText =
        normalizedTotalPaid > 0 ? String(normalizedTotalPaid) : "";

      if (normalizedMethod === "CASH") {
        return {
          ...currentValue,
          paymentMethodInput: "CASH",
          cashPaidInput: paymentAmountText,
          cardPaidInput: "",
          upiPaidInput: "",
        };
      }

      if (normalizedMethod === "CARD") {
        return {
          ...currentValue,
          paymentMethodInput: "CARD",
          cashPaidInput: "",
          cardPaidInput: paymentAmountText,
          upiPaidInput: "",
        };
      }

      if (normalizedMethod === "UPI") {
        return {
          ...currentValue,
          paymentMethodInput: "UPI",
          cashPaidInput: "",
          cardPaidInput: "",
          upiPaidInput: paymentAmountText,
        };
      }

      return {
        ...currentValue,
        paymentMethodInput: "MIXED",
      };
    });
  };

  const addCustomEditorItem = () => {
    if (!editingBill) {
      return;
    }

    const nextItem = createEditorItem();

    setEditingBill((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            items: [...currentValue.items, nextItem],
          }
        : currentValue,
    );
    setSelectedEditorItemId(nextItem.clientKey);
  };

  const addCatalogItemToBill = (product) => {
    if (!editingBill) {
      return;
    }

    const nextItem = createEditorItemFromProduct(product);
    const existingItem = editingBill.items.find(
      (item) => Number(item.product_id || 0) === Number(product.id),
    );

    setEditingBill((currentValue) => {
      if (!currentValue) {
        return currentValue;
      }

      return {
        ...currentValue,
        items: existingItem
          ? currentValue.items.map((item) =>
              item.clientKey === existingItem.clientKey
                ? {
                    ...item,
                    qty: String(Math.max(normalizeQtyInput(item.qty), 0) + 1),
                  }
                : item,
            )
          : [...currentValue.items, nextItem],
      };
    });
    setSelectedEditorItemId(existingItem?.clientKey || nextItem.clientKey);
  };

  const setEditorItemQuantity = (clientKey, qty) => {
    const normalizedQty = Math.max(normalizeQtyInput(qty), 0);

    if (normalizedQty <= 0) {
      removeEditorItem(clientKey);
      return;
    }

    updateEditorItem(clientKey, "qty", String(normalizedQty));
  };

  const updateSelectedEditorQty = (change) => {
    if (!editingBill || !selectedEditorItemId) {
      return;
    }

    const selectedItem = editingBill.items.find(
      (item) => item.clientKey === selectedEditorItemId,
    );

    if (!selectedItem) {
      return;
    }

    setEditorItemQuantity(
      selectedEditorItemId,
      normalizeQtyInput(selectedItem.qty) + change,
    );
  };

  const removeSelectedEditorItem = () => {
    if (!selectedEditorItemId) {
      return;
    }

    removeEditorItem(selectedEditorItemId);
  };

  const editorItems = editingBill?.items || [];
  const selectedEditorItem =
    editorItems.find((item) => item.clientKey === selectedEditorItemId) || null;
  const editorCategories = [
    "ALL",
    ...new Set(
      products
        .map((product) => product.category_name)
        .filter((category) => Boolean(category)),
    ),
  ];
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(productSearch.toLowerCase());
    const matchesCategory =
      categoryFilter === "ALL" || product.category_name === categoryFilter;

    return matchesSearch && matchesCategory;
  });
  const editorTotalUnits = editorItems.reduce(
    (sum, item) => sum + normalizeQtyInput(item.qty),
    0,
  );
  const editorSubtotal = Number(
    editorItems
      .reduce((sum, item) => {
        return (
          sum +
          normalizeAmountInput(item.unit_price) * normalizeQtyInput(item.qty)
        );
      }, 0)
      .toFixed(2),
  );
  const editorCashPaid = normalizeAmountInput(editingBill?.cashPaidInput);
  const editorCardPaid = normalizeAmountInput(editingBill?.cardPaidInput);
  const editorUpiPaid = normalizeAmountInput(editingBill?.upiPaidInput);
  const editorTotalPaid = Number(
    (editorCashPaid + editorCardPaid + editorUpiPaid).toFixed(2),
  );
  const editorBalance = Number((editorTotalPaid - editorSubtotal).toFixed(2));
  const editorResolvedPaymentMethod = getResolvedPaymentMethod(
    editorCashPaid,
    editorCardPaid,
    editorUpiPaid,
  );
  const editorPaymentMethod =
    editingBill?.paymentMethodInput || editorResolvedPaymentMethod;
  const editorBusy = savingBill || deletingBill;

  const saveBillChanges = async () => {
    if (!editingBill) {
      return;
    }

    const payloadItems = editingBill.items.map((item) => ({
      product_id: item.product_id,
      item_name: item.item_name,
      unit_price: normalizeAmountInput(item.unit_price),
      qty: normalizeQtyInput(item.qty),
      tax_mode: item.tax_mode || "NO_TAX",
      printer_name: item.printer_name?.trim() || null,
      printer_target: item.printer_target?.trim() || null,
    }));

    const validItems = payloadItems.filter(
      (item) => item.item_name.trim() && item.qty > 0,
    );

    if (validItems.length === 0) {
      alert("Add at least one valid bill item");
      return;
    }

    if (editorTotalPaid <= 0 && editorSubtotal > 0) {
      alert("Enter payment amount before saving bill");
      return;
    }

    if (editorTotalPaid < editorSubtotal) {
      alert("Total payment is less than bill total");
      return;
    }

    try {
      setSavingBill(true);
      const response = await axios.put(`${API}/sales/bills/${editingBill.id}`, {
        items: validItems,
        customer_paid: editorTotalPaid,
        payment_method: editorPaymentMethod,
        print_enabled: editingBill.printEnabled,
        cash_paid: editorCashPaid,
        card_paid: editorCardPaid,
        upi_paid: editorUpiPaid,
        actor_user_id: currentUser.id,
        actor_username: currentUser.username,
        actor_role: currentUser.role,
      });

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      if (editingBill.printEnabled) {
        printBillDocument(response.data);
      }

      await loadBills();
      closeEditor(true);
      alert(editingBill.printEnabled ? "Bill updated and printed" : "Bill updated");
    } catch (error) {
      console.error(error);
      alert("Failed to update bill");
    } finally {
      setSavingBill(false);
    }
  };

  const deleteBill = async () => {
    if (!isAdminView) {
      alert("Only admin can delete bills");
      return;
    }

    if (!editingBill || editingBill.isDeleted) {
      return;
    }

    if (
      !window.confirm(
        `Do you want to delete bill ${editingBill.billNumber}? This keeps the audit history.`,
      )
    ) {
      return;
    }

    try {
      setDeletingBill(true);
      const response = await axios.delete(`${API}/sales/bills/${editingBill.id}`, {
        data: {
          actor_user_id: currentUser.id,
          actor_username: currentUser.username,
          actor_role: currentUser.role,
        },
      });

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      await loadBills();
      closeEditor(true);
      closeBillHistory();
      alert("Bill deleted");
    } catch (error) {
      console.error(error);
      alert("Failed to delete bill");
    } finally {
      setDeletingBill(false);
    }
  };

  return (
    <AppSidebarLayout
      role={role}
      currentPage="edit-sale"
      onRefresh={() => {
        loadBills();
      }}
    >
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {canEditBills ? "Edit Sale" : "Bill History"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAdminView
                ? "Search billed sales by date, bill number, payment type, or bill state. Admin can review active, edited, and deleted bills and open the full audit history."
                : canEditBills
                  ? "Latest 10 bills are shown by default. Enter the full bill number to find any older bill and edit it."
                : "Cashier bill history shows the latest 10 bills. Enter the full bill number to search any saved receipt."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
              {!isAdminView && !billNumberSearch.trim()
                ? `${bills.length} latest bills`
                : `${bills.length} bills in list`}
            </div>
            {canManageCashClose && (
              cashClosingInfo?.is_closed ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Cash closed for {cashClosingInfo.business_date || closeCashDate}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCloseCashDialog(true)}
                  disabled={loadingCashClosing || closingCash}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {closingCash ? "Closing..." : "Close Cash"}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {isAdminView && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-2 block rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500"
              />
            </div>
          )}

          {isAdminView && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-2 block rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div className="min-w-[260px] flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bill Number
            </label>
            <input
              type="text"
              value={billNumberSearch}
              onChange={(event) => setBillNumberSearch(event.target.value)}
              placeholder={
                !isAdminView
                  ? "Enter full bill number"
                  : "Search bill number"
              }
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500"
            />
          </div>

          {isAdminView && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment
              </label>
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                className="mt-2 block rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="ALL">All Payments</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
          )}

          {isAdminView && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bill State
              </label>
              <select
                value={changeFilter}
                onChange={(event) => setChangeFilter(event.target.value)}
                className="mt-2 block rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="EDITED">Edited</option>
                <option value="DELETED">Deleted</option>
                <option value="ALL">All Bills</option>
              </select>
            </div>
          )}

          <button
            onClick={searchBills}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Search Bills
          </button>
          <button
            onClick={resetBillFilters}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            {isAdminView ? "All Bills" : isReprintOnlyView ? "Latest 10" : "Today"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bill List</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isAdminView
                ? "Filter active, edited, or deleted bills. Active bills can be edited, and every bill keeps its change history."
                : canEditBills
                  ? "Latest 10 bills are shown by default. Search with the full bill number to edit an older bill."
                : "Latest 10 bills are shown by default. Use the full bill number to find any older receipt."}
            </p>
          </div>
        </div>

        {loadingBills ? (
          <div className="mt-5 text-sm text-slate-500">Loading bill list...</div>
        ) : billsUnavailable ? (
          <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
            Bill history is not available right now. Restart the backend and try
            again.
          </div>
        ) : bills.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div
              className={`grid gap-3 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                isAdminView
                  ? "grid-cols-[1.1fr_1.4fr_1fr_1fr_0.9fr_0.9fr_0.8fr_1.6fr]"
                  : "grid-cols-[1.1fr_1.5fr_1fr_1fr_0.9fr_0.8fr_1.2fr]"
              }`}
            >
              <div>Bill Number</div>
              <div>Date Time</div>
              <div>Table</div>
              <div>Floor</div>
              {isAdminView && <div>Status</div>}
              <div>Payment</div>
              <div className="text-right">Total</div>
              <div className="text-right">Actions</div>
            </div>
            {bills.map((bill) => (
              <div
                key={bill.id}
                className={`grid gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-700 ${
                  isAdminView
                    ? "grid-cols-[1.1fr_1.4fr_1fr_1fr_0.9fr_0.9fr_0.8fr_1.6fr]"
                    : "grid-cols-[1.1fr_1.5fr_1fr_1fr_0.9fr_0.8fr_1.2fr]"
                }`}
              >
                <div className="font-semibold text-slate-900">
                  {bill.bill_number}
                </div>
                <div>{bill.created_at || "-"}</div>
                <div>{bill.table_name || "-"}</div>
                <div>{bill.floor_name || "-"}</div>
                {isAdminView && (
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getBillChangeStateClass(
                        bill.change_state,
                      )}`}
                    >
                      {formatBillChangeState(bill.change_state)}
                    </span>
                  </div>
                )}
                <div>
                  {canEditBills && !bill.is_deleted ? (
                    <select
                      value={getBillPaymentMethodDraft(bill)}
                      onChange={(event) =>
                        setBillPaymentMethodDrafts((currentValue) => ({
                          ...currentValue,
                          [bill.id]: event.target.value,
                        }))
                      }
                      disabled={changingPaymentBillId === bill.id}
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      {QUICK_PAYMENT_METHOD_OPTIONS.map((method) => (
                        <option key={method} value={method}>
                          {formatPaymentMethod(method)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    formatPaymentMethod(bill.payment_method)
                  )}
                </div>
                <div className="text-right font-semibold text-slate-900">
                  {formatMoney(bill.total)}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {canEditBills && !bill.is_deleted && (
                    <button
                      onClick={() => void changeBillPaymentMethod(bill)}
                      disabled={
                        changingPaymentBillId === bill.id ||
                        getBillPaymentMethodDraft(bill) === bill.payment_method
                      }
                      className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-amber-50 disabled:text-amber-300"
                    >
                      {changingPaymentBillId === bill.id ? "Changing..." : "Change"}
                    </button>
                  )}
                  {isAdminView && (
                    <button
                      onClick={() => openBillHistory(bill)}
                      className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      History
                    </button>
                  )}
                  {canReprintBills && !bill.is_deleted && (
                    <button
                      onClick={() => reprintBill(bill.id)}
                      disabled={reprintingBillId === bill.id}
                      className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-emerald-50"
                    >
                      {reprintingBillId === bill.id ? "Printing..." : "Reprint"}
                    </button>
                  )}
                  {canEditBills && !bill.is_deleted && (
                    <button
                      onClick={() => openBillEditor(bill.id)}
                      className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
            {!isAdminView
              ? "No bills found. Enter the full bill number to search older receipts."
              : "No bills found for the selected date range, bill number, payment type, or bill state."}
          </div>
        )}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-[1500px] overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl">
            {loadingEditor || !editingBill ? (
              <div className="py-20 text-center text-sm text-slate-500">
                Loading bill editor...
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
                      Edit Bill
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      {editingBill.billNumber}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {editingBill.tableName} | {editingBill.floorName} |{" "}
                      {editingBill.createdAt}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getBillChangeStateClass(
                          editingBill.changeState,
                        )}`}
                      >
                        {formatBillChangeState(editingBill.changeState)}
                      </span>
                      {editingBill.editedAt && (
                        <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Edited {editingBill.editedAt}
                          {editingBill.editedByUsername
                            ? ` by ${editingBill.editedByUsername}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
                      Lines
                      <div className="mt-1 text-base font-bold text-slate-900">
                        {editorItems.length}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
                      Units
                      <div className="mt-1 text-base font-bold text-slate-900">
                        {editorTotalUnits}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
                      Paid
                      <div className="mt-1 text-base font-bold text-slate-900">
                        {formatMoney(editorTotalPaid)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-white">
                      Total
                      <div className="mt-1 text-base font-bold">
                        {formatMoney(editorSubtotal)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isAdminView && (
                      <button
                        onClick={() => openBillHistory(editingBill)}
                        disabled={editorBusy}
                        className="rounded-2xl bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-violet-50"
                      >
                        History
                      </button>
                    )}
                    {isAdminView && (
                      <button
                        onClick={deleteBill}
                        disabled={editorBusy || editingBill.isDeleted}
                        className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-rose-300"
                      >
                        {deletingBill ? "Deleting..." : "Delete Bill"}
                      </button>
                    )}
                    <button
                      onClick={closeEditor}
                      disabled={editorBusy}
                      className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_340px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
                      <div className="grid grid-cols-[2fr_0.8fr_0.7fr_0.9fr_0.9fr_1.1fr] gap-3 border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                        <div>Item</div>
                        <div>Price</div>
                        <div>Units</div>
                        <div>Taxes</div>
                        <div>Value</div>
                        <div>Printer</div>
                      </div>

                      <div className="max-h-[360px] overflow-y-auto">
                        {editorItems.length > 0 ? (
                          editorItems.map((item) => {
                            const isSelected =
                              item.clientKey === selectedEditorItemId;

                            return (
                              <button
                                key={item.clientKey}
                                onClick={() =>
                                  setSelectedEditorItemId(item.clientKey)
                                }
                                className={`grid w-full grid-cols-[2fr_0.8fr_0.7fr_0.9fr_0.9fr_1.1fr] gap-3 border-b border-slate-200 px-4 py-2 text-left text-sm ${
                                  isSelected
                                    ? "bg-slate-200"
                                    : "bg-white hover:bg-slate-50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-slate-900">
                                    {item.item_name || "Untitled Item"}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {item.product_id
                                      ? `Product #${item.product_id}`
                                      : "Custom item"}
                                  </div>
                                </div>
                                <div className="text-slate-700">
                                  {formatMoney(item.unit_price)}
                                </div>
                                <div className="text-slate-700">
                                  x{normalizeQtyInput(item.qty)}
                                </div>
                                <div className="text-slate-700">
                                  {item.tax_mode === "GST_INCLUDED"
                                    ? "GST Inc"
                                    : "No Tax"}
                                </div>
                                <div className="font-semibold text-slate-900">
                                  {formatMoney(
                                    normalizeAmountInput(item.unit_price) *
                                      normalizeQtyInput(item.qty),
                                  )}
                                </div>
                                <div className="truncate text-slate-700">
                                  {getPrinterLabel(item)}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-6 py-20 text-center text-sm text-slate-500">
                            Add items from the catalog or create a custom line.
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3 border-t border-slate-300 px-4 py-3">
                        <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-center">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Lines
                          </div>
                          <div className="mt-1 text-lg font-bold text-slate-900">
                            {editorItems.length}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-center">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Units
                          </div>
                          <div className="mt-1 text-lg font-bold text-slate-900">
                            {editorTotalUnits}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-center text-white">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                            Total
                          </div>
                          <div className="mt-1 text-lg font-bold">
                            {formatMoney(editorSubtotal)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)]">
                      <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                          Categories
                        </div>
                        <div className="space-y-1 p-2">
                          {editorCategories.map((category) => (
                            <button
                              key={category}
                              onClick={() => setCategoryFilter(category)}
                              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                                categoryFilter === category
                                  ? "bg-slate-800 text-white"
                                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {category === "ALL" ? "All Items" : category}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-4 py-2">
                          <div className="text-sm font-bold text-slate-700">
                            Items
                          </div>
                          <div className="flex w-full max-w-md gap-2">
                            <input
                              value={productSearch}
                              onChange={(event) =>
                                setProductSearch(event.target.value)
                              }
                              placeholder="Search item"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                            />
                            <button
                              onClick={addCustomEditorItem}
                              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                              Custom
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                          {loadingProducts ? (
                            <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-500">
                              Loading items...
                            </div>
                          ) : catalogUnavailable ? (
                            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
                              Product catalog is unavailable right now.
                            </div>
                          ) : filteredProducts.length > 0 ? (
                            filteredProducts.map((product) => (
                              <button
                                key={product.id}
                                onClick={() => addCatalogItemToBill(product)}
                                className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-left hover:border-sky-400 hover:bg-sky-50"
                              >
                                <div className="flex gap-2">
                                  {product.image_url ? (
                                    <img
                                      src={`${API}${product.image_url}`}
                                      alt={product.name}
                                      className="h-12 w-12 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                                      <FiImage className="h-5 w-5" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-slate-900">
                                      {product.name}
                                    </div>
                                    <div className="truncate text-[11px] text-slate-500">
                                      {product.category_name}
                                    </div>
                                    <div className="mt-1 text-sm font-bold text-slate-900">
                                      {formatMoney(product.sale_price)}
                                    </div>
                                    <div className="truncate text-[11px] text-slate-500">
                                      {getPrinterLabel(product)}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-500">
                              No items found.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
                      {selectedEditorItem ? (
                        <div className="grid gap-2 p-3">
                          <button
                            onClick={() => updateSelectedEditorQty(1)}
                            title="Qty+"
                            aria-label="Qty+"
                            className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 text-white shadow-md shadow-sky-200/80 hover:brightness-105"
                          >
                            <FiPlus className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => updateSelectedEditorQty(-1)}
                            title="Qty-"
                            aria-label="Qty-"
                            className="flex h-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-300/70 hover:bg-slate-800"
                          >
                            <FiMinus className="h-5 w-5" />
                          </button>
                          <button
                            onClick={removeSelectedEditorItem}
                            title="Delete"
                            aria-label="Delete"
                            className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-200/80 hover:brightness-105"
                          >
                            <FiTrash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 text-sm text-slate-500">
                          Select a line from the bill.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                      <div className="text-sm font-bold text-slate-900">
                        Selected Line
                      </div>

                      {selectedEditorItem ? (
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Item Name
                            </label>
                            <input
                              type="text"
                              value={selectedEditorItem.item_name}
                              onChange={(event) =>
                                updateEditorItem(
                                  selectedEditorItem.clientKey,
                                  "item_name",
                                  event.target.value,
                                )
                              }
                              className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Qty
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={selectedEditorItem.qty}
                                onChange={(event) =>
                                  setEditorItemQuantity(
                                    selectedEditorItem.clientKey,
                                    event.target.value,
                                  )
                                }
                                className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Price
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={selectedEditorItem.unit_price}
                                onChange={(event) =>
                                  updateEditorItem(
                                    selectedEditorItem.clientKey,
                                    "unit_price",
                                    event.target.value,
                                  )
                                }
                                className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Tax
                            </label>
                            <select
                              value={selectedEditorItem.tax_mode}
                              onChange={(event) =>
                                updateEditorItem(
                                  selectedEditorItem.clientKey,
                                  "tax_mode",
                                  event.target.value,
                                )
                              }
                              className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                            >
                              <option value="NO_TAX">No Tax</option>
                              <option value="GST_INCLUDED">GST Included</option>
                            </select>
                          </div>

                          <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Printer
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {getPrinterLabel(selectedEditorItem)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-slate-500">
                          Select an item to update its name, quantity, price, or tax.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_50px_-30px_rgba(15,23,42,0.6)]">
                      <div className="border-b border-slate-200 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700">
                        Payment
                      </div>

                      <div className="p-4">
                        <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 py-5 text-right text-3xl font-bold text-white shadow-[0_20px_35px_-24px_rgba(2,132,199,0.85)]">
                          {formatMoney(editorSubtotal)}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-[20px] border border-slate-200 bg-slate-50/90 px-3 py-3 text-center">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Paid
                            </div>
                            <div className="mt-1 text-lg font-bold text-slate-900">
                              {formatMoney(editorTotalPaid)}
                            </div>
                          </div>
                          <div className="rounded-[20px] border border-slate-200 bg-slate-50/90 px-3 py-3 text-center">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {editorBalance >= 0 ? "Balance" : "Due"}
                            </div>
                            <div className="mt-1 text-lg font-bold text-slate-900">
                              {formatMoney(Math.abs(editorBalance))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-3">
                          <div className="rounded-[22px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <FiDollarSign className="h-4 w-4" />
                              Cash
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingBill.cashPaidInput}
                              onChange={(event) =>
                                setEditingBillField(
                                  "cashPaidInput",
                                  event.target.value,
                                )
                              }
                              className="mt-2 w-full bg-transparent text-right text-2xl font-bold text-slate-900 outline-none"
                            />
                          </div>

                          <div className="rounded-[22px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <FiCreditCard className="h-4 w-4" />
                              Card
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingBill.cardPaidInput}
                              onChange={(event) =>
                                setEditingBillField(
                                  "cardPaidInput",
                                  event.target.value,
                                )
                              }
                              className="mt-2 w-full bg-transparent text-right text-2xl font-bold text-slate-900 outline-none"
                            />
                          </div>

                          <div className="rounded-[22px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <FiSmartphone className="h-4 w-4" />
                              UPI
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingBill.upiPaidInput}
                              onChange={(event) =>
                                setEditingBillField(
                                  "upiPaidInput",
                                  event.target.value,
                                )
                              }
                              className="mt-2 w-full bg-transparent text-right text-2xl font-bold text-slate-900 outline-none"
                            />
                          </div>
                        </div>

                        <div className="mt-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Payment Method
                          </div>
                          <select
                            value={editorPaymentMethod}
                            onChange={(event) =>
                              setEditorPaymentMethod(event.target.value)
                            }
                            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500"
                          >
                            {EDITOR_PAYMENT_METHOD_OPTIONS.map((method) => (
                              <option key={method} value={method}>
                                {formatPaymentMethod(method)}
                              </option>
                            ))}
                          </select>
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            Applied: {formatPaymentMethod(editorResolvedPaymentMethod)}
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            setEditingBillField(
                              "printEnabled",
                              !editingBill.printEnabled,
                            )
                          }
                          className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[20px] border px-3 py-3 text-sm font-semibold ${
                            editingBill.printEnabled
                              ? "border-sky-500 bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 text-white shadow-lg shadow-sky-200/80"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          <FiPrinter className="h-4 w-4" />
                          Print After Save {editingBill.printEnabled ? "On" : "Off"}
                        </button>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={closeEditor}
                            disabled={editorBusy}
                            className="rounded-[20px] border border-slate-200 bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveBillChanges}
                            disabled={editorBusy}
                            className="rounded-[20px] border border-sky-500 bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300"
                          >
                            {savingBill
                              ? "Saving..."
                              : editingBill.printEnabled
                                ? "Save & Print"
                                : "Save Bill"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isAdminView && historyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">
                  Bill History
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {historyBill?.billNumber || "-"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {historyBill?.tableName || "-"} | {historyBill?.floorName || "-"}
                </p>
                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getBillChangeStateClass(
                      historyBill?.changeState,
                    )}`}
                  >
                    {formatBillChangeState(historyBill?.changeState)}
                  </span>
                </div>
              </div>
              <button
                onClick={closeBillHistory}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Loading bill history...
              </div>
            ) : historyEntries.length > 0 ? (
              <div className="mt-6 space-y-4">
                {historyEntries.map((entry) => {
                  const snapshot = entry.snapshot || {};
                  const snapshotItems = Array.isArray(snapshot.items)
                    ? snapshot.items
                    : [];

                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getHistoryActionClass(
                                entry.action_type,
                              )}`}
                            >
                              {formatHistoryAction(entry.action_type)}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {entry.changed_at || "-"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            Changed by {entry.changed_by_username || "System"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-full bg-white px-3 py-1">
                            Payment {formatPaymentMethod(snapshot.payment_method)}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1">
                            Total {formatMoney(snapshot.total)}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1">
                            Paid {formatMoney(snapshot.customer_paid)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {snapshotItems.length > 0 ? (
                          snapshotItems.map((item, index) => (
                            <div
                              key={`${entry.id}-${item.id || item.item_name || "item"}-${index}`}
                              className="flex items-center justify-between rounded-xl bg-white px-4 py-3"
                            >
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {item.item_name}
                                </div>
                                <div className="text-sm text-slate-500">
                                  Qty {item.qty} x {formatMoney(item.unit_price)}
                                </div>
                              </div>
                              <div className="font-semibold text-slate-900">
                                {formatMoney(item.line_total)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
                            No bill items captured for this history entry.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
                No edit history found for this bill yet.
              </div>
            )}
          </div>
        </div>
      )}

      {showCloseCashDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
              Close Cash
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              Confirm Daily Close
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Close cash for {closeCashDate}. After closing, non-admin users cannot
              edit expenses or billed sales for this date. The Daily Sales Full
              Report will be sent automatically to the default recipients.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowCloseCashDialog(false)}
                disabled={closingCash}
                className="rounded-[22px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void closeCashForCurrentDate()}
                disabled={closingCash}
                className="rounded-[22px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {closingCash ? "Closing..." : "Confirm Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppSidebarLayout>
  );
}
