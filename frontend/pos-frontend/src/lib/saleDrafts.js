const SALE_DRAFT_PREFIX = "pos_sale_draft_";

function normalizeTableId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function buildDraftSummary(tableId, draft) {
  const items = Array.isArray(draft?.items) ? draft.items : [];

  if (items.length === 0) {
    return null;
  }

  const lines = items.length;
  const units = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const total = items.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.qty || 0),
    0,
  );
  const customerPaid =
    draft?.customer_paid == null ? null : Number(draft.customer_paid);

  return {
    id: `local-${tableId}`,
    table_id: tableId,
    table_name: draft?.table_name || `Table ${tableId}`,
    floor_name: draft?.floor_name || null,
    customer_paid: Number.isNaN(customerPaid) ? null : customerPaid,
    lines,
    units,
    pending_units: units,
    status: "OCCUPIED",
    subtotal: total,
    total,
    balance:
      customerPaid == null || Number.isNaN(customerPaid)
        ? null
        : Number((customerPaid - total).toFixed(2)),
    created_at: draft?.updated_at || null,
    updated_at: draft?.updated_at || null,
    local_only: true,
  };
}

export function getSaleDraftStorageKey(tableId) {
  return `${SALE_DRAFT_PREFIX}${tableId}`;
}

export function readSaleDraft(tableId) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawDraft = window.localStorage.getItem(getSaleDraftStorageKey(tableId));

    if (!rawDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(rawDraft);

    if (!parsedDraft || !Array.isArray(parsedDraft.items)) {
      return null;
    }

    return parsedDraft;
  } catch (error) {
    console.warn("Failed to read local sale draft", error);
    return null;
  }
}

export function writeSaleDraft(tableId, draft) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getSaleDraftStorageKey(tableId),
      JSON.stringify(draft),
    );
  } catch (error) {
    console.warn("Failed to write local sale draft", error);
  }
}

export function clearSaleDraft(tableId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getSaleDraftStorageKey(tableId));
}

export function getLocalDraftSalesLookup() {
  const localSales = {};

  if (typeof window === "undefined") {
    return localSales;
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);

    if (!storageKey || !storageKey.startsWith(SALE_DRAFT_PREFIX)) {
      continue;
    }

    const tableId = normalizeTableId(
      storageKey.replace(SALE_DRAFT_PREFIX, ""),
    );

    if (tableId == null) {
      continue;
    }

    const draft = readSaleDraft(tableId);
    const summary = buildDraftSummary(tableId, draft);

    if (summary) {
      localSales[tableId] = summary;
    }
  }

  return localSales;
}

export function getLocalDraftSalesList() {
  return Object.values(getLocalDraftSalesLookup()).sort(
    (left, right) => toTimestamp(right.updated_at) - toTimestamp(left.updated_at),
  );
}

export function mergeSalesByTable(remoteSales = [], localSales = []) {
  const mergedSales = new Map();

  localSales.forEach((sale) => {
    if (sale?.table_id != null) {
      mergedSales.set(sale.table_id, sale);
    }
  });

  remoteSales.forEach((sale) => {
    if (sale?.table_id == null) {
      return;
    }

    const existingSale = mergedSales.get(sale.table_id);

    if (!existingSale) {
      mergedSales.set(sale.table_id, sale);
      return;
    }

    const existingTimestamp = toTimestamp(existingSale.updated_at);
    const remoteTimestamp = toTimestamp(sale.updated_at);

    if (remoteTimestamp >= existingTimestamp) {
      mergedSales.set(sale.table_id, sale);
    }
  });

  return Array.from(mergedSales.values()).sort(
    (left, right) => toTimestamp(right.updated_at) - toTimestamp(left.updated_at),
  );
}
