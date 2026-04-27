export function createEmptyCashClosingData() {
  return {
    business_date: null,
    cash_in_hand: 0,
    entered_cash: 0,
    entered_upi: 0,
    entered_card: 0,
    entered_total: 0,
    total_sales: 0,
    total_expense: 0,
    tally_difference: null,
    tally_status: "PENDING",
    is_closed: false,
    closed_at: null,
    closed_by_user_id: null,
    closed_by_username: "",
    updated_by_user_id: null,
    updated_by_username: "",
    updated_at: null,
  };
}

export function buildCloseCashDraft(cashClosing) {
  return {
    enteredCash:
      Number(cashClosing?.entered_cash || 0) > 0
        ? String(cashClosing.entered_cash)
        : "",
    enteredUpi:
      Number(cashClosing?.entered_upi || 0) > 0
        ? String(cashClosing.entered_upi)
        : "",
    enteredCard:
      Number(cashClosing?.entered_card || 0) > 0
        ? String(cashClosing.entered_card)
        : "",
  };
}

export function parseCloseCashValue(value) {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

export function getCloseCashEntryTotals(totalSales, totalExpense, draft) {
  const enteredCash = parseCloseCashValue(draft?.enteredCash);
  const enteredUpi = parseCloseCashValue(draft?.enteredUpi);
  const enteredCard = parseCloseCashValue(draft?.enteredCard);
  const enteredTotal = Number(
    (enteredCash + enteredUpi + enteredCard).toFixed(2),
  );
  const resolvedTotalSales = Number(Number(totalSales || 0).toFixed(2));
  const resolvedTotalExpense = Number(Number(totalExpense || 0).toFixed(2));
  const difference = Number(
    (resolvedTotalSales - resolvedTotalExpense - enteredTotal).toFixed(2),
  );

  let status = "PENDING";
  if (enteredTotal > 0 || resolvedTotalSales > 0) {
    if (Math.abs(difference) < 0.01) {
      status = "TALLY";
    } else if (difference > 0) {
      status = "MISSING";
    } else {
      status = "EXCESS";
    }
  }

  return {
    totalSales: resolvedTotalSales,
    enteredCash,
    enteredUpi,
    enteredCard,
    enteredTotal,
    totalExpense: resolvedTotalExpense,
    difference,
    status,
  };
}
