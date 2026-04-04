export const ROLE_ADMIN = "ADMIN";
export const ROLE_CASHIER = "CASHIER";
export const ROLE_WAITER = "WAITER";
const ROLE_PERMISSION_STORAGE_KEY = "pos_role_permission_overrides";
const ROLE_PERMISSION_STORAGE_VERSION = 7;

const EMPTY_PERMISSIONS = {
  viewDashboard: false,
  accessAdministration: false,
  manageAccessControl: false,
  manageUsers: false,
  managePrinters: false,
  manageFloors: false,
  manageTables: false,
  manageStock: false,
  manageFloorLayout: false,
  viewOpenTables: false,
  openBill: false,
  addItems: false,
  deleteOwnLineItems: false,
  printKitchenTicket: false,
  moveTable: false,
  splitBill: false,
  transferItems: false,
  receivePayment: false,
  printReceipt: false,
  reprintBill: false,
  editBilledSales: false,
  clearOpenOrder: false,
  toggleAutoKot: false,
  manageExpenses: false,
};

const ROLE_PERMISSIONS = {
  [ROLE_ADMIN]: {
    ...EMPTY_PERMISSIONS,
    viewDashboard: true,
    accessAdministration: true,
    manageAccessControl: true,
    manageUsers: true,
    managePrinters: true,
    manageFloors: true,
    manageTables: true,
    manageStock: true,
    manageFloorLayout: true,
    viewOpenTables: true,
    openBill: true,
    addItems: true,
    deleteOwnLineItems: true,
    printKitchenTicket: true,
    moveTable: true,
    splitBill: true,
    transferItems: true,
    receivePayment: true,
    printReceipt: true,
    reprintBill: true,
    editBilledSales: true,
    clearOpenOrder: true,
    toggleAutoKot: true,
    manageExpenses: true,
  },
  [ROLE_CASHIER]: {
    ...EMPTY_PERMISSIONS,
    viewDashboard: true,
    viewOpenTables: true,
    openBill: true,
    addItems: true,
    splitBill: true,
    receivePayment: true,
    printReceipt: true,
    reprintBill: true,
    editBilledSales: true,
    manageExpenses: true,
  },
  [ROLE_WAITER]: {
    ...EMPTY_PERMISSIONS,
    viewOpenTables: true,
    openBill: true,
    addItems: true,
    deleteOwnLineItems: true,
    printKitchenTicket: true,
    moveTable: true,
    toggleAutoKot: true,
  },
};

const MANAGED_ROLES = [ROLE_CASHIER, ROLE_WAITER];

export const ACCESS_CONTROL_SECTIONS = [
  {
    title: "Sales",
    items: [
      { key: "viewOpenTables", label: "View open tables" },
      { key: "openBill", label: "Open bill or table" },
      { key: "addItems", label: "Add items to an open order" },
      { key: "deleteOwnLineItems", label: "Delete own line items" },
      { key: "printKitchenTicket", label: "Print kitchen ticket" },
      { key: "moveTable", label: "Move table" },
      { key: "splitBill", label: "Split bill preview" },
      { key: "transferItems", label: "Transfer items between tables" },
      { key: "clearOpenOrder", label: "Clear an open order" },
      { key: "toggleAutoKot", label: "Toggle Auto KOT" },
      { key: "manageExpenses", label: "Manage daily expenses" },
    ],
  },
  {
    title: "Billing",
    items: [
      { key: "receivePayment", label: "Receive payment" },
      { key: "printReceipt", label: "Print receipt" },
      { key: "reprintBill", label: "Reprint billed sale" },
      { key: "editBilledSales", label: "Edit billed sale" },
    ],
  },
  {
    title: "Administration",
    items: [
      { key: "viewDashboard", label: "Open dashboard" },
      { key: "accessAdministration", label: "Open administration" },
      { key: "manageUsers", label: "Manage users" },
      { key: "managePrinters", label: "Manage printers" },
      { key: "manageFloors", label: "Manage floors" },
      { key: "manageTables", label: "Manage tables" },
      { key: "manageStock", label: "Manage products and stock" },
      { key: "manageFloorLayout", label: "Edit floor layout" },
    ],
  },
];

export function normalizeRole(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "BILLING") {
    return ROLE_CASHIER;
  }

  if (
    normalized === ROLE_ADMIN ||
    normalized === ROLE_CASHIER ||
    normalized === ROLE_WAITER
  ) {
    return normalized;
  }

  return "";
}

export function formatRoleLabel(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === ROLE_ADMIN) {
    return "Admin";
  }

  if (normalizedRole === ROLE_CASHIER) {
    return "Cashier";
  }

  if (normalizedRole === ROLE_WAITER) {
    return "Waiter";
  }

  return "Unknown";
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function clonePermissions(permissions) {
  return { ...EMPTY_PERMISSIONS, ...permissions };
}

function normalizeStoredPermissionOverrides(overrides) {
  if (!overrides || typeof overrides !== "object") {
    return {};
  }

  const normalizedOverrides = {};

  MANAGED_ROLES.forEach((role) => {
    if (overrides[role] && typeof overrides[role] === "object") {
      normalizedOverrides[role] = clonePermissions(overrides[role]);
    }
  });

  return normalizedOverrides;
}

function applyCashierBasePermissions(permissions) {
  return {
    ...permissions,
    viewDashboard: permissions.viewDashboard || true,
    viewOpenTables: permissions.viewOpenTables || true,
    openBill: permissions.openBill || true,
    addItems: permissions.addItems || true,
    splitBill: permissions.splitBill || true,
    receivePayment: permissions.receivePayment || true,
    printReceipt: permissions.printReceipt || true,
    reprintBill: permissions.reprintBill || true,
    editBilledSales: permissions.editBilledSales || true,
    manageExpenses: permissions.manageExpenses || true,
  };
}

function applyWaiterBasePermissions(permissions) {
  return {
    ...permissions,
    viewOpenTables: permissions.viewOpenTables || true,
    openBill: permissions.openBill || true,
    addItems: permissions.addItems || true,
    deleteOwnLineItems: permissions.deleteOwnLineItems || true,
    printKitchenTicket: permissions.printKitchenTicket || true,
    moveTable: permissions.moveTable || true,
    toggleAutoKot: permissions.toggleAutoKot || true,
  };
}

function looksLikeBrokenCashierPermissions(permissions) {
  return Boolean(
    permissions?.manageExpenses &&
      !permissions?.viewOpenTables &&
      !permissions?.openBill &&
      !permissions?.receivePayment &&
      !permissions?.reprintBill,
  );
}

function looksLikeBrokenWaiterPermissions(permissions) {
  return Boolean(
    !permissions?.viewOpenTables &&
      !permissions?.openBill &&
      !permissions?.addItems &&
      !permissions?.deleteOwnLineItems &&
      !permissions?.printKitchenTicket &&
      !permissions?.moveTable &&
      !permissions?.toggleAutoKot,
  );
}

function upgradeLegacyPermissionOverrides(overrides) {
  const legacySource =
    overrides &&
    typeof overrides === "object" &&
    overrides.overrides &&
    typeof overrides.overrides === "object"
      ? overrides.overrides
      : overrides;
  const normalizedOverrides = normalizeStoredPermissionOverrides(legacySource);

  if (
    normalizedOverrides[ROLE_CASHIER] &&
    !normalizedOverrides[ROLE_CASHIER].addItems
  ) {
    normalizedOverrides[ROLE_CASHIER] = applyCashierBasePermissions(
      normalizedOverrides[ROLE_CASHIER],
    );
  }

  if (
    normalizedOverrides[ROLE_CASHIER] &&
    !normalizedOverrides[ROLE_CASHIER].manageExpenses
  ) {
    normalizedOverrides[ROLE_CASHIER] = applyCashierBasePermissions(
      normalizedOverrides[ROLE_CASHIER],
    );
  }

  if (
    normalizedOverrides[ROLE_CASHIER] &&
    looksLikeBrokenCashierPermissions(normalizedOverrides[ROLE_CASHIER])
  ) {
    normalizedOverrides[ROLE_CASHIER] = applyCashierBasePermissions(
      normalizedOverrides[ROLE_CASHIER],
    );
  }

  if (
    normalizedOverrides[ROLE_WAITER] &&
    looksLikeBrokenWaiterPermissions(normalizedOverrides[ROLE_WAITER])
  ) {
    normalizedOverrides[ROLE_WAITER] = applyWaiterBasePermissions(
      normalizedOverrides[ROLE_WAITER],
    );
  }

  return normalizedOverrides;
}

export function getDefaultRolePermissions(role) {
  const normalizedRole = normalizeRole(role);
  return clonePermissions(ROLE_PERMISSIONS[normalizedRole] || EMPTY_PERMISSIONS);
}

export function readRolePermissionOverrides() {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(ROLE_PERMISSION_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);

    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      parsedValue.schema_version === ROLE_PERMISSION_STORAGE_VERSION &&
      parsedValue.overrides &&
      typeof parsedValue.overrides === "object"
    ) {
      const storedCashierOverrides =
        parsedValue.overrides[ROLE_CASHIER] &&
        typeof parsedValue.overrides[ROLE_CASHIER] === "object"
          ? parsedValue.overrides[ROLE_CASHIER]
          : null;
      const storedWaiterOverrides =
        parsedValue.overrides[ROLE_WAITER] &&
        typeof parsedValue.overrides[ROLE_WAITER] === "object"
          ? parsedValue.overrides[ROLE_WAITER]
          : null;

      if (
        (storedCashierOverrides &&
          (!Object.prototype.hasOwnProperty.call(
            storedCashierOverrides,
            "manageExpenses",
          ) ||
            looksLikeBrokenCashierPermissions(storedCashierOverrides))) ||
        (storedWaiterOverrides &&
          looksLikeBrokenWaiterPermissions(storedWaiterOverrides))
      ) {
        const migratedOverrides = upgradeLegacyPermissionOverrides(parsedValue);
        writeRolePermissionOverrides(migratedOverrides);
        return migratedOverrides;
      }

      return normalizeStoredPermissionOverrides(parsedValue.overrides);
    }

    const migratedOverrides = upgradeLegacyPermissionOverrides(parsedValue);
    writeRolePermissionOverrides(migratedOverrides);
    return migratedOverrides;
  } catch (error) {
    console.warn("Failed to read role permission overrides", error);
    return {};
  }
}

export function writeRolePermissionOverrides(overrides) {
  if (!canUseStorage()) {
    return;
  }

  const normalizedOverrides = normalizeStoredPermissionOverrides(overrides);

  window.localStorage.setItem(
    ROLE_PERMISSION_STORAGE_KEY,
    JSON.stringify({
      schema_version: ROLE_PERMISSION_STORAGE_VERSION,
      overrides: normalizedOverrides,
    }),
  );
}

export function clearRolePermissionOverrides() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ROLE_PERMISSION_STORAGE_KEY);
}

export function getRolePermissions(role) {
  const normalizedRole = normalizeRole(role);
  const defaultPermissions = getDefaultRolePermissions(normalizedRole);

  if (normalizedRole === ROLE_ADMIN) {
    return defaultPermissions;
  }

  const overrides = readRolePermissionOverrides();
  const roleOverrides = overrides[normalizedRole];

  if (!roleOverrides || typeof roleOverrides !== "object") {
    return defaultPermissions;
  }

  return {
    ...defaultPermissions,
    ...roleOverrides,
  };
}

export function getEditableRolePermissions() {
  return {
    [ROLE_ADMIN]: getRolePermissions(ROLE_ADMIN),
    [ROLE_CASHIER]: getRolePermissions(ROLE_CASHIER),
    [ROLE_WAITER]: getRolePermissions(ROLE_WAITER),
  };
}

export function buildEditableRolePermissionOverrides(permissionMap) {
  const nextOverrides = {};

  MANAGED_ROLES.forEach((role) => {
    nextOverrides[role] = getDefaultRolePermissions(role);

    Object.keys(EMPTY_PERMISSIONS).forEach((permissionKey) => {
      nextOverrides[role][permissionKey] = Boolean(
        permissionMap?.[role]?.[permissionKey],
      );
    });
  });

  return nextOverrides;
}

export function saveEditableRolePermissions(permissionMap) {
  const nextOverrides = buildEditableRolePermissionOverrides(permissionMap);
  writeRolePermissionOverrides(nextOverrides);
}

export function hasPermission(role, permissionKey) {
  return Boolean(getRolePermissions(role)[permissionKey]);
}

export function getStoredUser() {
  if (typeof window === "undefined") {
    return {
      id: null,
      username: "",
      role: "",
    };
  }

  const rawUserId = window.localStorage.getItem("userId");
  const parsedUserId = Number(rawUserId);

  return {
    id: Number.isFinite(parsedUserId) ? parsedUserId : null,
    username: window.localStorage.getItem("username") || "",
    role: normalizeRole(window.localStorage.getItem("role")),
  };
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("token");
  window.localStorage.removeItem("role");
  window.localStorage.removeItem("userId");
  window.localStorage.removeItem("username");
}

export function isLineOwnedByUser(item, user) {
  if (!item || !user) {
    return false;
  }

  if (user.id != null && item.created_by_user_id != null) {
    return Number(item.created_by_user_id) === Number(user.id);
  }

  const itemOwnerName = String(item.created_by_username || "")
    .trim()
    .toLowerCase();
  const username = String(user.username || "")
    .trim()
    .toLowerCase();

  return Boolean(itemOwnerName && username && itemOwnerName === username);
}
