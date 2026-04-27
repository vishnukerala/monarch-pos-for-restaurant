import { useEffect, useId, useState } from "react";
import axios from "axios";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getStoredUser } from "../lib/accessControl";
import { API } from "../lib/api";
import {
  buildCloseCashDraft,
  createEmptyCashClosingData,
  getCloseCashEntryTotals,
} from "../lib/cashClosing";

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
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

function getCloseCashResultLabel(summary, formatMoneyValue) {
  if (!summary || summary.status === "PENDING") {
    return "Pending";
  }

  if (summary.status === "TALLY") {
    return "No Due";
  }

  if (summary.status === "MISSING") {
    return `Due: ${formatMoneyValue(summary.difference)}`;
  }

  return `Excess: ${formatMoneyValue(Math.abs(summary.difference || 0))}`;
}

function createEmptyExpenseData(expenseDate) {
  return {
    expense_date: expenseDate,
    summary: {
      entry_count: 0,
      total_amount: 0,
      total_sales: 0,
    },
    detail_options: [],
    cash_closing: createEmptyCashClosingData(),
    rows: [],
  };
}

function createEmptyFormState() {
  return {
    details: "",
    amount: "",
    expenseTime: getCurrentTime(),
  };
}

export default function SalesExpensesPage() {
  const user = getStoredUser();
  const isAdmin = user.role === "ADMIN";
  const [selectedDate, setSelectedDate] = useState(() => getTodayDate());
  const [expenseData, setExpenseData] = useState(() =>
    createEmptyExpenseData(getTodayDate()),
  );
  const [formState, setFormState] = useState(() => createEmptyFormState());
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closingCash, setClosingCash] = useState(false);
  const [showCloseCashDialog, setShowCloseCashDialog] = useState(false);
  const [closeCashForm, setCloseCashForm] = useState(() =>
    buildCloseCashDraft(createEmptyCashClosingData()),
  );
  const detailListId = useId();
  const isCashClosed = Boolean(expenseData.cash_closing?.is_closed);
  const isLockedForUser = isCashClosed && !isAdmin;
  const savedCloseCashSummary = getCloseCashEntryTotals(
    expenseData.summary?.total_sales,
    expenseData.summary?.total_amount,
    {
      enteredCash: expenseData.cash_closing?.entered_cash,
      enteredUpi: expenseData.cash_closing?.entered_upi,
      enteredCard: expenseData.cash_closing?.entered_card,
    },
  );
  const closeCashPreview = getCloseCashEntryTotals(
    expenseData.summary?.total_sales,
    expenseData.summary?.total_amount,
    closeCashForm,
  );

  const savedCloseCashStatusTone =
    savedCloseCashSummary.status === "TALLY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : savedCloseCashSummary.status === "MISSING"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : savedCloseCashSummary.status === "EXCESS"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  const closeCashStatusTone =
    closeCashPreview.status === "TALLY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : closeCashPreview.status === "MISSING"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : closeCashPreview.status === "EXCESS"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  useEffect(() => {
    if (isLockedForUser && editingExpenseId) {
      resetForm();
    }
  }, [editingExpenseId, isLockedForUser]);

  useEffect(() => {
    if (!showCloseCashDialog) {
      return;
    }

    setCloseCashForm(buildCloseCashDraft(expenseData.cash_closing));
  }, [expenseData.cash_closing, showCloseCashDialog]);

  const loadExpenses = async (expenseDate = selectedDate) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/sales/expenses`, {
        params: {
          expense_date: expenseDate,
        },
      });
      setExpenseData({
        ...createEmptyExpenseData(expenseDate),
        ...(response.data || {}),
        summary: {
          ...createEmptyExpenseData(expenseDate).summary,
          ...(response.data?.summary || {}),
        },
        cash_closing: {
          ...createEmptyCashClosingData(),
          ...(response.data?.cash_closing || {}),
        },
      });
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to load daily expenses"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses(selectedDate);
  }, [selectedDate]);

  const resetForm = () => {
    setEditingExpenseId(null);
    setFormState(createEmptyFormState());
  };

  const saveExpense = async () => {
    if (isLockedForUser) {
      alert("Cash already closed for this date. Only admin can edit expenses now.");
      return;
    }

    if (!formState.details.trim()) {
      alert("Enter expense details");
      return;
    }

    if (!formState.amount || Number(formState.amount) <= 0) {
      alert("Enter a valid amount");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        details: formState.details.trim(),
        amount: Number(formState.amount),
        expense_date: selectedDate,
        expense_time: formState.expenseTime || null,
        actor_user_id: user.id,
        actor_username: user.username,
        actor_role: user.role,
      };
      const response = editingExpenseId
        ? await axios.put(`${API}/sales/expenses/${editingExpenseId}`, payload)
        : await axios.post(`${API}/sales/expenses`, payload);

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      resetForm();
      await loadExpenses(selectedDate);
    } catch (error) {
      console.error(error);
      alert(
        getErrorMessage(
          error,
          editingExpenseId
            ? "Failed to update daily expense"
            : "Failed to save daily expense",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    if (isLockedForUser) {
      alert("Cash already closed for this date. Only admin can edit expenses now.");
      return;
    }

    setEditingExpenseId(row.id);
    setFormState({
      details: row.details || "",
      amount: row.amount == null ? "" : String(row.amount),
      expenseTime: row.expense_time || getCurrentTime(),
    });
  };

  const closeCashForSelectedDate = async () => {
    try {
      setClosingCash(true);
      const response = await axios.put(`${API}/sales/cash-closing`, {
        business_date: selectedDate,
        entered_cash: closeCashPreview.enteredCash,
        entered_upi: closeCashPreview.enteredUpi,
        entered_card: closeCashPreview.enteredCard,
        actor_user_id: user.id,
        actor_username: user.username,
        actor_role: user.role,
      });

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      setShowCloseCashDialog(false);
      resetForm();
      await loadExpenses(selectedDate);

      if (response.data?.report_email_warning) {
        alert(
          `Cash closed. ${response.data.report_email_warning}`,
        );
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

  return (
    <AppSidebarLayout
      role={user.role}
      currentPage="sale-expenses"
      onRefresh={() => void loadExpenses(selectedDate)}
    >
      <div className="space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf6ff_100%)] px-6 py-6 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.55)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Sale
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Daily Expenses
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Cashier can add daily manual expenses here. Saved expense details
                appear again as future-use suggestions.
              </p>
            </div>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Expense Date
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setEditingExpenseId(null);
                }}
                className="mt-2 bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
            </label>
          </div>

          <div className="mt-5 rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Cash Close
                </div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {isCashClosed
                    ? "Cash already closed for this date"
                    : "Close this day after expenses are completed"}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {isCashClosed
                    ? `Closed by ${
                        expenseData.cash_closing?.closed_by_username || "User"
                      } on ${formatDateTime(expenseData.cash_closing?.closed_at)}`
                    : "After close, non-admin users cannot edit expenses or billed sales for this date."}
                </div>
                {isCashClosed && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Total Sale
                      </div>
                      <div className="mt-2 text-xl font-bold text-slate-900">
                        {formatMoney(expenseData.cash_closing?.total_sales)}
                      </div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 ${savedCloseCashStatusTone}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                        {savedCloseCashSummary.status === "TALLY"
                          ? "No Due"
                          : savedCloseCashSummary.status === "MISSING"
                            ? "Due"
                            : savedCloseCashSummary.status === "EXCESS"
                              ? "Excess"
                              : savedCloseCashSummary.status}
                      </div>
                      <div className="mt-2 text-xl font-bold">
                        {getCloseCashResultLabel(savedCloseCashSummary, formatMoney)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {isCashClosed ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Closed
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCloseCashDialog(true)}
                  disabled={closingCash}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {closingCash ? "Closing..." : "Close Cash"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Total Expense
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {formatMoney(expenseData.summary?.total_amount)}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Total saved for {selectedDate}.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Entries
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {expenseData.summary?.entry_count || 0}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Expense rows saved on the selected date.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Saved By
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {user.username || "Cashier"}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {isCashClosed
                ? isAdmin
                  ? "Cash is closed. Admin can still adjust this date if needed."
                  : "Cash is closed. Only admin can edit expenses now."
                : "New entries are recorded with the current signed-in user."}
            </div>
          </div>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              {editingExpenseId ? "Edit Expense" : "Add Expense"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Save manual expense amount and details for the selected day.
            </p>
          </div>

          {isLockedForUser && (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              Cash already closed for {selectedDate}. Only admin can edit or add
              expenses for this date.
            </div>
          )}

          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Expense Details
              </div>
              <input
                list={detailListId}
                value={formState.details}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    details: event.target.value,
                  }))
                }
                disabled={isLockedForUser}
                placeholder="Example: Milk, Gas, Parcel Packing, Staff Tea"
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
              <datalist id={detailListId}>
                {expenseData.detail_options.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.amount}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    amount: event.target.value,
                  }))
                }
                disabled={isLockedForUser}
                placeholder="0.00"
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Time
              </div>
              <input
                type="time"
                value={formState.expenseTime}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    expenseTime: event.target.value,
                  }))
                }
                disabled={isLockedForUser}
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
            </label>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void saveExpense()}
                disabled={saving || isLockedForUser}
                className="rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving
                  ? editingExpenseId
                    ? "Updating..."
                    : "Saving..."
                  : editingExpenseId
                    ? "Update Expense"
                    : "Save Expense"}
              </button>

              {editingExpenseId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          {expenseData.detail_options.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Quick Suggestions
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {expenseData.detail_options.slice(0, 12).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setFormState((currentValue) => ({
                        ...currentValue,
                        details: option,
                      }))
                    }
                    disabled={isLockedForUser}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Saved Expenses for {selectedDate}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Edit same-day expense rows anytime from this list.
            </p>
          </div>

          <div className="overflow-x-auto p-5">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Date and Time</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Saved By</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Loading expenses...
                    </td>
                  </tr>
                ) : expenseData.rows.length > 0 ? (
                  expenseData.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 text-slate-700"
                    >
                      <td className="px-4 py-3">{formatDateTime(row.expense_at)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.details}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatMoney(row.amount)}
                      </td>
                      <td className="px-4 py-3">{row.created_by_username || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={isLockedForUser}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No expenses saved for this date yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showCloseCashDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
                Close Cash
              </div>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">
                Confirm Daily Close
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                Close cash for {selectedDate}. After closing, non-admin users
                cannot edit this day&apos;s expenses or billed sales. The Daily
                Sales Full Report will be sent automatically to the default
                recipients.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cash
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={closeCashForm.enteredCash}
                    onChange={(event) =>
                      setCloseCashForm((currentValue) => ({
                        ...currentValue,
                        enteredCash: event.target.value,
                      }))
                    }
                    className="mt-2 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none"
                    placeholder="0.00"
                  />
                </label>
                <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    UPI
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={closeCashForm.enteredUpi}
                    onChange={(event) =>
                      setCloseCashForm((currentValue) => ({
                        ...currentValue,
                        enteredUpi: event.target.value,
                      }))
                    }
                    className="mt-2 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none"
                    placeholder="0.00"
                  />
                </label>
                <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Card
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={closeCashForm.enteredCard}
                    onChange={(event) =>
                      setCloseCashForm((currentValue) => ({
                        ...currentValue,
                        enteredCard: event.target.value,
                      }))
                    }
                    className="mt-2 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none"
                    placeholder="0.00"
                  />
                </label>
              </div>

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
                  onClick={() => void closeCashForSelectedDate()}
                  disabled={closingCash}
                  className="rounded-[22px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {closingCash ? "Closing..." : "Confirm Close"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppSidebarLayout>
  );
}
