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
  FiCreditCard,
  FiDollarSign,
  FiGrid,
  FiMinus,
  FiMove,
  FiPlus,
  FiPrinter,
  FiScissors,
  FiSmartphone,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
} from "react-icons/fi";
import AppSidebarLayout from "../components/AppSidebarLayout";
import {
  getRolePermissions,
  getStoredUser,
  isLineOwnedByUser,
} from "../lib/accessControl";
import { API, apiUrl } from "../lib/api";
import { readStoredReceiptSettings } from "../lib/receiptSettings";
import {
  clearSaleDraft,
  readSaleDraft,
  writeSaleDraft,
} from "../lib/saleDrafts";

function getPrinterLabel(product) {
  if (!product.printer_name) {
    return "No Printer";
  }

  if (!product.printer_target) {
    return product.printer_name;
  }

  return `${product.printer_name} (${product.printer_target})`;
}

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

function formatThermalOrderLabel(value) {
  return String(value || "DINE IN").trim().toUpperCase();
}

function getReceiptAlignmentClass(value) {
  const normalizedValue = String(value || "CENTER").trim().toUpperCase();

  if (normalizedValue === "LEFT") {
    return "align-left";
  }

  if (normalizedValue === "RIGHT") {
    return "align-right";
  }

  return "align-center";
}

function getReceiptLogoStyle(value) {
  const numericValue = Number(value);
  const maxWidth = Number.isFinite(numericValue)
    ? Math.min(Math.max(Math.round(numericValue), 80), 300)
    : 200;
  const maxHeight = Math.max(Math.round(maxWidth * 0.38), 40);
  return `max-width:${maxWidth}px;max-height:${maxHeight}px;`;
}

function normalizeReceiptFontSize(value, fallbackValue = 13) {
  if (typeof value === "string") {
    const normalizedValue = value.trim().toUpperCase();

    if (normalizedValue === "SMALL") {
      return 11;
    }

    if (normalizedValue === "MEDIUM") {
      return 13;
    }

    if (normalizedValue === "LARGE") {
      return 18;
    }
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return Math.min(Math.max(Math.round(numericValue), 9), 56);
}

function buildReceiptTextStyle(value, fallbackValue = 13) {
  const fontSize = normalizeReceiptFontSize(value, fallbackValue);
  const lineHeight = Math.max(Math.round(fontSize * 1.35), fontSize + 2);
  return `font-size:${fontSize}px;line-height:${lineHeight}px;`;
}

function buildReceiptMultilineHtml(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return lines.map((line) => escapeHtml(line)).join("<br />");
}

function buildReceiptHeaderHtml(settings) {
  const headerLines = String(settings?.header_text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (headerLines.length === 0) {
    return "";
  }

  const [primaryLine, ...secondaryLines] = headerLines;
  const alignmentClass = getReceiptAlignmentClass(settings?.header_alignment);
  const fontStyle = buildReceiptTextStyle(settings?.header_font_size, 18);

  return `
    <div class="receipt-header ${alignmentClass}" style="${fontStyle}">
      <div class="receipt-header-primary">${escapeHtml(primaryLine)}</div>
      ${
        secondaryLines.length > 0
          ? `<div class="receipt-header-secondary">${secondaryLines
              .map((line) => escapeHtml(line))
              .join("<br />")}</div>`
          : ""
      }
    </div>
  `;
}

function buildReceiptFooterHtml(settings) {
  if (!settings?.footer_enabled) {
    return "";
  }

  const footerHtml = buildReceiptMultilineHtml(settings.footer_text);

  if (!footerHtml) {
    return "";
  }

  return `
    <div class="divider"></div>
    <div class="receipt-footer-text ${getReceiptAlignmentClass(
      settings.footer_alignment,
    )}" style="${buildReceiptTextStyle(
      settings.footer_font_size,
      12,
    )}">${footerHtml}</div>
  `;
}

function getThermalSourceLabel() {
  if (typeof window === "undefined") {
    return "POS TERMINAL";
  }

  return String(window.location.hostname || "POS TERMINAL")
    .trim()
    .toUpperCase();
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

function getOrderStatusLabel(status) {
  if (status === "RUNNING_ORDER") {
    return "Running Order";
  }

  if (status === "OCCUPIED") {
    return "Occupied";
  }

  return "Vacant";
}

function getOrderStatusClass(status) {
  if (status === "RUNNING_ORDER") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "OCCUPIED") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-emerald-100 text-emerald-700";
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

function getPaymentBreakdownParts(cashPaid, cardPaid, upiPaid) {
  const parts = [];

  if (Number(upiPaid || 0) > 0) {
    parts.push(`UPI ${formatMoney(upiPaid)}`);
  }

  if (Number(cashPaid || 0) > 0) {
    parts.push(`Cash ${formatMoney(cashPaid)}`);
  }

  if (Number(cardPaid || 0) > 0) {
    parts.push(`Card ${formatMoney(cardPaid)}`);
  }

  return parts;
}

function buildSplitItemsByAmount(items, rawAmount) {
  const amount = Number(rawAmount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      items: [],
      allocatedTotal: 0,
    };
  }

  let remainingAmount = amount;
  const splitItems = [];

  items.forEach((item) => {
    if (remainingAmount <= 0) {
      return;
    }

    const unitPrice = Number(item.sale_price || 0);

    if (unitPrice <= 0) {
      return;
    }

    const maxQty = Math.min(
      item.qty,
      Math.floor((remainingAmount + 0.0001) / unitPrice),
    );

    if (maxQty <= 0) {
      return;
    }

    splitItems.push({
      ...item,
      qty: maxQty,
    });
    remainingAmount = Number((remainingAmount - unitPrice * maxQty).toFixed(2));
  });

  return {
    items: splitItems,
    allocatedTotal: splitItems.reduce(
      (sum, item) => sum + Number(item.sale_price || 0) * item.qty,
      0,
    ),
  };
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

function openPrintWindow(title, bodyHtml, mode = "receipt") {
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
          @page {
            size: 80mm auto;
            margin: 4mm 3mm;
          }
          html {
            background: #ffffff;
          }
          body {
            width: 72mm;
            margin: 0 auto;
            font-family: "Courier New", Courier, monospace;
            color: #111111;
            font-size: 12px;
            line-height: 1.3;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ticket {
            width: 100%;
          }
          .receipt,
          .receipt * {
            font-weight: 700;
          }
          .ticket + .ticket {
            margin-top: 14px;
            padding-top: 10px;
            border-top: 1px dashed #111111;
          }
          .center {
            text-align: center;
          }
          .align-left {
            text-align: left;
          }
          .align-center {
            text-align: center;
          }
          .align-right {
            text-align: right;
          }
          .brand {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .brand-sub {
            margin-top: 2px;
            text-align: center;
            font-size: 11px;
          }
          .receipt-logo {
            display: inline-block;
            margin: 0 0 6px;
            object-fit: contain;
          }
          .receipt-header {
            margin-bottom: 6px;
          }
          .receipt-header-primary {
            font-size: 1.15em;
            line-height: 1.25;
          }
          .receipt-header-secondary {
            margin-top: 2px;
            font-size: 0.8em;
            line-height: 1.45;
            white-space: pre-line;
          }
          .ticket-title {
            margin: 4px 0 6px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .token-order {
            margin: 4px 0 6px;
            font-size: 18px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .meta-row,
          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 2px 0;
            align-items: flex-start;
          }
          .meta-row span:first-child,
          .summary-row span:first-child {
            font-weight: 700;
          }
          .meta-row span:last-child,
          .summary-row span:last-child {
            text-align: right;
          }
          .divider {
            margin: 8px 0;
            border-top: 1px dashed #111111;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-table {
            table-layout: fixed;
          }
          .receipt-table th,
          .receipt-table td {
            padding: 3px 0;
            text-align: left;
            vertical-align: top;
          }
          .receipt-table th {
            text-transform: uppercase;
            border-bottom: 2px dashed #111111;
            padding-bottom: 5px;
          }
          .receipt-table.receipt-font--small th,
          .receipt-table.receipt-font--small td {
            font-size: 10px;
          }
          .receipt-table.receipt-font--medium th,
          .receipt-table.receipt-font--medium td {
            font-size: 12px;
          }
          .receipt-table.receipt-font--large th,
          .receipt-table.receipt-font--large td {
            font-size: 14px;
          }
          .receipt-compact-items {
            display: grid;
            gap: 3px;
          }
          .receipt-compact-head,
          .receipt-compact-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 12mm 18mm;
            gap: 8px;
            align-items: flex-start;
          }
          .receipt-compact-head {
            text-transform: uppercase;
            border-bottom: 2px dashed #111111;
            padding-bottom: 4px;
            margin-bottom: 2px;
          }
          .receipt-compact-head span:first-child,
          .receipt-compact-row span:first-child,
          .receipt-table .item-name {
            overflow: hidden;
            word-break: break-word;
          }
          .receipt-compact-head span:nth-child(2),
          .receipt-compact-row span:nth-child(2),
          .receipt-compact-head span:last-child,
          .receipt-compact-row span:last-child {
            text-align: right;
          }
          .right {
            text-align: right;
          }
          .summary-row.total {
            font-size: 1.08em;
          }
          .summary-row.total span:first-child,
          .summary-row.total span:last-child {
            font-weight: 700;
          }
          .token-item-head {
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .token,
          .token * {
            font-weight: 700;
          }
          .token-table-name {
            text-align: center;
            font-size: 24px;
            text-transform: uppercase;
            margin: 4px 0 10px;
            letter-spacing: 0.03em;
          }
          .token-line-head,
          .token-line {
            display: grid;
            grid-template-columns: 16mm minmax(0, 1fr);
            column-gap: 4px;
            align-items: start;
          }
          .token-line-head {
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .token-line {
            padding: 3px 0;
            font-size: 14px;
            text-transform: uppercase;
          }
          .token-qty {
            white-space: nowrap;
          }
          .token-name {
            word-break: break-word;
          }
          .receipt-footer-text {
            margin-top: 10px;
            font-weight: 700;
            white-space: pre-line;
            line-height: 1.45;
          }
          .small-note {
            margin-top: 6px;
            text-align: center;
            font-size: 11px;
            text-transform: uppercase;
          }
          .receipt-table .item-name {
            width: 58%;
          }
          .receipt-table .item-price {
            width: 26%;
          }
          .receipt-table .item-qty {
            width: 16%;
          }
          .token .ticket-title {
            margin-top: 0;
          }
        </style>
      </head>
      <body class="${escapeHtml(mode)}">${bodyHtml}</body>
    </html>
  `);
  printWindow.document.close();
  let hasPrinted = false;

  const printWhenReady = () => {
    if (hasPrinted) {
      return;
    }

    hasPrinted = true;
    printWindow.focus();
    printWindow.print();
  };

  const images = Array.from(printWindow.document.images || []);
  let pendingImages = 0;

  images.forEach((image) => {
    if (image.complete) {
      return;
    }

    pendingImages += 1;

    const handleImageDone = () => {
      pendingImages -= 1;

      if (pendingImages <= 0) {
        setTimeout(printWhenReady, 150);
      }
    };

    image.addEventListener("load", handleImageDone, { once: true });
    image.addEventListener("error", handleImageDone, { once: true });
  });

  if (pendingImages === 0) {
    setTimeout(printWhenReady, 250);
    return;
  }

  setTimeout(printWhenReady, 1600);
}

function buildTokenTicketHtml({
  tableLabel,
  orderNumber,
  updatedAt,
  senderLabel,
  items,
}) {
  return `
    <section class="ticket token">
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
        <div class="token-qty">QTY</div>
        <div class="token-name">ITEM</div>
      </div>
      <div class="divider"></div>
      ${items
        .map(
          (item) => `
            <div class="token-line">
              <div class="token-qty">${escapeHtml(item.qty)}X</div>
              <div class="token-name">${escapeHtml(item.item_name)}</div>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function BillingToolbarButton({
  label,
  onClick,
  disabled = false,
  accent = "sky",
  children,
}) {
  const accentClass =
    accent === "amber"
      ? "bg-amber-50 text-amber-600"
      : accent === "slate"
        ? "bg-slate-100 text-slate-700"
        : "bg-sky-50 text-sky-600";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-sky-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-md ${accentClass}`}
      >
        {children}
      </span>
    </button>
  );
}

export default function BillingPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const role = currentUser.role;
  const permissions = getRolePermissions(role);
  const location = useLocation();
  const { tableId } = useParams();
  const cashGivenInputRef = useRef(null);
  const liveSyncActionRef = useRef(() => {});
  const [tableInfo, setTableInfo] = useState(location.state?.table || null);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [cart, setCart] = useState([]);
  const [selectedCartItemId, setSelectedCartItemId] = useState(null);
  const [customerPaidInput, setCustomerPaidInput] = useState("");
  const [cashPaidInput, setCashPaidInput] = useState("");
  const [cardPaidInput, setCardPaidInput] = useState("");
  const [upiPaidInput, setUpiPaidInput] = useState("");
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
  const [autoKotEnabled, setAutoKotEnabled] = useState(
    () => localStorage.getItem("auto_kot_enabled") === "1",
  );
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [billPrintEnabled, setBillPrintEnabled] = useState(true);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [changePromptAmount, setChangePromptAmount] = useState(0);
  const [changeDialogAction, setChangeDialogAction] = useState("clear");
  const [showMoveOrderDialog, setShowMoveOrderDialog] = useState(false);
  const [moveTargetTableId, setMoveTargetTableId] = useState("");
  const [movingOrder, setMovingOrder] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferTargetTableId, setTransferTargetTableId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferringItem, setTransferringItem] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitMode, setSplitMode] = useState("item");
  const [splitAmountInput, setSplitAmountInput] = useState("");
  const [splitSelectedKeys, setSplitSelectedKeys] = useState([]);
  const [autoKotTrigger, setAutoKotTrigger] = useState(0);
  const hasLoadedSaleRef = useRef(false);
  const skipAutosaveRef = useRef(false);
  const lastSavedSignatureRef = useRef("");

  const focusCashGivenInput = () => {
    window.requestAnimationFrame(() => {
      cashGivenInputRef.current?.focus();
    });
  };

  const handleCustomerPaidInputChange = (event) => {
    const nextValue = event.target.value;

    if (nextValue === "" || nextValue === "0") {
      setCustomerPaidInput("");
      return;
    }

    setCustomerPaidInput(nextValue);
  };

  const handleCustomerPaidInputFocus = () => {
    if (!customerPaidInput) {
      cashGivenInputRef.current?.select();
    }
  };

  const handleCustomerPaidInputKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    openPaymentDialog();
  };

  const normalizeCustomerPaid = (value) => {
    if (value == null || String(value).trim() === "") {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isNaN(parsedValue) ? null : Math.max(parsedValue, 0);
  };

  const buildPayloadFromValues = (items, rawCustomerPaid) => ({
    items: items.map((item) => ({
      sale_item_id: item.sale_item_id,
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
    customer_paid:
      rawCustomerPaid == null || Number.isNaN(rawCustomerPaid)
        ? null
        : rawCustomerPaid,
  });

  const buildPayloadSignature = (items, rawCustomerPaid) =>
    JSON.stringify(buildPayloadFromValues(items, rawCustomerPaid));

  const buildSaleDataFromDraft = (draft) => {
    const items = Array.isArray(draft?.items)
      ? draft.items.map((item) => ({
          id: item.sale_item_id ?? null,
          product_id: item.product_id ?? null,
          item_name: item.item_name,
          unit_price: Number(item.unit_price || 0),
          qty: Number(item.qty || 0),
          tax_mode: item.tax_mode || "NO_TAX",
          printer_name: item.printer_name || null,
          printer_target: item.printer_target || null,
          created_by_user_id: item.created_by_user_id ?? null,
          created_by_username: item.created_by_username || null,
          line_total: Number(item.unit_price || 0) * Number(item.qty || 0),
          kot_printed_qty: 0,
          pending_qty: requiresKitchenToken(item) ? Number(item.qty || 0) : 0,
        }))
      : [];
    const units = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const pendingUnits = items.reduce(
      (sum, item) => sum + Number(item.pending_qty || 0),
      0,
    );
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
      customer_paid: draft?.customer_paid ?? null,
      lines: items.length,
      units,
      pending_units: pendingUnits,
      status: items.length > 0 ? "OCCUPIED" : "VACANT",
      subtotal: total,
      total,
      balance: null,
      items,
      created_at: draft?.updated_at || null,
      updated_at: draft?.updated_at || null,
    };
  };

  const writeLocalDraft = (items, rawCustomerPaid, tableContext, options = {}) => {
    const payload = buildPayloadFromValues(items, rawCustomerPaid);
    const hasDraft = payload.items.length > 0 || payload.customer_paid != null;

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
      payload_signature: buildPayloadSignature(items, rawCustomerPaid),
    });
  };

  const clearLocalDraft = (saleTableId = tableId) => {
    clearSaleDraft(saleTableId);
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
      }));
    }
  };

  const applySaleData = (saleData) => {
    const savedItems = (saleData.items || []).map(mapSaleItemToCartItem);
    const normalizedCustomerPaid = normalizeCustomerPaid(saleData.customer_paid);
    skipAutosaveRef.current = true;
    hasLoadedSaleRef.current = true;
    lastSavedSignatureRef.current = buildPayloadSignature(
      savedItems,
      normalizedCustomerPaid,
    );
    startTransition(() => {
      setCart(savedItems);
      setSelectedCartItemId((currentValue) => {
        if (savedItems.some((item) => item.cartKey === currentValue)) {
          return currentValue;
        }

        return savedItems[0]?.cartKey || null;
      });
      setCustomerPaidInput(
        saleData.customer_paid == null ? "" : String(saleData.customer_paid),
      );
      applySaleMeta(saleData);
    });
    writeLocalDraft(
      savedItems,
      normalizedCustomerPaid,
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

  const refreshBillingSale = async (options = {}) => {
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
    } catch (salesError) {
      console.warn("Saved sale endpoint unavailable", salesError);

      if (fallbackToLocal && localDraft) {
        applySaleData(buildSaleDataFromDraft(localDraft));
        return buildSaleDataFromDraft(localDraft);
      }

      if (!silent) {
        alert(getRequestErrorMessage(salesError, "Failed to load billing"));
      }

      return null;
    }
  };

  const buildLocalOnlySaleData = (items, rawCustomerPaid) =>
    buildSaleDataFromDraft({
      ...buildPayloadFromValues(items, rawCustomerPaid),
      table_name:
        currentTableRecord?.name ||
        location.state?.table?.name ||
        tableInfo?.name ||
        `Table ${tableId}`,
      floor_name:
        currentTableRecord?.floor ||
        location.state?.table?.floor ||
        tableInfo?.floor ||
        null,
      updated_at: new Date().toISOString(),
    });

  const buildFloorViewState = () => ({
    selectedFloorId: currentTableRecord?.floor_id
      ? String(currentTableRecord.floor_id)
      : undefined,
    selectedTableId: currentTableRecord?.id
      ? String(currentTableRecord.id)
      : String(tableId),
  });

  const loadBillingData = async () => {
    try {
      setLoading(true);
      hasLoadedSaleRef.current = false;

      const [productsResponse, tablesResponse] = await Promise.all([
        axios.get(`${API}/stock/products`),
        axios.get(`${API}/tables`),
      ]);

      const matchedTable =
        tablesResponse.data.find(
          (table) => String(table.id) === String(tableId),
        ) || null;
      startTransition(() => {
        // Products already come back ordered from the backend.
        setProducts(productsResponse.data || []);
        setTables(tablesResponse.data || []);

        if (matchedTable) {
          setTableInfo(matchedTable);
        } else if (location.state?.table) {
          setTableInfo(location.state.table);
        }
      });

      const refreshedSale = await refreshBillingSale({
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
      alert("Failed to load billing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [tableId]);

  useEffect(() => {
    if (cart.length === 0) {
      if (selectedCartItemId !== null) {
        setSelectedCartItemId(null);
      }
      return;
    }

    const hasSelectedItem = cart.some(
      (item) => item.cartKey === selectedCartItemId,
    );

    if (!hasSelectedItem) {
      setSelectedCartItemId(cart[0].cartKey);
    }
  }, [cart, selectedCartItemId]);

  const deferredSearch = useDeferredValue(search);
  const normalizedProductSearch = deferredSearch.trim().toLowerCase();
  const categories = [
    "ALL",
    ...new Set(products.map((product) => product.category_name).filter(Boolean)),
  ];
  const visibleCategories = categories.filter((category) => category !== "ALL");

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      normalizedProductSearch.length === 0 ||
      product.name.toLowerCase().includes(normalizedProductSearch);
    const matchesCategory =
      categoryFilter === "ALL" || product.category_name === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const selectedCartItem =
    cart.find((item) => item.cartKey === selectedCartItemId) || null;
  const getPrintedTokenQty = (item) => Number(item?.kot_printed_qty || 0);
  const hasPrintedTokenLock = (item) => getPrintedTokenQty(item) > 0;
  const getPrintedTokenLockMessage = (item) =>
    `${item?.name || "This item"} already sent to token. You can add more quantity, but you cannot reduce or delete the printed quantity. Finalize the bill instead.`;
  const canManageCartItem = (item) => {
    if (!item || !permissions.addItems) {
      return false;
    }

    if (role === "WAITER") {
      return isLineOwnedByUser(item, currentUser);
    }

    return true;
  };
  const canModifySelectedLine = canManageCartItem(selectedCartItem);
  const canDecreaseSelectedLine =
    canModifySelectedLine &&
    Number(selectedCartItem?.qty || 0) > getPrintedTokenQty(selectedCartItem);
  const canDeleteSelectedLine =
    canModifySelectedLine && !hasPrintedTokenLock(selectedCartItem);
  const showPaymentPanel = permissions.receivePayment;
  const showCatalog = permissions.addItems;

  useEffect(() => {
    localStorage.setItem("auto_kot_enabled", autoKotEnabled ? "1" : "0");
  }, [autoKotEnabled]);

  const addToCart = (product) => {
    if (!permissions.addItems) {
      alert("You do not have permission to add items");
      return;
    }

    const quantityToAdd = getCalculatorStepValue();
    const nextItem = mapProductToCartItem(product, currentUser);
    setSelectedCartItemId(nextItem.cartKey);

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.cartKey === nextItem.cartKey,
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.cartKey === nextItem.cartKey
            ? {
                ...item,
                qty: item.qty + quantityToAdd,
                pending_qty: requiresKitchenToken(item)
                  ? Math.max(
                      item.qty + quantityToAdd - Number(item.kot_printed_qty || 0),
                      0,
                    )
                  : 0,
              }
            : item,
        );
      }

      return [
        ...currentCart,
        {
          ...nextItem,
          qty: quantityToAdd,
          pending_qty: requiresKitchenToken(nextItem) ? quantityToAdd : 0,
        },
      ];
    });

    if (autoKotEnabled && requiresKitchenToken(nextItem)) {
      setAutoKotTrigger((currentValue) => currentValue + 1);
    }

    clearCalculatorInput();
    focusCashGivenInput();
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
      alert(
        role === "WAITER"
          ? "Waiter can edit only own line items"
          : "You do not have permission to change line items",
      );
      return;
    }

    if (change < 0 && Number(currentItem.qty || 0) <= getPrintedTokenQty(currentItem)) {
      alert(getPrintedTokenLockMessage(currentItem));
      return;
    }

    setCartItemQuantity(itemKey, currentItem.qty + change);

    if (change > 0 && autoKotEnabled && requiresKitchenToken(currentItem)) {
      setAutoKotTrigger((currentValue) => currentValue + 1);
    }
  };

  const removeSelectedLine = () => {
    if (!selectedCartItem) {
      return;
    }

    if (!canManageCartItem(selectedCartItem)) {
      alert(
        role === "WAITER"
          ? "Waiter can delete only own line items"
          : "You do not have permission to delete this line",
      );
      return;
    }

    if (hasPrintedTokenLock(selectedCartItem)) {
      alert(getPrintedTokenLockMessage(selectedCartItem));
      return;
    }

    setCart((currentCart) =>
      currentCart.filter((item) => item.cartKey !== selectedCartItem.cartKey),
    );
  };

  const clearBill = async (navigateToFloor = false) => {
    if (!permissions.clearOpenOrder) {
      alert("Only admin can clear an open order");
      return false;
    }

    if (
      cart.length > 0 &&
      !window.confirm("Do you want to clear this table order?")
    ) {
      return false;
    }

    try {
      setBusyAction("clear-table");
      const response = await axios.post(`${API}/sales/table/${tableId}`, {
        items: [],
        customer_paid: null,
      });

      if (response.data.error) {
        alert(response.data.error);
        return false;
      }

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
      clearLocalDraft();

      if (navigateToFloor) {
        navigate("/billing");
      }

      return true;
    } catch (error) {
      console.error(error);
      alert("Failed to clear table");
      return false;
    } finally {
      setBusyAction("");
    }
  };

  const checkoutBill = async (options = {}) => {
    try {
      setBusyAction("checkout");
      const checkoutItems =
        Array.isArray(options.items) && options.items.length > 0
          ? options.items
          : cart;
      const paymentBreakdown = options.paymentBreakdown || {};
      const response = await axios.post(`${API}/sales/table/${tableId}/checkout`, {
        items: buildPayloadFromValues(checkoutItems, customerPaidValue).items,
        customer_paid:
          options.customerPaid == null ? customerPaidValue : options.customerPaid,
        payment_method: options.paymentMethod || "CASH",
        print_enabled: options.printEnabled !== false,
        cash_paid:
          paymentBreakdown.cashPaid == null ? null : paymentBreakdown.cashPaid,
        card_paid:
          paymentBreakdown.cardPaid == null ? null : paymentBreakdown.cardPaid,
        upi_paid:
          paymentBreakdown.upiPaid == null ? null : paymentBreakdown.upiPaid,
      });

      if (response.data.error) {
        alert(response.data.error);
        return null;
      }

      clearLocalDraft();
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
    } catch (error) {
      console.error(error);
      alert("Failed to finalize bill");
      return null;
    } finally {
      setBusyAction("");
    }
  };

  const appendCustomerPaidInput = (value) => {
    setCustomerPaidInput((currentValue) => {
      if (value === "." && currentValue.includes(".")) {
        return currentValue;
      }

      if (currentValue === "0" && value !== ".") {
        return value;
      }

      return `${currentValue}${value}`;
    });

    focusCashGivenInput();
  };

  const clearCalculatorInput = () => {
    setCustomerPaidInput("");
  };

  const getCalculatorStepValue = () => {
    const parsedValue = Math.floor(Number(customerPaidInput || 0));
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1;
  };

  const applySelectedLineQuantityChange = (direction) => {
    if (!selectedCartItem) {
      return;
    }

    updateQty(selectedCartItem.cartKey, getCalculatorStepValue() * direction);
    clearCalculatorInput();
  };

  const customerPaidValue = normalizeCustomerPaid(customerPaidInput);
  const displayedCustomerPaidInput =
    customerPaidInput === "" ? "0" : customerPaidInput;
  const cashPaidValue = normalizeCustomerPaid(cashPaidInput) ?? 0;
  const cardPaidValue = normalizeCustomerPaid(cardPaidInput) ?? 0;
  const upiPaidValue = normalizeCustomerPaid(upiPaidInput) ?? 0;
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.sale_price || 0) * item.qty,
    0,
  );
  const paymentDialogTotalPaid = Number(
    (cashPaidValue + cardPaidValue + upiPaidValue).toFixed(2),
  );
  const paymentDialogBalance = Number(
    (paymentDialogTotalPaid - subtotal).toFixed(2),
  );
  const resolvedPaymentMethod = getResolvedPaymentMethod(
    cashPaidValue,
    cardPaidValue,
    upiPaidValue,
  );
  const paymentBreakdownParts = getPaymentBreakdownParts(
    cashPaidValue,
    cardPaidValue,
    upiPaidValue,
  );
  const totalUnits = cart.reduce((sum, item) => sum + item.qty, 0);
  const balance =
    customerPaidValue == null || Number.isNaN(customerPaidValue)
      ? null
      : Number((customerPaidValue - subtotal).toFixed(2));
  const calculatorBalanceAmount =
    balance == null ? subtotal : Math.abs(balance);
  const currentTableName = tableInfo?.name || `Table ${tableId}`;
  const availableTables = tables.filter(
    (table) => String(table.id) !== String(tableId),
  );
  const currentTableRecord =
    tables.find((table) => String(table.id) === String(tableId)) || tableInfo;
  const localPendingUnits = cart.reduce(
    (sum, item) => sum + Number(item.pending_qty || 0),
    0,
  );
  const summaryTaxValue = cart.some((item) => item.tax_mode === "GST_INCLUDED")
    ? "Included"
    : "No Tax";
  const displayedOrderStatus =
    cart.length === 0 ? "VACANT" : "OCCUPIED";
  const splitItemsBySelection = cart.filter((item) =>
    splitSelectedKeys.includes(item.cartKey),
  );
  const splitAmountResult = buildSplitItemsByAmount(cart, splitAmountInput);
  const splitPreviewItems =
    splitMode === "item" ? splitItemsBySelection : splitAmountResult.items;
  const splitPreviewTotal =
    splitMode === "item"
      ? splitItemsBySelection.reduce(
          (sum, item) => sum + Number(item.sale_price || 0) * item.qty,
          0,
        )
      : splitAmountResult.allocatedTotal;
  const productCartQtyById = cart.reduce((accumulator, item) => {
    if (!item.product_id) {
      return accumulator;
    }

    accumulator[item.product_id] =
      (accumulator[item.product_id] || 0) + Number(item.qty || 0);
    return accumulator;
  }, {});

  useEffect(() => {
    if (
      loading ||
      showPaymentDialog ||
      showChangeDialog ||
      showMoveOrderDialog ||
      showTransferDialog ||
      showSplitDialog
    ) {
      return undefined;
    }

    const handleBillingKeyboard = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;
      const tagName = target?.tagName;

      if (
        target?.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      ) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendCustomerPaidInput(event.key);
        return;
      }

      if (event.key === ".") {
        event.preventDefault();
        appendCustomerPaidInput(".");
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setCustomerPaidInput((currentValue) => currentValue.slice(0, -1));
        return;
      }

      if (event.key === "Delete" || event.key === "Escape") {
        event.preventDefault();
        clearCalculatorInput();
        return;
      }

      if (event.key === "+") {
        event.preventDefault();
        applySelectedLineQuantityChange(1);
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        applySelectedLineQuantityChange(-1);
        return;
      }

      if (event.key === "=" || event.key === "Enter") {
        event.preventDefault();
        openPaymentDialog();
      }
    };

    window.addEventListener("keydown", handleBillingKeyboard);

    return () => {
      window.removeEventListener("keydown", handleBillingKeyboard);
    };
  }, [
    loading,
    showPaymentDialog,
    showChangeDialog,
    showMoveOrderDialog,
    showTransferDialog,
    showSplitDialog,
    customerPaidInput,
    selectedCartItem?.cartKey,
    selectedCartItem?.qty,
    canModifySelectedLine,
    canDecreaseSelectedLine,
    busyAction,
    subtotal,
  ]);

  useEffect(() => {
    if (!hasLoadedSaleRef.current) {
      return;
    }

    if (skipAutosaveRef.current) {
      return;
    }

    writeLocalDraft(
      cart,
      customerPaidValue,
      currentTableRecord || location.state?.table || tableInfo,
      {
        pendingSync: true,
      },
    );
  }, [
    cart,
    customerPaidValue,
    tableId,
    currentTableRecord?.id,
    currentTableRecord?.name,
    currentTableRecord?.floor,
    tableInfo?.name,
    tableInfo?.floor,
  ]);

  const hasPendingLocalChanges = () => {
    if (!hasLoadedSaleRef.current) {
      return false;
    }

    const rawInput = customerPaidInput.trim();

    if (rawInput && customerPaidValue == null) {
      return true;
    }

    return buildPayloadSignature(cart, customerPaidValue) !== lastSavedSignatureRef.current;
  };

  liveSyncActionRef.current = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    if (
      busyAction ||
      movingOrder ||
      showPaymentDialog ||
      showMoveOrderDialog ||
      showTransferDialog ||
      showSplitDialog ||
      hasPendingLocalChanges()
    ) {
      return;
    }

    refreshBillingSale({ silent: true, fallbackToLocal: false });
  };

  const persistSale = async (actionLabel, options = {}) => {
    const resolvedCustomerPaid = Object.prototype.hasOwnProperty.call(
      options,
      "rawCustomerPaidOverride",
    )
      ? options.rawCustomerPaidOverride
      : customerPaidValue;
    const payload = buildPayloadFromValues(cart, resolvedCustomerPaid);
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
        clearLocalDraft();
        applySaleData({
          id: null,
          order_number: null,
          items: [],
          customer_paid: null,
          updated_at: null,
          created_at: null,
        });

        if (options.showMessage) {
          alert("Sale cleared");
        }

        return response.data;
      }

      lastSavedSignatureRef.current = payloadSignature;
      setAutosaveStatus("saved");
      applySaleData(response.data);

      if (options.showMessage) {
        alert("Sale saved");
      }

      return response.data;
    } catch (error) {
      console.error(error);
      setAutosaveStatus("error");
      writeLocalDraft(
        cart,
        resolvedCustomerPaid,
        currentTableRecord || location.state?.table || tableInfo,
        {
          pendingSync: true,
        },
      );

      if (options.allowLocalFallback) {
        return {
          ...buildLocalOnlySaleData(cart, resolvedCustomerPaid),
          local_only: true,
        };
      }

      if (!options.suppressErrorAlert) {
        alert(getRequestErrorMessage(error, "Failed to save sale"));
      }
      return null;
    } finally {
      setBusyAction("");
    }
  };

  useEffect(() => {
    if (!hasLoadedSaleRef.current || loading || busyAction || movingOrder) {
      return undefined;
    }

    const rawInput = customerPaidInput.trim();

    if (rawInput && customerPaidValue == null) {
      return undefined;
    }

    const payloadSignature = buildPayloadSignature(cart, customerPaidValue);

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
          buildPayloadFromValues(cart, customerPaidValue),
        );

        if (response.data.error) {
          setAutosaveStatus("error");
          return;
        }

        lastSavedSignatureRef.current = payloadSignature;

        if (response.data.message === "Sale cleared") {
          clearLocalDraft();
          setSaleMeta({
            id: null,
            order_number: null,
            updated_at: null,
            created_at: null,
            status: "VACANT",
            pending_units: 0,
          });
        } else {
          applySaleMeta(response.data);
          writeLocalDraft(
            cart,
            customerPaidValue,
            currentTableRecord || location.state?.table || tableInfo,
            {
              orderNumber: response.data.order_number || saleMeta.order_number || null,
              updatedAt: response.data.updated_at || new Date().toISOString(),
              serverUpdatedAt: response.data.updated_at || null,
              pendingSync: false,
            },
          );
        }

        setAutosaveStatus("saved");
      } catch (error) {
        console.error(error);
        setAutosaveStatus("error");
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [
    cart,
    customerPaidInput,
    customerPaidValue,
    loading,
    busyAction,
    movingOrder,
    tableId,
  ]);

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

    const syncBillingFromServer = () => liveSyncActionRef.current();

    const intervalId = window.setInterval(syncBillingFromServer, 4000);
    window.addEventListener("focus", syncBillingFromServer);
    document.addEventListener("visibilitychange", syncBillingFromServer);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncBillingFromServer);
      document.removeEventListener("visibilitychange", syncBillingFromServer);
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

  useEffect(() => {
    if (loading || showPaymentDialog) {
      return;
    }

    focusCashGivenInput();
  }, [loading, showPaymentDialog, tableId]);

  const printBillDocument = (title, items, options = {}) => {
    const linesTotal = items.reduce(
      (sum, item) => sum + Number(item.sale_price || 0) * item.qty,
      0,
    );
    const receiptSettings = readStoredReceiptSettings();
    const receiptTitle =
      title === "Final Bill"
        ? "Receipt"
        : title === "Split Bill"
          ? "Split Bill"
          : title || "Receipt";
    const billLabel = options.billNumber || "-";
    const tableLabel = options.tableName || currentTableName;
    const titleHtml = receiptSettings.title_enabled
      ? `<div class="ticket-title" style="${buildReceiptTextStyle(
          receiptSettings.title_font_size,
          18,
        )}">${escapeHtml(receiptTitle)}</div>`
      : "";
    const logoHtml =
      receiptSettings.logo_enabled && receiptSettings.logo_image
        ? `
            <div class="${getReceiptAlignmentClass(
              receiptSettings.logo_alignment,
            )}">
              <img
                src="${escapeHtml(receiptSettings.logo_image)}"
                alt="Logo"
                class="receipt-logo"
                style="${getReceiptLogoStyle(receiptSettings.logo_width)}"
              />
            </div>
          `
        : "";
    const headerHtml = buildReceiptHeaderHtml(receiptSettings);
    const footerHtml = buildReceiptFooterHtml(receiptSettings);
    const detailsHtml = receiptSettings.details_enabled
      ? `
          <div style="${buildReceiptTextStyle(
            receiptSettings.details_font_size,
            12,
          )}">
            <div class="meta-row"><span>Receipt:</span><span>${escapeHtml(
              billLabel,
            )}</span></div>
            <div class="meta-row"><span>Date:</span><span>${escapeHtml(
              formatThermalDateTime(options.updatedAt || new Date()),
            )}</span></div>
            <div class="meta-row"><span>Table:</span><span>${escapeHtml(
              tableLabel,
            )}</span></div>
          </div>
        `
      : "";
    const itemSectionHtml =
      receiptSettings.item_layout === "DETAILED"
      ? `
            <table class="receipt-table" style="${buildReceiptTextStyle(
              receiptSettings.item_font_size,
              13,
            )}">
              <colgroup>
                <col style="width:58%" />
                <col style="width:16%" />
                <col style="width:26%" />
              </colgroup>
              <thead>
                <tr>
                  <th class="item-name">ITEM</th>
                  <th class="item-qty right">QTY</th>
                  <th class="item-price right">PRICE</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                      <tr>
                        <td class="item-name">${escapeHtml(item.name)}</td>
                        <td class="item-qty right">${escapeHtml(item.qty)}</td>
                        <td class="item-price right">${escapeHtml(
                          formatMoney(Number(item.sale_price || 0) * Number(item.qty || 0)),
                        )}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          `
        : `
            <div class="receipt-compact-items" style="${buildReceiptTextStyle(
              receiptSettings.item_font_size,
              13,
            )}">
              <div class="receipt-compact-head">
                <span>ITEM</span>
                <span>QTY</span>
                <span>PRICE</span>
              </div>
              ${items
                .map(
                  (item) => `
                    <div class="receipt-compact-row">
                      <span>${escapeHtml(item.name)}</span>
                      <span>${escapeHtml(item.qty)}</span>
                      <span>${escapeHtml(
                        formatMoney(Number(item.sale_price || 0) * Number(item.qty || 0)),
                      )}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `;
    const summaryHtml = `
      <div class="receipt-summary" style="${buildReceiptTextStyle(
        receiptSettings.summary_font_size,
        14,
      )}">
        <div class="summary-row total"><span>Total</span><span>${escapeHtml(
          formatMoney(linesTotal),
        )}</span></div>
      </div>
    `;

    const bodyHtml = `
      <section class="ticket receipt">
        ${logoHtml}
        ${headerHtml}
        ${titleHtml}
        ${detailsHtml}
        <div class="divider"></div>
        ${itemSectionHtml}
        <div class="divider"></div>
        ${summaryHtml}
        ${footerHtml}
      </section>
    `;

    openPrintWindow(title, bodyHtml, "receipt");
  };

  const printKitchenOrderTicket = async (manual = true) => {
    if (!permissions.printKitchenTicket) {
      if (manual) {
        alert("You do not have permission to print kitchen tickets");
      }
      return;
    }

    if (cart.length === 0) {
      if (manual) {
        alert("Add items before printing KOT");
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
        currentCart.map((item) => ({
          ...item,
          kot_printed_qty: item.qty,
          pending_qty: 0,
        })),
      );
      setSaleMeta((currentValue) => ({
        ...currentValue,
        updated_at: response.data.updated_at || currentValue.updated_at,
        status: response.data.status || "OCCUPIED",
        pending_units: 0,
      }));

      const tableLabel = formatThermalOrderLabel(
        response.data.table_name || currentTableName,
      );
      const orderNumber = formatThermalOrderNumber(
        savedSale?.order_number ||
          response.data.order_number ||
          saleMeta.order_number ||
          savedSale?.id ||
          saleMeta.id ||
          response.data.table_id ||
          tableId,
      );

      if (response.data.system_printed) {
        return;
      }

      const printerGroups =
        Array.isArray(response.data.printer_groups) && response.data.printer_groups.length > 0
          ? response.data.printer_groups
          : [
              {
                printer_name: "",
                items: response.data.items || [],
              },
            ];
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

      openPrintWindow("Kitchen Order Ticket", bodyHtml, "token");
    } catch (error) {
      console.error(error);
      if (manual) {
        alert(getRequestErrorMessage(error, "Failed to print KOT"));
      }
    }
  };

  useEffect(() => {
    if (
      !permissions.printKitchenTicket ||
      !permissions.toggleAutoKot ||
      !autoKotEnabled ||
      autoKotTrigger === 0 ||
      loading ||
      busyAction ||
      movingOrder ||
      transferringItem
    ) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setAutoKotTrigger(0);
      printKitchenOrderTicket(false);
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [
    autoKotEnabled,
    autoKotTrigger,
    loading,
    busyAction,
    movingOrder,
    transferringItem,
    permissions.printKitchenTicket,
    permissions.toggleAutoKot,
  ]);

  const openPaymentDialog = () => {
    if (!permissions.receivePayment) {
      alert("You do not have permission to open the payment screen");
      return;
    }

    if (cart.length === 0) {
      alert("Add items before printing bill");
      return;
    }

    setCashPaidInput("");
    setCardPaidInput("");
    setUpiPaidInput("");
    setBillPrintEnabled(true);
    setShowPaymentDialog(true);
  };

  const applyFullAmountToPaymentMethod = (method) => {
    const totalAmount = formatMoney(subtotal);

    setCashPaidInput(method === "CASH" ? totalAmount : "");
    setCardPaidInput(method === "CARD" ? totalAmount : "");
    setUpiPaidInput(method === "UPI" ? totalAmount : "");
  };

  const sendBillToMainPrinter = async (billId) => {
    try {
      const response = await axios.post(`${API}/sales/bills/${billId}/print`);

      if (response.data?.error) {
        return {
          ok: false,
          message: response.data.error,
        };
      }

      return {
        ok: Boolean(response.data?.system_printed),
        message: "",
      };
    } catch (error) {
      console.error(error);
      return {
        ok: false,
        message: getRequestErrorMessage(error, "Failed to send bill to main printer"),
      };
    }
  };

  const printBill = async (options = {}) => {
    const effectiveCustomerPaid = Object.prototype.hasOwnProperty.call(
      options,
      "rawCustomerPaidOverride",
    )
      ? options.rawCustomerPaidOverride
      : customerPaidValue;
    const paymentBreakdown = options.paymentBreakdown || {};

    if (cart.length === 0) {
      alert("Add items before printing bill");
      return null;
    }

    const billItems = cart.map((item) => ({ ...item }));
    const tableNameSnapshot = currentTableName;
    const floorNameSnapshot = tableInfo?.floor || "-";
    const completedBill = await checkoutBill({
      items: billItems,
      customerPaid: effectiveCustomerPaid,
      paymentMethod: options.paymentMethod,
      paymentBreakdown,
      printEnabled: options.printEnabled,
    });

    if (!completedBill || completedBill.error) {
      return null;
    }

    if (options.printEnabled !== false) {
      const mainPrinterResult = await sendBillToMainPrinter(completedBill.id);

      if (!mainPrinterResult.ok) {
        if (mainPrinterResult.message) {
          alert(`${mainPrinterResult.message}. Opening browser print preview instead.`);
        }

        printBillDocument("Final Bill", billItems, {
          updatedAt: completedBill.created_at,
          customerPaid: completedBill.customer_paid ?? effectiveCustomerPaid,
          paymentMethod: completedBill.payment_method || options.paymentMethod,
          cashPaid: completedBill.cash_paid,
          cardPaid: completedBill.card_paid,
          upiPaid: completedBill.upi_paid,
          billNumber: completedBill.bill_number,
          tableName: tableNameSnapshot,
          floorName: floorNameSnapshot,
        });
      }
    }

    return completedBill;
  };

  const confirmPaymentDialog = async () => {
    if (!permissions.receivePayment) {
      alert("You do not have permission to receive payment");
      return;
    }

    if (paymentDialogTotalPaid <= 0 && subtotal > 0) {
      alert("Enter payment amount before saving bill");
      return;
    }

    if (paymentDialogTotalPaid < subtotal) {
      alert("Total payment is less than bill total");
      return;
    }

    const savedSale = await printBill({
      rawCustomerPaidOverride: paymentDialogTotalPaid,
      paymentMethod: resolvedPaymentMethod,
      paymentBreakdown: {
        cashPaid: cashPaidValue,
        cardPaid: cardPaidValue,
        upiPaid: upiPaidValue,
      },
      printEnabled: billPrintEnabled,
      skipClosePrompt: true,
    });

    if (!savedSale) {
      return;
    }

    setCustomerPaidInput(cashPaidValue > 0 ? String(cashPaidValue) : "");
    setCashPaidInput("");
    setCardPaidInput("");
    setUpiPaidInput("");
    setShowPaymentDialog(false);

    const changeAmount = Number((paymentDialogTotalPaid - subtotal).toFixed(2));

    setChangeDialogAction("return");

    if (changeAmount > 0) {
      setChangePromptAmount(changeAmount);
      setShowChangeDialog(true);
      return;
    }

    navigate("/billing", { state: buildFloorViewState() });
  };

  const confirmChangePrompt = async () => {
    setShowChangeDialog(false);

    if (changeDialogAction === "return") {
      navigate("/billing", { state: buildFloorViewState() });
      return;
    }

    await clearBill(true);
  };

  const saveAndReturnToFloor = () => {
    const payloadSignature = buildPayloadSignature(cart, customerPaidValue);
    const floorViewState = buildFloorViewState();

    writeLocalDraft(
      cart,
      customerPaidValue,
      currentTableRecord || location.state?.table || tableInfo,
      {
        pendingSync: true,
      },
    );

    if (payloadSignature === lastSavedSignatureRef.current) {
      navigate("/billing", { state: floorViewState });
      return;
    }

    void axios
      .post(`${API}/sales/table/${tableId}`, buildPayloadFromValues(cart, customerPaidValue))
      .then((response) => {
        if (response.data?.error) {
          console.warn("Background sale save returned an error", response.data.error);
          return;
        }

        lastSavedSignatureRef.current = payloadSignature;

        if (response.data?.message === "Sale cleared") {
          clearLocalDraft();
        }
      })
      .catch((error) => {
        console.error("Background sale save failed", error);
      });

    navigate("/billing", { state: floorViewState });
  };

  const openMoveOrderDialog = () => {
    if (!permissions.moveTable) {
      alert("You do not have permission to move tables");
      return;
    }

    if (cart.length === 0) {
      alert("Add items before moving order");
      return;
    }

    setMoveTargetTableId("");
    setShowMoveOrderDialog(true);
  };

  const transferSelectedItem = async () => {
    if (!permissions.transferItems) {
      alert("Only admin can transfer items between tables");
      return;
    }

    if (!selectedCartItem) {
      alert("Select a line item first");
      return;
    }

    if (!transferTargetTableId) {
      alert("Select another table");
      return;
    }

    const quantityToTransfer = Number(transferQty);

    if (!Number.isFinite(quantityToTransfer) || quantityToTransfer <= 0) {
      alert("Enter valid quantity");
      return;
    }

    try {
      setTransferringItem(true);

      const savedSale = await persistSale("transfer-item", { showMessage: false });

      if (!savedSale || savedSale.error) {
        return;
      }

      const response = await axios.post(`${API}/sales/table/${tableId}/transfer`, {
        target_table_id: Number(transferTargetTableId),
        product_id: selectedCartItem.product_id,
        item_name: selectedCartItem.name,
        qty: Math.min(quantityToTransfer, selectedCartItem.qty),
        created_by_user_id: selectedCartItem.created_by_user_id ?? null,
        created_by_username: selectedCartItem.created_by_username || null,
      });

      if (response.data.error) {
        alert(response.data.error);
        return;
      }

      applySaleData(response.data.source_sale);
      setShowTransferDialog(false);
      alert("Selected items transferred");
    } catch (error) {
      console.error(error);
      alert("Failed to transfer items");
    } finally {
      setTransferringItem(false);
    }
  };

  const openSplitBillDialog = () => {
    if (!permissions.splitBill) {
      alert("You do not have permission to split bills");
      return;
    }

    if (cart.length === 0) {
      alert("Add items before splitting bill");
      return;
    }

    setSplitMode("item");
    setSplitAmountInput("");
    setSplitSelectedKeys(
      selectedCartItem ? [selectedCartItem.cartKey] : cart.map((item) => item.cartKey),
    );
    setShowSplitDialog(true);
  };

  const toggleSplitSelection = (itemKey) => {
    setSplitSelectedKeys((currentValue) =>
      currentValue.includes(itemKey)
        ? currentValue.filter((value) => value !== itemKey)
        : [...currentValue, itemKey],
    );
  };

  const printSplitBill = () => {
    if (!permissions.splitBill) {
      alert("You do not have permission to split bills");
      return;
    }

    if (splitPreviewItems.length === 0) {
      alert("Select items or enter amount for split bill");
      return;
    }

    printBillDocument("Split Bill", splitPreviewItems, {
      showPayment: false,
    });
  };

  const moveOrderToAnotherTable = async () => {
    if (!permissions.moveTable) {
      alert("You do not have permission to move tables");
      return;
    }

    if (!moveTargetTableId) {
      alert("Select another table");
      return;
    }

    const targetTable =
      availableTables.find(
        (table) => String(table.id) === String(moveTargetTableId),
      ) || null;
    const targetTableName = targetTable?.name || `Table ${moveTargetTableId}`;

    if (!window.confirm(`Do you want to move order to another table: ${targetTableName}?`)) {
      return;
    }

    try {
      setMovingOrder(true);

      const savedSale = await persistSale("move-order", { showMessage: false });

      if (!savedSale || savedSale.error) {
        return;
      }

      const response = await axios.post(`${API}/sales/table/${tableId}/move`, {
        target_table_id: Number(moveTargetTableId),
      });

      if (response.data.error) {
        alert(response.data.error);
        return;
      }

      alert(`Order moved to ${targetTableName}`);
      setShowMoveOrderDialog(false);
      navigate(`/billing/table/${moveTargetTableId}`, {
        state: {
          table: targetTable,
        },
      });
    } catch (error) {
      console.error(error);
      alert("Failed to move order");
    } finally {
      setMovingOrder(false);
    }
  };

  return (
    <AppSidebarLayout
      role={role}
      currentPage="sale-billing"
      onRefresh={loadBillingData}
    >
      <div className="flex flex-col gap-1.5 xl:min-h-[calc(100dvh-7.9rem)]">
      <div className="shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">
              Register
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-base font-bold text-slate-900">
                {currentTableName}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getOrderStatusClass(
                  displayedOrderStatus,
                )}`}
              >
                {getOrderStatusLabel(displayedOrderStatus)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>{tableInfo?.floor ? `Floor ${tableInfo.floor}` : "No Floor"}</span>
              <span>Sale ID: {saleMeta.id || "New"}</span>
              <span>Updated: {saleMeta.updated_at || "Not saved yet"}</span>
              <span>Auto Save: {autosaveStatus === "saving" ? "Saving..." : autosaveStatus === "saved" ? "Saved" : autosaveStatus === "error" ? "Error" : "Ready"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5">
              Lines
              <div className="mt-1 text-sm font-bold text-slate-900">{cart.length}</div>
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5">
              Units
              <div className="mt-1 text-sm font-bold text-slate-900">{totalUnits}</div>
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5">
              Pending
              <div className="mt-1 text-sm font-bold text-slate-900">{localPendingUnits}</div>
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5">
              Paid
              <div className="mt-1 text-sm font-bold text-slate-900">
                {customerPaidValue == null ? "-" : formatMoney(customerPaidValue)}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <BillingToolbarButton
                label={busyAction === "go-floor" ? "Opening" : "Table Plan"}
                onClick={saveAndReturnToFloor}
                disabled={busyAction !== ""}
              >
                <FiGrid className="h-5 w-5" />
              </BillingToolbarButton>
              {permissions.printKitchenTicket && (
                <BillingToolbarButton
                  label={busyAction === "kitchen" ? "Saving" : "Token Print"}
                  onClick={() => printKitchenOrderTicket(true)}
                  disabled={busyAction !== ""}
                  accent="amber"
                >
                  <FiPrinter className="h-5 w-5" />
                </BillingToolbarButton>
              )}
              {permissions.moveTable && (
                <BillingToolbarButton
                  label="Move Table"
                  onClick={openMoveOrderDialog}
                  disabled={busyAction !== "" || movingOrder}
                  accent="slate"
                >
                  <FiMove className="h-5 w-5" />
                </BillingToolbarButton>
              )}
              {permissions.splitBill && (
                <BillingToolbarButton
                  label="Split Bill"
                  onClick={openSplitBillDialog}
                  disabled={busyAction !== ""}
                  accent="amber"
                >
                  <FiScissors className="h-5 w-5" />
                </BillingToolbarButton>
              )}
              {showCatalog && (
                <button
                  onClick={removeSelectedLine}
                  disabled={!canDeleteSelectedLine}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Delete Line
                </button>
              )}
              {permissions.receivePayment && (
                <button
                  onClick={openPaymentDialog}
                  disabled={busyAction !== ""}
                  className="rounded-lg border border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {busyAction === "bill" ? "Printing..." : "Payment"}
                </button>
              )}
              <button
                onClick={() => clearBill(false)}
                disabled={busyAction !== "" || !permissions.clearOpenOrder}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {busyAction === "clear-table" ? "Clearing..." : "Clear Table"}
              </button>
            </div>
            {permissions.toggleAutoKot && (
              <button
                onClick={() => setAutoKotEnabled((currentValue) => !currentValue)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm ${
                  autoKotEnabled
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
              >
                {autoKotEnabled ? (
                  <FiToggleRight className="h-5 w-5" />
                ) : (
                  <FiToggleLeft className="h-5 w-5" />
                )}
                Auto KOT {autoKotEnabled ? "On" : "Off"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-2 xl:flex-1 xl:grid-rows-[430px_minmax(280px,1fr)] 2xl:grid-rows-[460px_minmax(320px,1fr)]">
        <div className="grid gap-3 xl:h-[430px] xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] 2xl:h-[460px] 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm xl:h-full">
            <div className="grid w-full gap-2 border-b border-slate-300 bg-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700 xl:[grid-template-columns:minmax(0,1fr)_72px_62px_68px_90px_52px] 2xl:[grid-template-columns:minmax(0,1fr)_78px_68px_72px_98px_60px]">
              <div>Item</div>
              <div className="text-right">Price</div>
              <div className="text-right">Units</div>
              <div className="text-right">Taxes</div>
              <div className="text-right">Value</div>
              <div className="text-center">Printer</div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {cart.length > 0 ? (
                cart.map((item) => {
                  const isSelected = item.cartKey === selectedCartItemId;

                  return (
                    <button
                      key={item.cartKey}
                      onClick={() => setSelectedCartItemId(item.cartKey)}
                      className={`grid w-full gap-2 border-b border-slate-200 px-4 py-2 text-left text-[13px] xl:[grid-template-columns:minmax(0,1fr)_72px_62px_68px_90px_52px] 2xl:[grid-template-columns:minmax(0,1fr)_78px_68px_72px_98px_60px] ${
                        isSelected ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{item.name}</div>
                        {item.created_by_username && (
                          <div className="truncate text-[11px] text-slate-500">
                            Added by {item.created_by_username}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-slate-700">
                        {formatMoney(item.sale_price)}
                      </div>
                      <div className="text-right text-slate-700">x{item.qty}</div>
                      <div className="text-right text-slate-700">
                        {item.tax_mode === "GST_INCLUDED" ? "GST" : "-"}
                      </div>
                      <div className="text-right font-semibold text-slate-900">
                        {formatMoney(item.sale_price * item.qty)}
                      </div>
                      <div className="truncate text-center text-slate-700">
                        {item.printer_name ? item.printer_name : "-"}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex h-full min-h-[140px] items-center justify-center px-6 text-center text-sm text-slate-500">
                  Click an item below to start the order.
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-300 bg-slate-50 px-3 py-2">
              <div className="ml-auto w-full max-w-[21rem] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 shadow-sm 2xl:max-w-[26rem]">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-center sm:grid-cols-4 sm:gap-x-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Subtotal
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Due
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Tax
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Total
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-900">
                    {formatMoney(subtotal)}
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-900">
                    {formatMoney(calculatorBalanceAmount)}
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-900">
                    {summaryTaxValue}
                  </div>
                  <div className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white">
                    {formatMoney(subtotal)}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="xl:min-h-0 xl:overflow-hidden xl:h-full">
            {showPaymentPanel ? (
              <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm xl:flex xl:h-full xl:flex-col">
                <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                  Calculator
                </div>

                <div className="p-2 xl:h-full">
                  <div className="flex h-full min-h-0 w-full flex-col gap-2">
                    <div className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-right text-[1.2rem] font-bold text-white xl:text-[1.35rem] 2xl:text-[1.55rem]">
                      {displayedCustomerPaidInput}
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-5 gap-1.5">
                    {[
                      { key: "CE", className: "col-span-2" },
                      { key: "*", className: "" },
                      { key: "-", className: "" },
                      { key: "1", className: "" },
                      { key: "2", className: "" },
                      { key: "3", className: "" },
                      { key: "+", className: "row-span-2" },
                      { key: "4", className: "" },
                      { key: "5", className: "" },
                      { key: "6", className: "" },
                      { key: "7", className: "" },
                      { key: "8", className: "" },
                      { key: "9", className: "" },
                      { key: "=", className: "row-span-2" },
                      { key: "0", className: "col-span-2" },
                      { key: ".", className: "" },
                    ].map(({ key, className }) => (
                      <button
                        key={key}
                          onClick={() => {
                            if (key === "CE") {
                              clearCalculatorInput();
                              return;
                            }

                            if (key === "*") {
                              setCustomerPaidInput((currentValue) => currentValue.slice(0, -1));
                              return;
                            }

                            if (key === "+") {
                              applySelectedLineQuantityChange(1);
                              return;
                            }

                            if (key === "-") {
                              applySelectedLineQuantityChange(-1);
                              return;
                            }

                          if (key === "=") {
                            openPaymentDialog();
                            return;
                          }

                          appendCustomerPaidInput(key);
                        }}
                        disabled={
                          (key === "+" && !canModifySelectedLine) ||
                          (key === "-" && !canDecreaseSelectedLine)
                        }
                        className={`${className} h-full w-full rounded-lg border px-2 py-1 text-[12px] font-semibold shadow-sm xl:text-[13px] 2xl:text-sm ${
                          key === "="
                            ? "border-slate-400 bg-slate-100 text-slate-700"
                            : key === "+"
                              ? "border-sky-400 bg-sky-50 text-sky-700"
                              : key === "-"
                                ? "border-rose-200 bg-rose-50 text-rose-600"
                                : key === "CE" || key === "*"
                                  ? "border-slate-300 bg-slate-100 text-slate-700"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-300 bg-white shadow-sm xl:flex xl:h-full xl:flex-col">
                <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                  Order Summary
                </div>
                <div className="space-y-3 p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                  <div className="rounded-xl bg-slate-900 px-4 py-4 text-right text-[2rem] font-bold text-white">
                    {formatMoney(subtotal)}
                  </div>
                  <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-center">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pending Units
                    </div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">
                      {localPendingUnits}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                    Payment is turned off for this role in Access Control.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showCatalog ? (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-300 bg-slate-100 px-3 py-1.5">
              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                <div className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-700">
                  Items
                  <span className="ml-2 text-[11px] font-medium normal-case tracking-normal text-slate-500">
                    {categoryFilter === "ALL"
                      ? `${filteredProducts.length} visible`
                      : `${categoryFilter} · ${filteredProducts.length} visible`}
                  </span>
                </div>

                <div className="min-w-0 flex-1 overflow-x-auto">
                  <div className="flex min-w-max gap-1.5 pr-1">
                    {visibleCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() =>
                          setCategoryFilter((currentValue) =>
                            currentValue === category ? "ALL" : category,
                          )
                        }
                        className={`rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                          categoryFilter === category
                            ? "bg-slate-800 text-white"
                            : "bg-white text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-sky-500 lg:w-52 lg:shrink-0 xl:w-56"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 content-start gap-1 p-1 sm:grid-cols-4 lg:grid-cols-6 xl:min-h-0 xl:[grid-template-columns:repeat(13,minmax(0,1fr))] xl:overflow-y-auto 2xl:[grid-template-columns:repeat(13,minmax(0,1fr))]">
              {loading ? (
                <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-500">
                  Loading items...
                </div>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const cartQty = productCartQtyById[product.id] || 0;

                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`relative aspect-[1/0.62] overflow-hidden rounded-md border px-1 py-1 text-center shadow-sm transition ${
                        cartQty > 0
                          ? "border-sky-500 bg-sky-50 hover:border-sky-600"
                          : "border-slate-300 bg-white hover:border-sky-400 hover:bg-slate-50"
                      }`}
                    >
                      {cartQty > 0 ? (
                        <span className="absolute right-1 top-1 rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          {cartQty}
                        </span>
                      ) : null}
                      <div
                        className={`flex h-full min-w-0 flex-col items-center justify-center pb-0.5 ${
                          cartQty > 0 ? "pt-2.5" : "pt-0.5"
                        }`}
                      >
                        <div className="w-full truncate text-xs font-medium leading-tight text-slate-900">
                          {product.name}
                        </div>
                        <div className="mt-1 text-xs font-bold leading-none text-slate-900">
                          {formatMoney(product.sale_price)}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-500">
                  No items found.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <div className="text-lg font-bold text-slate-900">Catalog Locked</div>
            <p className="mt-2 text-sm text-slate-500">
              This role can open bills and view the current order, but adding
              items is turned off in Access Control.
            </p>
          </div>
        )}
      </div>
      </div>

      {showPaymentDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
                  Payment
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {currentTableName}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose UPI, Cash, or Card to place the full total in that
                  payment type. You can still edit the amounts manually for mixed
                  payment.
                </p>
              </div>
              <button
                onClick={() => setShowPaymentDialog(false)}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] bg-slate-100 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatMoney(subtotal)}
                </div>
              </div>
              <div className="rounded-[24px] bg-slate-100 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Paid
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatMoney(paymentDialogTotalPaid)}
                </div>
              </div>
              <div className="rounded-[24px] bg-slate-100 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {paymentDialogBalance >= 0 ? "Change" : "Due"}
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatMoney(Math.abs(paymentDialogBalance))}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment Split
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {paymentBreakdownParts.length > 0 ? resolvedPaymentMethod : "SELECT METHOD"}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => applyFullAmountToPaymentMethod("UPI")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      applyFullAmountToPaymentMethod("UPI");
                    }
                  }}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    upiPaidValue > 0
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                    <FiSmartphone className="h-4 w-4" />
                    <span>UPI</span>
                  </div>
                  <input
                    value={upiPaidInput}
                    onChange={(e) => setUpiPaidInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0.00"
                    className={`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500 ${
                      upiPaidValue > 0 ? "border-emerald-300" : "border-slate-200"
                    }`}
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => applyFullAmountToPaymentMethod("CASH")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      applyFullAmountToPaymentMethod("CASH");
                    }
                  }}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    cashPaidValue > 0
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                    <FiDollarSign className="h-4 w-4" />
                    <span>Cash</span>
                  </div>
                  <input
                    value={cashPaidInput}
                    onChange={(e) => setCashPaidInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0.00"
                    className={`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500 ${
                      cashPaidValue > 0 ? "border-emerald-300" : "border-slate-200"
                    }`}
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => applyFullAmountToPaymentMethod("CARD")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      applyFullAmountToPaymentMethod("CARD");
                    }
                  }}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    cardPaidValue > 0
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                    <FiCreditCard className="h-4 w-4" />
                    <span>Card</span>
                  </div>
                  <input
                    value={cardPaidInput}
                    onChange={(e) => setCardPaidInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0.00"
                    className={`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500 ${
                      cardPaidValue > 0 ? "border-emerald-300" : "border-slate-200"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Start with UPI, Cash, or Card full amount above, then edit the
                values here if the customer pays by mixed payment.
              </div>
              {paymentBreakdownParts.length > 0 ? (
                <div className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                  {paymentBreakdownParts.join(" | ")}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                  No payment amount entered yet.
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment Summary
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      UPI
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {formatMoney(upiPaidValue)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cash
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {formatMoney(cashPaidValue)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Card
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {formatMoney(cardPaidValue)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Print Bill
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBillPrintEnabled(true)}
                    className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
                      billPrintEnabled
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    On
                  </button>
                  <button
                    onClick={() => setBillPrintEnabled(false)}
                    className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
                      !billPrintEnabled
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    Off
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowPaymentDialog(false)}
                className="rounded-[22px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmPaymentDialog}
                disabled={busyAction !== ""}
                className="rounded-[22px] bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {busyAction === "checkout"
                  ? "Saving..."
                  : billPrintEnabled
                    ? "Save & Print"
                    : "Save Bill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
              Cash Payment
            </div>
            <div className="mt-4 text-4xl font-bold text-slate-900">
              Change: {formatMoney(changePromptAmount)}
            </div>
            <button
              onClick={confirmChangePrompt}
              className="mt-6 rounded-[22px] bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showMoveOrderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                  Move Order
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {currentTableName}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Select another table and confirm the move.
                </p>
              </div>
              <button
                onClick={() => setShowMoveOrderDialog(false)}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Do you want to move order to another table?
              </div>

              <select
                value={moveTargetTableId}
                onChange={(event) => setMoveTargetTableId(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
              >
                <option value="">Select another table</option>
                {availableTables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.floor ? `${table.floor} - ` : ""}
                    {table.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowMoveOrderDialog(false)}
                className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={moveOrderToAnotherTable}
                disabled={movingOrder}
                className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {movingOrder ? "Moving..." : "Move Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
                  Transfer Items
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {selectedCartItem?.name || "Selected Item"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Move selected quantity to another table without moving the full
                  order.
                </p>
              </div>
              <button
                onClick={() => setShowTransferDialog(false)}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <select
                value={transferTargetTableId}
                onChange={(event) => setTransferTargetTableId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500"
              >
                <option value="">Select target table</option>
                {availableTables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.floor ? `${table.floor} - ` : ""}
                    {table.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                max={selectedCartItem?.qty || 1}
                value={transferQty}
                onChange={(event) => setTransferQty(event.target.value)}
                placeholder="Quantity to transfer"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500"
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowTransferDialog(false)}
                className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={transferSelectedItem}
                disabled={transferringItem}
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
              >
                {transferringItem ? "Transferring..." : "Transfer Items"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSplitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">
                  Split Bill
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {currentTableName}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Split by selected items or by target amount. This prints a split
                  bill preview without changing the live order.
                </p>
              </div>
              <button
                onClick={() => setShowSplitDialog(false)}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => setSplitMode("item")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  splitMode === "item"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                Split By Item
              </button>
              <button
                onClick={() => setSplitMode("amount")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  splitMode === "amount"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                Split By Amount
              </button>
            </div>

            {splitMode === "item" ? (
              <div className="mt-5 grid gap-3">
                {cart.map((item) => (
                  <label
                    key={item.cartKey}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-sm text-slate-500">
                        {item.qty} x {formatMoney(item.sale_price)}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={splitSelectedKeys.includes(item.cartKey)}
                      onChange={() => toggleSplitSelection(item.cartKey)}
                      className="h-5 w-5"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <input
                  value={splitAmountInput}
                  onChange={(event) => setSplitAmountInput(event.target.value)}
                  placeholder="Enter split amount"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-500"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Amount split uses whole item quantities in billing order.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Split Preview
              </div>
              {splitPreviewItems.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {splitPreviewItems.map((item) => (
                    <div
                      key={`${item.cartKey}-${item.qty}`}
                      className="flex items-center justify-between rounded-xl bg-white px-4 py-3"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {item.name}
                        </div>
                        <div className="text-sm text-slate-500">
                          Qty {item.qty}
                        </div>
                      </div>
                      <div className="font-semibold text-slate-900">
                        {formatMoney(item.sale_price * item.qty)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">
                  No split preview yet.
                </div>
              )}

              <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <div className="text-sm font-semibold text-slate-500">
                  Split Total
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {formatMoney(splitPreviewTotal)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowSplitDialog(false)}
                className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={printSplitBill}
                className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Print Split Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </AppSidebarLayout>
  );
}
