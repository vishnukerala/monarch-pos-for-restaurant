import { useEffect, useState } from "react";
import axios from "axios";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getStoredUser } from "../lib/accessControl";
import { API } from "../lib/api";

const REPORT_FORMAT_OPTIONS = ["CSV", "PDF"];
const DEFAULT_REPORT_OPTIONS = [
  { key: "DAILY_PROFIT", label: "Daily Profit" },
  { key: "DAILY_SALES_FULL", label: "Daily Sales Report (Full Sale Report)" },
  { key: "ITEM_WISE_SALES", label: "Item-wise Sales Report" },
  { key: "CATEGORY_WISE_SALES", label: "Category-wise Sales Report" },
  { key: "BILL_WISE", label: "Bill Wise Report" },
  { key: "CURRENT_STOCK", label: "Current Stock Report" },
];

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatQuantity(value) {
  const normalizedValue = Number(value || 0);

  if (!Number.isFinite(normalizedValue)) {
    return "0";
  }

  return normalizedValue.toFixed(3).replace(/\.?0+$/, "");
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocalValue(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate(),
  )}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function getDefaultFilters() {
  const now = new Date();
  const startOfDay = new Date(now);

  startOfDay.setHours(0, 0, 0, 0);

  return {
    dateFrom: toDateTimeLocalValue(startOfDay),
    dateTo: toDateTimeLocalValue(now),
    tableId: "",
    categoryId: "",
    productId: "",
  };
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const normalizedValue = String(value).includes("T")
    ? String(value)
    : String(value).replace(" ", "T");
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function createEmptyReportData() {
  return {
    available_reports: DEFAULT_REPORT_OPTIONS,
    filters: {},
    daily_profit: {
      summary: {
        total_bills: 0,
        total_units: 0,
        total_sales: 0,
        total_cost: 0,
        total_profit: 0,
        profit_margin_pct: 0,
      },
      rows: [],
    },
    daily_sales_full: {
      summary: {
        total_bills: 0,
        total_units: 0,
        total_sales: 0,
        total_cash_paid: 0,
        total_card_paid: 0,
        total_upi_paid: 0,
        total_cash_method_sales: 0,
        total_card_method_sales: 0,
        total_upi_method_sales: 0,
        total_mixed_sales: 0,
        total_expense: 0,
        expense_count: 0,
        total_cash_in_hand: 0,
        total_entered_cash: 0,
        total_entered_upi: 0,
        total_entered_card: 0,
        total_entered_amount: 0,
        cash_closing_count: 0,
        close_cash_total_sales: 0,
        close_cash_difference: null,
        close_cash_status: "PENDING",
        cash_tally_difference: null,
        cash_tally_status: "PENDING",
        expected_cash_after_expense: 0,
        average_bill_value: 0,
      },
      item_wise_sales: [],
      category_wise_sales: [],
      bill_wise_sales: [],
      daily_expenses: [],
    },
    item_wise_sales: [],
    category_wise_sales: [],
    bill_wise_sales: [],
    current_stock_report: [],
  };
}

function createEmptyReportConfig() {
  return {
    default_recipients: [],
    auto_send_enabled: false,
    auto_send_time: "23:59",
    auto_report_type: "DAILY_SALES_FULL",
    auto_report_types: ["DAILY_SALES_FULL"],
    auto_report_format: "CSV",
    auto_recipients: [],
    last_auto_sent_at: null,
    updated_at: null,
  };
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

function getCloseCashReportSummary(summary) {
  const totalSale = Number(
    summary?.close_cash_total_sales ?? summary?.total_sales ?? 0,
  );
  const totalExpense = Number(summary?.total_expense || 0);
  const enteredCash = Number(summary?.total_entered_cash || 0);
  const enteredUpi = Number(summary?.total_entered_upi || 0);
  const enteredCard = Number(summary?.total_entered_card || 0);
  const enteredTotal = Number(
    summary?.total_entered_amount || enteredCash + enteredUpi + enteredCard,
  );
  const closeCashCount = Number(summary?.cash_closing_count || 0);
  const difference = Number(
    summary?.close_cash_difference ??
      summary?.cash_tally_difference ??
      totalSale - totalExpense - enteredTotal,
  );
  const status = String(
    summary?.close_cash_status || summary?.cash_tally_status || "PENDING",
  ).toUpperCase();
  const hasCloseCashEntry = closeCashCount > 0 || enteredTotal > 0;

  if (!hasCloseCashEntry || status === "PENDING") {
    return {
      totalSale,
      totalExpense,
      enteredCash,
      enteredUpi,
      enteredCard,
      difference,
      label: "Pending",
      helper: "No manual close cash entry saved for the selected date range.",
      tone: "muted",
    };
  }

  if (Math.abs(difference) < 0.01 || status === "TALLY") {
    return {
      totalSale,
      totalExpense,
      enteredCash,
      enteredUpi,
      enteredCard,
      difference: 0,
      label: "No Due",
      helper: "Manual close cash entry matches the expected sale total.",
      tone: "success",
    };
  }

  if (difference > 0 || status === "MISSING") {
    return {
      totalSale,
      totalExpense,
      enteredCash,
      enteredUpi,
      enteredCard,
      difference,
      label: `Due: ${formatMoney(Math.abs(difference))}`,
      helper: "Manual close cash entry is below the expected sale total.",
      tone: "danger",
    };
  }

  return {
    totalSale,
    totalExpense,
    enteredCash,
    enteredUpi,
    enteredCard,
    difference,
    label: `Excess: ${formatMoney(Math.abs(difference))}`,
    helper: "Manual close cash entry is above the expected sale total.",
    tone: "warning",
  };
}

function SummaryCard({ label, value, helper, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : tone === "muted"
            ? "border-slate-200 bg-slate-50"
            : "border-slate-200 bg-white";

  return (
    <div className={`rounded-3xl border px-5 py-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

function ReportSection({ title, description, children }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyTableRow({ colSpan, message }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-sm text-slate-500"
      >
        {message}
      </td>
    </tr>
  );
}

function normalizeEmailList(values) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nextEmails = [];

  values.forEach((value) => {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue || !emailPattern.test(normalizedValue)) {
      return;
    }

    const loweredValue = normalizedValue.toLowerCase();

    if (nextEmails.some((item) => item.toLowerCase() === loweredValue)) {
      return;
    }

    nextEmails.push(normalizedValue);
  });

  return nextEmails;
}

function parseEmailsFromInput(value) {
  return normalizeEmailList(String(value || "").split(/[\s,;]+/));
}

function EmailListEditor({
  label,
  helper,
  emails,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {emails.length > 0 ? (
          emails.map((email) => (
            <div
              key={email}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
            >
              <span>{email}</span>
              <button
                type="button"
                onClick={() => onRemove(email)}
                className="text-slate-400 hover:text-rose-600"
              >
                x
              </button>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-400">No email addresses added.</div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Enter email and click Add"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={onAdd}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Add Email
        </button>
      </div>
    </div>
  );
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const currentUser = getStoredUser();
  const { role } = currentUser;
  const [filters, setFilters] = useState(() => getDefaultFilters());
  const [selectedReportType, setSelectedReportType] = useState(
    "DAILY_SALES_FULL",
  );
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [reportData, setReportData] = useState(() => createEmptyReportData());
  const [reportConfig, setReportConfig] = useState(() => createEmptyReportConfig());
  const [manualRecipients, setManualRecipients] = useState([]);
  const [manualEmailFormat, setManualEmailFormat] = useState("CSV");
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingAutoSettings, setSavingAutoSettings] = useState(false);
  const [sendingAutoNow, setSendingAutoNow] = useState(false);
  const [manualRecipientInput, setManualRecipientInput] = useState("");
  const [autoRecipientInput, setAutoRecipientInput] = useState("");

  const reportOptions =
    reportData.available_reports?.length > 0
      ? reportData.available_reports
      : DEFAULT_REPORT_OPTIONS;
  const filteredProducts = products.filter((product) => {
    if (!filters.categoryId) {
      return true;
    }

    return String(product.category_id) === String(filters.categoryId);
  });

  useEffect(() => {
    if (!filters.productId) {
      return;
    }

    const hasSelectedProduct = products.some(
      (product) =>
        String(product.id) === String(filters.productId) &&
        (!filters.categoryId ||
          String(product.category_id) === String(filters.categoryId)),
    );

    if (!hasSelectedProduct) {
      setFilters((currentValue) => ({
        ...currentValue,
        productId: "",
      }));
    }
  }, [filters.categoryId, filters.productId, products]);

  useEffect(() => {
    const hasSelectedReportType = reportOptions.some(
      (reportOption) => reportOption.key === selectedReportType,
    );

    if (!hasSelectedReportType && reportOptions[0]) {
      setSelectedReportType(reportOptions[0].key);
    }
  }, [reportOptions, selectedReportType]);

  const buildReportParams = (activeFilters = filters) => ({
    date_from: activeFilters.dateFrom || undefined,
    date_to: activeFilters.dateTo || undefined,
    table_id: activeFilters.tableId ? Number(activeFilters.tableId) : undefined,
    category_id: activeFilters.categoryId
      ? Number(activeFilters.categoryId)
      : undefined,
    product_id: activeFilters.productId ? Number(activeFilters.productId) : undefined,
  });

  const loadPageData = async (activeFilters = filters) => {
    try {
      setLoading(true);
      const [
        tablesResponse,
        categoriesResponse,
        productsResponse,
        reportsResponse,
        configResponse,
      ] =
        await Promise.all([
          axios.get(`${API}/tables`),
          axios.get(`${API}/stock/categories`),
          axios.get(`${API}/stock/products`),
          axios.get(`${API}/reports/data`, {
            params: buildReportParams(activeFilters),
          }),
          axios.get(`${API}/reports/auto-config`),
        ]);

      setTables(tablesResponse.data || []);
      setCategories(categoriesResponse.data || []);
      setProducts(productsResponse.data || []);
      setReportData(reportsResponse.data || createEmptyReportData());
      const nextConfig = {
        ...createEmptyReportConfig(),
        ...(configResponse.data || {}),
      };
      setReportConfig(nextConfig);
      setManualRecipients(
        nextConfig.default_recipients?.length > 0
          ? nextConfig.default_recipients
          : [],
      );
    } catch (error) {
      console.error(error);
      alert("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async (activeFilters = filters) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/reports/data`, {
        params: buildReportParams(activeFilters),
      });
      setReportData(response.data || createEmptyReportData());
    } catch (error) {
      console.error(error);
      alert("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData(filters);
  }, []);

  const applyFilterChange = (key, value) => {
    setFilters((currentValue) => {
      if (key === "categoryId") {
        return {
          ...currentValue,
          categoryId: value,
          productId: "",
        };
      }

      return {
        ...currentValue,
        [key]: value,
      };
    });
  };

  const validateDateRange = (activeFilters = filters) => {
    if (
      activeFilters.dateFrom &&
      activeFilters.dateTo &&
      activeFilters.dateFrom > activeFilters.dateTo
    ) {
      alert("End date and time must be after start date and time");
      return false;
    }

    return true;
  };

  const runReport = () => {
    if (!validateDateRange(filters)) {
      return;
    }

    void loadReportData(filters);
  };

  const resetToToday = () => {
    const nextFilters = getDefaultFilters();
    setFilters(nextFilters);
    void loadReportData(nextFilters);
  };

  const addEmailsToState = (inputValue, currentEmails, setEmails, clearInput) => {
    const nextEmails = normalizeEmailList([
      ...currentEmails,
      ...parseEmailsFromInput(inputValue),
    ]);

    if (nextEmails.length === currentEmails.length) {
      alert("Enter at least one valid email address");
      return;
    }

    setEmails(nextEmails);
    clearInput("");
  };

  const removeEmailFromList = (email, currentEmails, setEmails) => {
    setEmails(currentEmails.filter((value) => value !== email));
  };

  const exportReport = async (reportFormat) => {
    if (!validateDateRange(filters)) {
      return;
    }

    try {
      setExportingFormat(reportFormat);
      const response = await axios.get(`${API}/reports/export`, {
        params: {
          report_type: selectedReportType,
          report_format: reportFormat,
          ...buildReportParams(filters),
        },
        responseType: "blob",
      });

      downloadBlob(
        response.data,
        `${selectedReportType.toLowerCase()}_${Date.now()}.${reportFormat.toLowerCase()}`,
      );
    } catch (error) {
      console.error(error);
      alert(`Failed to export ${reportFormat}`);
    } finally {
      setExportingFormat("");
    }
  };

  const sendReportEmail = async () => {
    if (!validateDateRange(filters)) {
      return;
    }

    try {
      setSendingEmail(true);
      const response = await axios.post(`${API}/reports/send-email`, {
        report_type: selectedReportType,
        report_format: manualEmailFormat,
        recipients: manualRecipients,
        date_from: filters.dateFrom || null,
        date_to: filters.dateTo || null,
        table_id: filters.tableId ? Number(filters.tableId) : null,
        category_id: filters.categoryId ? Number(filters.categoryId) : null,
        product_id: filters.productId ? Number(filters.productId) : null,
      });

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      alert(response.data?.message || "Report email sent");
    } catch (error) {
      console.error(error);
      alert("Failed to send report email");
    } finally {
      setSendingEmail(false);
    }
  };

  const saveAutomaticDailyReport = async () => {
    if (!reportConfig.auto_report_types?.length) {
      alert("Select at least one automatic report");
      return;
    }

    try {
      setSavingAutoSettings(true);
      const response = await axios.put(`${API}/reports/auto-config`, reportConfig);

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      setReportConfig({
        ...createEmptyReportConfig(),
        ...(response.data || {}),
      });
      alert("Automatic daily report settings saved");
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to save automatic daily report settings"));
    } finally {
      setSavingAutoSettings(false);
    }
  };

  const sendAutomaticDailyReportNow = async () => {
    if (!reportConfig.auto_report_types?.length) {
      alert("Select at least one automatic report");
      return;
    }

    try {
      setSendingAutoNow(true);
      const response = await axios.post(`${API}/reports/send-auto-now`, reportConfig);

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      alert(response.data?.message || "Automatic daily report sent");
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to send automatic daily report"));
    } finally {
      setSendingAutoNow(false);
    }
  };

  const toggleAutomaticReportType = (reportType) => {
    setReportConfig((currentValue) => {
      const currentTypes = currentValue.auto_report_types || [];
      const nextTypes = currentTypes.includes(reportType)
        ? currentTypes.filter((value) => value !== reportType)
        : [...currentTypes, reportType];

      return {
        ...currentValue,
        auto_report_type: nextTypes[0] || currentValue.auto_report_type,
        auto_report_types: nextTypes,
      };
    });
  };

  const dailySalesSummary =
    reportData.daily_sales_full?.summary ||
    createEmptyReportData().daily_sales_full.summary;
  const closeCashSummary = getCloseCashReportSummary(dailySalesSummary);
  const dailyProfitSummary =
    reportData.daily_profit?.summary ||
    createEmptyReportData().daily_profit.summary;
  const billRows = reportData.bill_wise_sales || [];
  const stockRows = reportData.current_stock_report || [];
  const showFilteredBillTotal =
    Boolean(filters.categoryId) || Boolean(filters.productId);
  const stockValueTotal = stockRows.reduce(
    (sum, row) => sum + Number(row.stock_value || 0),
    0,
  );
  const totalStockQty = stockRows.reduce(
    (sum, row) => sum + Number(row.current_stock_qty || 0),
    0,
  );
  const negativeStockCount = stockRows.filter(
    (row) => Number(row.current_stock_qty || 0) < 0,
  ).length;

  const renderSummaryCards = () => {
    if (selectedReportType === "DAILY_PROFIT") {
      return (
        <div className="grid gap-4 xl:grid-cols-4">
          <SummaryCard
            label="Sales"
            value={formatMoney(dailyProfitSummary.total_sales)}
            helper="Sales value in the selected period."
          />
          <SummaryCard
            label="Cost"
            value={formatMoney(dailyProfitSummary.total_cost)}
            helper="Estimated item cost from product cost price."
          />
          <SummaryCard
            label="Profit"
            value={formatMoney(dailyProfitSummary.total_profit)}
            helper="Sales minus cost."
          />
          <SummaryCard
            label="Margin %"
            value={formatMoney(dailyProfitSummary.profit_margin_pct)}
            helper="Profit percentage for the selected range."
          />
        </div>
      );
    }

    if (selectedReportType === "CURRENT_STOCK") {
      return (
        <div className="grid gap-4 xl:grid-cols-4">
          <SummaryCard
            label="Products"
            value={stockRows.length}
            helper="Products in the filtered stock list."
          />
          <SummaryCard
            label="Total Stock"
            value={formatQuantity(totalStockQty)}
            helper="Combined stock quantity."
          />
          <SummaryCard
            label="Stock Value"
            value={formatMoney(stockValueTotal)}
            helper="Sale value of current stock."
          />
          <SummaryCard
            label="Negative Stock"
            value={negativeStockCount}
            helper="Products currently below zero."
          />
        </div>
      );
    }

    if (selectedReportType === "DAILY_SALES_FULL") {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Total Sales"
            value={formatMoney(dailySalesSummary.total_sales)}
            helper="Sales value in the selected date range."
          />
          <SummaryCard
            label="UPI"
            value={formatMoney(dailySalesSummary.total_upi_paid)}
            helper="Digital payment amount."
          />
          <SummaryCard
            label="Card"
            value={formatMoney(dailySalesSummary.total_card_paid)}
            helper="Card payment amount."
          />
          <SummaryCard
            label="Cash"
            value={formatMoney(dailySalesSummary.total_cash_paid)}
            helper="System collected cash from bills."
          />
          <SummaryCard
            label="Expense"
            value={formatMoney(dailySalesSummary.total_expense)}
            helper="Manual expense amount in the selected date range."
          />
        </div>
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          label="Total Sales"
          value={formatMoney(dailySalesSummary.total_sales)}
          helper="Sales value in the selected date range."
        />
        <SummaryCard
          label="Bills"
          value={dailySalesSummary.total_bills || 0}
          helper="Total billed invoices in the result."
        />
        <SummaryCard
          label="Units Sold"
          value={formatQuantity(dailySalesSummary.total_units)}
          helper="Total quantity sold for the filtered data."
        />
        <SummaryCard
          label="Average Bill"
          value={formatMoney(dailySalesSummary.average_bill_value)}
          helper="Average billed amount per invoice."
        />
      </div>
    );
  };

  const renderItemWiseTable = (rows, emptyMessage) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr
                key={`${row.product_id || row.item_name}-${row.category_name}`}
                className="border-b border-slate-100 text-slate-700"
              >
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {row.item_name}
                </td>
                <td className="px-4 py-3">
                  {row.category_name || "Uncategorized"}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatQuantity(row.total_qty)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatMoney(row.total_sales)}
                </td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={4} message={emptyMessage} />
          )}
        </tbody>
      </table>
    </div>
  );

  const renderCategoryWiseTable = (rows, emptyMessage) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr
                key={row.category_id || row.category_name}
                className="border-b border-slate-100 text-slate-700"
              >
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {row.category_name || "Uncategorized"}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatQuantity(row.total_qty)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatMoney(row.total_sales)}
                </td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={3} message={emptyMessage} />
          )}
        </tbody>
      </table>
    </div>
  );

  const renderBillWiseTable = (rows, emptyMessage) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Bill</th>
            <th className="px-4 py-3">Date and Time</th>
            <th className="px-4 py-3">Table</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">
              {showFilteredBillTotal ? "Filtered Total" : "Total"}
            </th>
            {showFilteredBillTotal && (
              <th className="px-4 py-3 text-right">Bill Total</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr
                key={row.bill_id}
                className="border-b border-slate-100 text-slate-700"
              >
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {row.bill_number}
                </td>
                <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                <td className="px-4 py-3">
                  {[row.floor_name, row.table_name].filter(Boolean).join(" - ") ||
                    "-"}
                </td>
                <td className="px-4 py-3">{row.payment_method || "-"}</td>
                <td className="px-4 py-3 text-right">
                  {formatQuantity(row.total_qty)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatMoney(
                    showFilteredBillTotal ? row.matched_total : row.bill_total,
                  )}
                </td>
                {showFilteredBillTotal && (
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatMoney(row.bill_total)}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <EmptyTableRow
              colSpan={showFilteredBillTotal ? 7 : 6}
              message={emptyMessage}
            />
          )}
        </tbody>
      </table>
    </div>
  );

  const renderExpenseTable = (rows, emptyMessage) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Date and Time</th>
            <th className="px-4 py-3">Details</th>
            <th className="px-4 py-3">Saved By</th>
            <th className="px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 text-slate-700"
              >
                <td className="px-4 py-3">{formatDateTime(row.expense_at)}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {row.details}
                </td>
                <td className="px-4 py-3">{row.created_by_username || "-"}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatMoney(row.amount)}
                </td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={4} message={emptyMessage} />
          )}
        </tbody>
      </table>
    </div>
  );

  const renderProfitTable = (rows) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Sales</th>
            <th className="px-4 py-3 text-right">Cost</th>
            <th className="px-4 py-3 text-right">Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr
                key={`${row.product_id || row.item_name}-${row.category_name}`}
                className="border-b border-slate-100 text-slate-700"
              >
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {row.item_name}
                </td>
                <td className="px-4 py-3">
                  {row.category_name || "Uncategorized"}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatQuantity(row.total_qty)}
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(row.total_sales)}</td>
                <td className="px-4 py-3 text-right">{formatMoney(row.total_cost)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatMoney(row.total_profit)}
                </td>
              </tr>
            ))
          ) : (
            <EmptyTableRow
              colSpan={6}
              message="No profit data found for the selected filters."
            />
          )}
        </tbody>
      </table>
    </div>
  );

  const renderStockTable = (rows) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Current Stock</th>
            <th className="px-4 py-3 text-right">Sale Price</th>
            <th className="px-4 py-3 text-right">Stock Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const isNegative = Number(row.current_stock_qty || 0) < 0;

              return (
                <tr
                  key={row.product_id}
                  className="border-b border-slate-100 text-slate-700"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.item_name}
                  </td>
                  <td className="px-4 py-3">
                    {row.category_name || "Uncategorized"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      isNegative ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {formatQuantity(row.current_stock_qty)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(row.sale_price)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatMoney(row.stock_value)}
                  </td>
                </tr>
              );
            })
          ) : (
            <EmptyTableRow
              colSpan={5}
              message="No stock items found for the selected filters."
            />
          )}
        </tbody>
      </table>
    </div>
  );

  const renderSelectedReport = () => {
    if (selectedReportType === "DAILY_PROFIT") {
      return (
        <ReportSection
          title="Daily Profit"
          description="Profit uses product cost price and sales value for the selected date range."
        >
          {renderProfitTable(reportData.daily_profit?.rows || [])}
        </ReportSection>
      );
    }

    if (selectedReportType === "ITEM_WISE_SALES") {
      return (
        <ReportSection
          title="Item-wise Sales Report"
          description="Item-wise sales for the selected period and filters."
        >
          {renderItemWiseTable(
            reportData.item_wise_sales || [],
            "No item-wise sales found for the selected filters.",
          )}
        </ReportSection>
      );
    }

    if (selectedReportType === "CATEGORY_WISE_SALES") {
      return (
        <ReportSection
          title="Category-wise Sales Report"
          description="Category-wise sales for the selected period and filters."
        >
          {renderCategoryWiseTable(
            reportData.category_wise_sales || [],
            "No category-wise sales found for the selected filters.",
          )}
        </ReportSection>
      );
    }

    if (selectedReportType === "BILL_WISE") {
      return (
        <ReportSection
          title="Bill Wise Report"
          description="Bill-wise sales list for the selected period."
        >
          {renderBillWiseTable(
            reportData.bill_wise_sales || [],
            "No billed sales found for the selected filters.",
          )}
        </ReportSection>
      );
    }

    if (selectedReportType === "CURRENT_STOCK") {
      return (
        <ReportSection
          title="Current Stock Report"
          description="Current stock quantity for products with category, sale price, and stock value."
        >
          {renderStockTable(reportData.current_stock_report || [])}
        </ReportSection>
      );
    }

    return (
      <div className="grid gap-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <ReportSection
            title="Daily Sales Report - Item Wise"
            description="Item-wise sales for the selected period and filters."
          >
            {renderItemWiseTable(
              reportData.daily_sales_full?.item_wise_sales || [],
              "No item-wise sales found for the selected filters.",
            )}
          </ReportSection>

          <ReportSection
            title="Daily Sales Report - Category Wise"
            description="Category-wise sales for the selected period and filters."
          >
            {renderCategoryWiseTable(
              reportData.daily_sales_full?.category_wise_sales || [],
              "No category-wise sales found for the selected filters.",
            )}
          </ReportSection>
        </div>

        <ReportSection
          title="Daily Sales Report - Bill Wise"
          description="Bill-wise sales included in the selected full sales report."
        >
          {renderBillWiseTable(
            reportData.daily_sales_full?.bill_wise_sales || [],
            "No billed sales found for the selected filters.",
          )}
        </ReportSection>

        <ReportSection
          title="Daily Sales Report - Expenses"
          description="Manual expense entries saved in the selected date range."
        >
          {renderExpenseTable(
            reportData.daily_sales_full?.daily_expenses || [],
            "No expense entries found for the selected filters.",
          )}
        </ReportSection>

        <ReportSection
          title="Daily Sales Report - Close Cash"
          description="Manual close cash entry with entered Cash, UPI, Card, and the final due or excess calculation."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Today Total Sale"
              value={formatMoney(closeCashSummary.totalSale)}
              helper="Sale total used for close cash calculation."
            />
            <SummaryCard
              label="Daily Expense"
              value={formatMoney(closeCashSummary.totalExpense)}
              helper="Saved daily expense deducted from total sale."
            />
            <SummaryCard
              label="Manual Cash"
              value={formatMoney(closeCashSummary.enteredCash)}
              helper="Cash amount entered during close cash."
            />
            <SummaryCard
              label="Manual UPI"
              value={formatMoney(closeCashSummary.enteredUpi)}
              helper="UPI amount entered during close cash."
            />
            <SummaryCard
              label="Manual Card"
              value={formatMoney(closeCashSummary.enteredCard)}
              helper="Card amount entered during close cash."
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Calculation
              </div>
              <div className="mt-3 text-lg font-bold text-slate-900">
                {formatMoney(closeCashSummary.totalSale)} -{" "}
                {formatMoney(closeCashSummary.totalExpense)} -{" "}
                {formatMoney(closeCashSummary.enteredCash)} -{" "}
                {formatMoney(closeCashSummary.enteredUpi)} -{" "}
                {formatMoney(closeCashSummary.enteredCard)} ={" "}
                {formatMoney(closeCashSummary.difference)}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Total Sale - Daily Expense - Cash - UPI - Card
              </div>
            </div>

            <SummaryCard
              label="Close Cash Result"
              value={closeCashSummary.label}
              helper={closeCashSummary.helper}
              tone={closeCashSummary.tone}
            />
          </div>
        </ReportSection>
      </div>
    );
  };

  return (
    <AppSidebarLayout
      role={role}
      currentPage="reports"
      onRefresh={() => void loadPageData(filters)}
    >
      <div className="space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf6ff_100%)] px-6 py-6 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.55)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Reports
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Reports, Export, and Mail Delivery
              </h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-500">
                Select a report from the dropdown, filter by date range,
                table, category, and item, then export as CSV or PDF or send it by
                email.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              Default range: today from 12:00 AM to the current time.
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_220px_220px_220px_auto]">
            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Report Type
              </div>
              <select
                value={selectedReportType}
                onChange={(event) => setSelectedReportType(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              >
                {reportOptions.map((reportOption) => (
                  <option key={reportOption.key} value={reportOption.key}>
                    {reportOption.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Start Date and Time
              </div>
              <input
                type="datetime-local"
                value={filters.dateFrom}
                onChange={(event) =>
                  applyFilterChange("dateFrom", event.target.value)
                }
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                End Date and Time
              </div>
              <input
                type="datetime-local"
                value={filters.dateTo}
                onChange={(event) =>
                  applyFilterChange("dateTo", event.target.value)
                }
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Table Filter
              </div>
              <select
                value={filters.tableId}
                onChange={(event) =>
                  applyFilterChange("tableId", event.target.value)
                }
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              >
                <option value="">All Tables</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {[table.floor, table.name].filter(Boolean).join(" - ") ||
                      `Table ${table.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category Filter
              </div>
              <select
                value={filters.categoryId}
                onChange={(event) =>
                  applyFilterChange("categoryId", event.target.value)
                }
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Item Filter
              </div>
              <select
                value={filters.productId}
                onChange={(event) =>
                  applyFilterChange("productId", event.target.value)
                }
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              >
                <option value="">All Items</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={runReport}
                disabled={loading}
                className="rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Loading..." : "Run Report"}
              </button>
              <button
                type="button"
                onClick={resetToToday}
                disabled={loading}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Reset Today
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {REPORT_FORMAT_OPTIONS.map((reportFormat) => (
              <button
                key={reportFormat}
                type="button"
                onClick={() => void exportReport(reportFormat)}
                disabled={exportingFormat !== "" || loading}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm ${
                  reportFormat === "PDF"
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {exportingFormat === reportFormat
                  ? `Exporting ${reportFormat}...`
                  : `Export ${reportFormat}`}
              </button>
            ))}
          </div>
        </div>

        {renderSummaryCards()}

        {renderSelectedReport()}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ReportSection
            title="Manual Email Send"
            description="Send the selected report to one or more email addresses using the current filter range."
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selected Report
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {reportOptions.find(
                      (reportOption) => reportOption.key === selectedReportType,
                    )?.label || selectedReportType}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Uses the current date range, category, and item filter above.
                  </div>
                </div>

                <label className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email Format
                  </div>
                  <select
                    value={manualEmailFormat}
                    onChange={(event) => setManualEmailFormat(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-500"
                  >
                    {REPORT_FORMAT_OPTIONS.map((reportFormat) => (
                      <option key={reportFormat} value={reportFormat}>
                        {reportFormat}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <EmailListEditor
                label="Recipients"
                helper="Add one or more recipient email addresses for manual sending."
                emails={manualRecipients}
                inputValue={manualRecipientInput}
                onInputChange={setManualRecipientInput}
                onAdd={() =>
                  addEmailsToState(
                    manualRecipientInput,
                    manualRecipients,
                    setManualRecipients,
                    setManualRecipientInput,
                  )
                }
                onRemove={(email) =>
                  removeEmailFromList(email, manualRecipients, setManualRecipients)
                }
              />

              <button
                type="button"
                onClick={() => void sendReportEmail()}
                disabled={sendingEmail}
                className="rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingEmail ? "Sending..." : "Send Report Email"}
              </button>
            </div>
          </ReportSection>

          <ReportSection
            title="Automatic Daily Report"
            description="Configure the report, format, time, and recipients for the automatic daily email."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Daily Auto Send
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Sends today's report from 12:00 AM up to the selected send
                    time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReportConfig((currentValue) => ({
                      ...currentValue,
                      auto_send_enabled: !currentValue.auto_send_enabled,
                    }))
                  }
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    reportConfig.auto_send_enabled
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {reportConfig.auto_send_enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Send Time
                  </div>
                  <input
                    type="time"
                    value={reportConfig.auto_send_time}
                    onChange={(event) =>
                      setReportConfig((currentValue) => ({
                        ...currentValue,
                        auto_send_time: event.target.value,
                      }))
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-500"
                  />
                </label>

                <label className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Auto Format
                  </div>
                  <select
                    value={reportConfig.auto_report_format}
                    onChange={(event) =>
                      setReportConfig((currentValue) => ({
                        ...currentValue,
                        auto_report_format: event.target.value,
                      }))
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-500"
                  >
                    {REPORT_FORMAT_OPTIONS.map((reportFormat) => (
                      <option key={reportFormat} value={reportFormat}>
                        {reportFormat}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Auto Reports
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {reportOptions.map((reportOption) => {
                    const isSelected =
                      reportConfig.auto_report_types?.includes(reportOption.key);

                    return (
                      <label
                        key={reportOption.key}
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
                          isSelected
                            ? "border-sky-400 bg-white text-slate-900"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span className="font-medium">{reportOption.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(isSelected)}
                          onChange={() => toggleAutomaticReportType(reportOption.key)}
                          className="h-4 w-4"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <EmailListEditor
                label="Automatic Send Recipients"
                helper="If empty, the automatic daily report uses the default recipients from Mail Configuration."
                emails={reportConfig.auto_recipients}
                inputValue={autoRecipientInput}
                onInputChange={setAutoRecipientInput}
                onAdd={() =>
                  addEmailsToState(
                    autoRecipientInput,
                    reportConfig.auto_recipients,
                    (nextEmails) =>
                      setReportConfig((currentValue) => ({
                        ...currentValue,
                        auto_recipients: nextEmails,
                      })),
                    setAutoRecipientInput,
                  )
                }
                onRemove={(email) =>
                  removeEmailFromList(
                    email,
                    reportConfig.auto_recipients,
                    (nextEmails) =>
                      setReportConfig((currentValue) => ({
                        ...currentValue,
                        auto_recipients: nextEmails,
                      })),
                  )
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm text-slate-500">
                  {reportConfig.last_auto_sent_at
                    ? `Last auto send: ${formatDateTime(reportConfig.last_auto_sent_at)}`
                    : "No automatic report sent yet."}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void sendAutomaticDailyReportNow()}
                    disabled={sendingAutoNow}
                    className="rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sendingAutoNow ? "Sending..." : "Send Now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAutomaticDailyReport()}
                    disabled={savingAutoSettings}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingAutoSettings
                      ? "Saving..."
                      : "Save Automatic Daily Report"}
                  </button>
                </div>
              </div>
            </div>
          </ReportSection>
        </div>
      </div>
    </AppSidebarLayout>
  );
}
