import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AppSidebarLayout from "../components/AppSidebarLayout";
import {
  ACCESS_CONTROL_SECTIONS,
  ROLE_ADMIN,
  ROLE_CASHIER,
  ROLE_WAITER,
  buildEditableRolePermissionOverrides,
  clearRolePermissionOverrides,
  formatRoleLabel,
  getDefaultRolePermissions,
  getEditableRolePermissions,
  getStoredUser,
  normalizeRole,
  saveEditableRolePermissions,
  writeRolePermissionOverrides,
} from "../lib/accessControl";
import { API } from "../lib/api";
import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptSettings,
  readStoredReceiptSettings,
  writeStoredReceiptSettings,
} from "../lib/receiptSettings";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function prepareReceiptLogoImage(file, maxWidth = 300) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);

  if (image.width <= maxWidth) {
    return dataUrl;
  }

  const scale = maxWidth / image.width;
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = Math.max(Math.round(image.height * scale), 1);
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg");
}

function buildDefaultPermissionMap() {
  return {
    [ROLE_ADMIN]: getDefaultRolePermissions(ROLE_ADMIN),
    [ROLE_CASHIER]: getDefaultRolePermissions(ROLE_CASHIER),
    [ROLE_WAITER]: getDefaultRolePermissions(ROLE_WAITER),
  };
}

function serializePermissionMap(permissionMap) {
  return JSON.stringify(permissionMap);
}

function formatStockQuantity(value) {
  const quantity = Number(value || 0);

  if (!Number.isFinite(quantity)) {
    return "0";
  }

  if (Number.isInteger(quantity)) {
    return String(quantity);
  }

  return quantity.toFixed(3).replace(/\.?0+$/, "");
}

function getProductDisplayPosition(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 1 ? parsedValue : 9999;
}

function getCategoryDisplayPosition(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 1 ? parsedValue : 9999;
}

function sortCategoriesByPosition(items) {
  return [...(items || [])].sort((leftCategory, rightCategory) => {
    const positionComparison =
      getCategoryDisplayPosition(leftCategory.display_position) -
      getCategoryDisplayPosition(rightCategory.display_position);

    if (positionComparison !== 0) {
      return positionComparison;
    }

    return String(leftCategory.name || "").localeCompare(
      String(rightCategory.name || ""),
    );
  });
}

function sortProductsByCategoryAndPosition(items) {
  return [...(items || [])].sort((leftItem, rightItem) => {
    const categoryPositionComparison =
      getCategoryDisplayPosition(leftItem.category_display_position) -
      getCategoryDisplayPosition(rightItem.category_display_position);

    if (categoryPositionComparison !== 0) {
      return categoryPositionComparison;
    }

    const categoryComparison = String(leftItem.category_name || "").localeCompare(
      String(rightItem.category_name || ""),
    );

    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    const positionComparison =
      getProductDisplayPosition(leftItem.display_position) -
      getProductDisplayPosition(rightItem.display_position);

    if (positionComparison !== 0) {
      return positionComparison;
    }

    return String(leftItem.name || "").localeCompare(String(rightItem.name || ""));
  });
}

function getRequestErrorMessage(error, fallbackMessage) {
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

function isNetworkError(error) {
  return (
    !error?.response &&
    (error?.code === "ERR_NETWORK" || error?.message === "Network Error")
  );
}

function formatStockMovementType(value) {
  const normalizedValue = String(value || "IN")
    .trim()
    .toUpperCase();

  if (normalizedValue === "OUT") {
    return "Decrease";
  }

  if (normalizedValue === "OPENING") {
    return "Opening";
  }

  return "Increase";
}

function getStockMovementTypeClass(value) {
  const normalizedValue = String(value || "IN")
    .trim()
    .toUpperCase();

  if (normalizedValue === "OUT") {
    return "bg-rose-100 text-rose-700";
  }

  if (normalizedValue === "OPENING") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function getPrinterUsageLabel(printer) {
  if (printer?.main_bill_enabled) {
    return "Main Bill Printer";
  }

  if (printer?.token_print_enabled) {
    return "Token Printer";
  }

  return "Unused";
}

function getPrinterUsageClass(printer) {
  if (printer?.main_bill_enabled) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (printer?.token_print_enabled) {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-slate-100 text-slate-500";
}

function getSystemPrinterOptionLabel(printer) {
  if (!printer?.name) {
    return "";
  }

  return printer.is_default ? `${printer.name} (Default)` : printer.name;
}

function getAssignablePrinterLabel(printer) {
  if (!printer) {
    return "";
  }

  if (printer.token_print_enabled) {
    return `${printer.name} (${printer.target})`;
  }

  return `${printer.name} (${printer.target}) - Available`;
}

function getReceiptAlignmentClass(value) {
  const normalizedValue = String(value || "CENTER").trim().toUpperCase();

  if (normalizedValue === "LEFT") {
    return "text-left";
  }

  if (normalizedValue === "RIGHT") {
    return "text-right";
  }

  return "text-center";
}

function getReceiptPreviewLogoClass(value) {
  const numericValue = Number(value);
  const maxWidth = Number.isFinite(numericValue)
    ? Math.min(Math.max(Math.round(numericValue), 80), 300)
    : 200;
  const maxHeight = Math.max(Math.round(maxWidth * 0.38), 40);

  return {
    maxWidth: `${maxWidth}px`,
    maxHeight: `${maxHeight}px`,
  };
}

function getReceiptPreviewTextStyle(value, fallbackValue = 13) {
  const numericValue = Number(value);
  const fontSize = Number.isFinite(numericValue)
    ? Math.min(Math.max(Math.round(numericValue), 9), 56)
    : fallbackValue;

  return {
    fontSize: `${fontSize}px`,
    lineHeight: `${Math.max(Math.round(fontSize * 1.35), fontSize + 2)}px`,
  };
}

function ReceiptFontSlider({
  label,
  value,
  onChange,
  min = 9,
  max = 48,
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
          {value}px
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer accent-blue-600"
      />
    </div>
  );
}

function ReceiptPreview({ settings }) {
  const normalizedSettings = normalizeReceiptSettings(settings);
  const previewItems = [
    { name: "Chicken Fried Rice", price: 140, qty: 1 },
    { name: "Pepsi", price: 40, qty: 2 },
  ];
  const total = previewItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Sample Bill Preview
      </div>
      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[320px] rounded-[24px] border border-slate-300 bg-white p-5 font-mono text-[12px] font-bold text-slate-900 shadow-sm">
          {normalizedSettings.logo_enabled && normalizedSettings.logo_image && (
            <div className={`${getReceiptAlignmentClass(normalizedSettings.logo_alignment)}`}>
              <img
                src={normalizedSettings.logo_image}
                alt="Receipt logo"
                className="inline-block object-contain"
                style={getReceiptPreviewLogoClass(normalizedSettings.logo_width)}
              />
            </div>
          )}

          {normalizedSettings.header_text && (
            <div
              style={getReceiptPreviewTextStyle(
                normalizedSettings.header_font_size,
                18,
              )}
              className={`mt-2 whitespace-pre-line ${getReceiptAlignmentClass(
                normalizedSettings.header_alignment,
              )}`}
            >
              {normalizedSettings.header_text}
            </div>
          )}

          {normalizedSettings.title_enabled && (
            <div
              style={getReceiptPreviewTextStyle(
                normalizedSettings.title_font_size,
                18,
              )}
              className="mt-3 border-t border-dashed border-slate-400 pt-3 text-center uppercase tracking-[0.14em]"
            >
              Receipt
            </div>
          )}

          {normalizedSettings.details_enabled && (
            <div
              style={getReceiptPreviewTextStyle(
                normalizedSettings.details_font_size,
                12,
              )}
              className="mt-3 space-y-1"
            >
              <div className="flex justify-between gap-3">
                <span className="font-semibold">Receipt:</span>
                <span>00025</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold">Date:</span>
                <span>27 Mar 2026 06:30 PM</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold">Table:</span>
                <span>Parcel</span>
              </div>
            </div>
          )}

          <div
            style={getReceiptPreviewTextStyle(
              normalizedSettings.item_font_size,
              13,
            )}
            className="mt-3 border-t border-b border-dashed border-slate-400 py-2"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_52px_84px] gap-2 border-b border-dashed border-slate-400 pb-1 text-[11px] font-semibold uppercase">
              <div>Item</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Price</div>
            </div>
            <div className="mt-2 space-y-1">
              {previewItems.map((item) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[minmax(0,1fr)_52px_84px] gap-2"
                >
                  <div className="truncate">{item.name}</div>
                  <div className="text-right">{item.qty}</div>
                  <div className="text-right">{item.price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={getReceiptPreviewTextStyle(
              normalizedSettings.summary_font_size,
              14,
            )}
            className="mt-3 space-y-1"
          >
            <div className="flex justify-between gap-3 text-sm font-bold">
              <span>Total</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>

          {normalizedSettings.footer_enabled && normalizedSettings.footer_text && (
            <div
              style={getReceiptPreviewTextStyle(
                normalizedSettings.footer_font_size,
                12,
              )}
              className={`mt-4 border-t border-dashed border-slate-400 pt-3 whitespace-pre-line ${getReceiptAlignmentClass(
                normalizedSettings.footer_alignment,
              )}`}
            >
              {normalizedSettings.footer_text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenPreview() {
  const previewItems = [
    { name: "Pepsi", qty: 5 },
    { name: "Chicken Fried Rice", qty: 1 },
  ];

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Sample Token Preview
      </div>
      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[320px] rounded-[24px] border border-slate-300 bg-white p-5 font-mono text-[12px] font-bold uppercase text-slate-900 shadow-sm">
          <div className="text-center text-[24px] tracking-[0.06em]">
            Parcel
          </div>

          <div className="mt-3 space-y-1 text-[12px] normal-case">
            <div className="flex justify-between gap-3">
              <span className="uppercase">Order No:</span>
              <span>00025</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="uppercase">Date:</span>
              <span>27 Mar 2026 06:30 PM</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="uppercase">Sender:</span>
              <span>Admin</span>
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-slate-400 pt-2">
            <div className="grid grid-cols-[58px_minmax(0,1fr)] gap-2 border-b border-dashed border-slate-400 pb-1 text-[11px]">
              <div>QTY</div>
              <div>ITEM</div>
            </div>

            <div className="mt-2 space-y-2 text-[14px]">
              {previewItems.map((item) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[58px_minmax(0,1fr)] gap-2"
                >
                  <div>{item.qty}X</div>
                  <div className="break-words">{item.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Maintenance({ page = "floors" }) {
  const { role } = getStoredUser();

  return (
    <AppSidebarLayout role={role} currentPage={page}>
      <div className="overflow-auto">
        {page === "users" && <Users />}
        {page === "printers" && <PrintersTab />}
        {page === "access-control" && <AccessControlTab />}
        {page === "floors" && <Floors />}
        {page === "tables" && <Tables />}
        {page === "stock" && <Stock />}
      </div>
    </AppSidebarLayout>
  );
}

function AccessControlTab() {
  const roles = [ROLE_ADMIN, ROLE_CASHIER, ROLE_WAITER];
  const [permissionMap, setPermissionMap] = useState(() =>
    getEditableRolePermissions(),
  );
  const [savedSignature, setSavedSignature] = useState(() =>
    serializePermissionMap(getEditableRolePermissions()),
  );
  const [saveState, setSaveState] = useState("idle");
  const hasChanges = serializePermissionMap(permissionMap) !== savedSignature;

  const syncPermissionMapFromOverrides = (permissionOverrides) => {
    writeRolePermissionOverrides(permissionOverrides);
    const nextPermissionMap = getEditableRolePermissions();
    setPermissionMap(nextPermissionMap);
    setSavedSignature(serializePermissionMap(nextPermissionMap));
    return nextPermissionMap;
  };

  const loadPermissionOverrides = async () => {
    try {
      const response = await axios.get(`${API}/access-control`);
      syncPermissionMapFromOverrides(response.data?.permission_overrides || {});
    } catch (error) {
      console.error(error);
      alert("Failed to load access control");
    }
  };

  useEffect(() => {
    loadPermissionOverrides();
  }, []);

  useEffect(() => {
    if (saveState !== "saved") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSaveState("idle");
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [saveState]);

  const togglePermission = (role, permissionKey) => {
    if (role === ROLE_ADMIN) {
      return;
    }

    setPermissionMap((currentValue) => ({
      ...currentValue,
      [role]: {
        ...currentValue[role],
        [permissionKey]: !currentValue?.[role]?.[permissionKey],
      },
    }));
    setSaveState("idle");
  };

  const saveChanges = async () => {
    try {
      setSaveState("idle");
      const response = await axios.put(`${API}/access-control`, {
        permission_overrides: buildEditableRolePermissionOverrides(permissionMap),
      });
      const savedOverrides = response.data?.permission_overrides || {};
      syncPermissionMapFromOverrides(savedOverrides);
      saveEditableRolePermissions(permissionMap);
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      alert("Failed to save access control");
    }
  };

  const resetDefaults = async () => {
    try {
      await axios.delete(`${API}/access-control`);
      clearRolePermissionOverrides();
      const nextPermissionMap = buildDefaultPermissionMap();
      setPermissionMap(nextPermissionMap);
      setSavedSignature(serializePermissionMap(nextPermissionMap));
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      alert("Failed to reset access control");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Access Control</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Admin can edit the cashier and waiter permission sets here, and
              those changes apply to every user assigned to that role. Admin stays
              full access by default and is locked to avoid accidental lockout.
              Existing users with the old{" "}
              <span className="font-semibold">BILLING</span> role now behave as{" "}
              <span className="font-semibold">Cashier</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                saveState === "saved"
                  ? "bg-emerald-100 text-emerald-700"
                  : hasChanges
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {saveState === "saved"
                ? "Changes Saved"
                : hasChanges
                  ? "Unsaved Changes"
                  : "Ready"}
            </div>
            <button
              type="button"
              onClick={resetDefaults}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={saveChanges}
              disabled={!hasChanges}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((role) => (
          <div
            key={role}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Role
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatRoleLabel(role)}
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-500">
              {role === ROLE_ADMIN && (
                <p>Full privilege by default, including administration. Locked.</p>
              )}
              {role === ROLE_CASHIER && (
                <p>
                  Can open bills, receive payment, print receipts, reprint bills,
                  and view open tables. Editable below.
                </p>
              )}
              {role === ROLE_WAITER && (
                <p>
                  Can open tables, add items, delete own lines, print kitchen
                  tickets, and move tables. Editable below.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {ACCESS_CONTROL_SECTIONS.map((section) => (
        <div key={section.title} className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{section.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                Admin remains always allowed. Cashier and waiter permissions can be
                changed and saved from this screen.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1.8fr)_0.7fr_0.7fr_0.7fr] gap-3 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div>Permission</div>
              <div className="text-center">Admin</div>
              <div className="text-center">Cashier</div>
              <div className="text-center">Waiter</div>
            </div>

            {section.items.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-[minmax(0,1.8fr)_0.7fr_0.7fr_0.7fr] gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-700"
              >
                <div className="font-medium text-slate-900">{item.label}</div>
                {roles.map((role) => (
                  role === ROLE_ADMIN ? (
                    <div
                      key={`${item.key}-${role}`}
                      className="text-center"
                    >
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Always Allowed
                      </span>
                    </div>
                  ) : (
                    <div key={`${item.key}-${role}`} className="text-center">
                      <button
                        type="button"
                        onClick={() => togglePermission(role, item.key)}
                        className={`min-w-[110px] rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          permissionMap?.[role]?.[item.key]
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {permissionMap?.[role]?.[item.key] ? "Allowed" : "Blocked"}
                      </button>
                    </div>
                  )
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Users() {
  const currentUser = getStoredUser();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    role: "WAITER",
  });
  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const loadUsers = async () => {
    const res = await axios.get(`${API}/users`);
    setUsers(res.data);

    if (selectedUser) {
      const updatedSelectedUser = res.data.find((user) => user.id === selectedUser.id);
      setSelectedUser(updatedSelectedUser || null);
    }
  };

  const openCreateUser = () => {
    setShowCreateUser(true);
    setForm({
      username: "",
      password: "",
      confirmPassword: "",
      role: "WAITER",
    });
  };

  const closeCreateUser = () => {
    setShowCreateUser(false);
    setForm({
      username: "",
      password: "",
      confirmPassword: "",
      role: "WAITER",
    });
  };

  const addUser = async () => {
    if (!form.username || !form.password || !form.confirmPassword) {
      alert("Enter username, password and confirm password");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Password and confirm password must match");
      return;
    }

    try {
      const res = await axios.post(`${API}/users`, {
        username: form.username,
        password: form.password,
        role: form.role,
      });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      setForm({
        username: "",
        password: "",
        confirmPassword: "",
        role: "WAITER",
      });
      closeCreateUser();
      loadUsers();
    } catch (error) {
      console.error(error);
      alert(getRequestErrorMessage(error, "Failed to add user"));
    }
  };

  const updateSelectedUserRole = async () => {
    if (!selectedUser) {
      return;
    }

    try {
      const response = await axios.put(`${API}/users/${selectedUser.id}/role`, {
        role: selectedUser.role,
      });

      if (response.data.error) {
        alert(response.data.error);
        return;
      }

      const normalizedRole = normalizeRole(response.data.role || selectedUser.role);

      if (currentUser.id != null && Number(currentUser.id) === Number(selectedUser.id)) {
        localStorage.setItem("role", normalizedRole);
        window.location = "/billing";
        return;
      }

      await loadUsers();
      alert("Role updated");
    } catch (error) {
      console.error(error);
      alert("Failed to update role");
    }
  };

  const openChangePassword = (user) => {
    setPasswordUser(user);
    setPasswordForm({
      password: "",
      confirmPassword: "",
    });
  };

  const closeChangePassword = () => {
    setPasswordUser(null);
    setPasswordForm({
      password: "",
      confirmPassword: "",
    });
  };

  const openDeleteUserPrompt = (user) => {
    if (user.username.trim().toLowerCase() === "admin") {
      alert("Default admin user cannot be deleted");
      return;
    }

    setDeleteUserTarget(user);
  };

  const closeDeleteUserPrompt = () => {
    setDeleteUserTarget(null);
  };

  const changePassword = async () => {
    const password = passwordForm.password.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!password || !confirmPassword) {
      alert("Enter new password and confirm password");
      return;
    }

    if (password !== confirmPassword) {
      alert("Password and confirm password must match");
      return;
    }

    try {
      await axios.put(`${API}/users/${passwordUser.id}`, { password });
      closeChangePassword();
      alert("Password changed");
    } catch (error) {
      console.error(error);
      alert("Failed to change password");
    }
  };

  const deleteUser = async () => {
    if (!deleteUserTarget) {
      return;
    }

    try {
      const res = await axios.delete(`${API}/users/${deleteUserTarget.id}`);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      if (selectedUser?.id === deleteUserTarget.id) {
        setSelectedUser(null);
      }

      closeDeleteUserPrompt();
      loadUsers();
    } catch (error) {
      console.error(error);
      alert("Failed to delete user");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl">Users</h2>
        <button
          onClick={openCreateUser}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Create New User
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="bg-white rounded shadow p-3">
          <h3 className="font-semibold mb-3">User List</h3>

          <div className="space-y-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser({ ...user, role: normalizeRole(user.role) })}
                className={`w-full rounded border p-3 text-left transition ${
                  selectedUser?.id === user.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="font-semibold">{user.username}</div>
                <div className="text-sm text-gray-500">
                  {formatRoleLabel(user.role)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          {selectedUser ? (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{selectedUser.username}</h3>
                <div className="mt-3 max-w-xs">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Role
                  </label>
                  <select
                    value={selectedUser.role}
                    onChange={(e) =>
                      setSelectedUser((currentValue) => ({
                        ...currentValue,
                        role: normalizeRole(e.target.value),
                      }))
                    }
                    disabled={selectedUser.username.trim().toLowerCase() === "admin"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 disabled:bg-slate-100"
                  >
                    <option value={ROLE_ADMIN}>{formatRoleLabel(ROLE_ADMIN)}</option>
                    <option value={ROLE_CASHIER}>{formatRoleLabel(ROLE_CASHIER)}</option>
                    <option value={ROLE_WAITER}>{formatRoleLabel(ROLE_WAITER)}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={updateSelectedUserRole}
                  disabled={
                    selectedUser.username.trim().toLowerCase() === "admin" ||
                    normalizeRole(
                      users.find((user) => user.id === selectedUser.id)?.role,
                    ) === normalizeRole(selectedUser.role)
                  }
                  className="bg-blue-500 text-white px-4 py-2 rounded disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  Save Role
                </button>

                <button
                  onClick={() => openChangePassword(selectedUser)}
                  className="bg-amber-500 text-white px-4 py-2 rounded"
                >
                  Change Password
                </button>

                {selectedUser.username.trim().toLowerCase() !== "admin" ? (
                  <button
                    onClick={() => openDeleteUserPrompt(selectedUser)}
                    className="bg-red-500 text-white px-4 py-2 rounded"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="text-sm text-gray-500">
                    Default admin user keeps the Admin role and cannot be deleted
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-gray-500">
              Click a user from the list to view actions.
            </div>
          )}
        </div>
      </div>

      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                Create New User
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Enter username, password, confirm password, and role.
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />

              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />

              <input
                type="password"
                placeholder="Confirm Password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />

              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              >
                <option value={ROLE_ADMIN}>{formatRoleLabel(ROLE_ADMIN)}</option>
                <option value={ROLE_CASHIER}>{formatRoleLabel(ROLE_CASHIER)}</option>
                <option value={ROLE_WAITER}>{formatRoleLabel(ROLE_WAITER)}</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeCreateUser}
                className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={addUser}
                className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                Change Password
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Update password for <span className="font-semibold">{passwordUser.username}</span>
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                placeholder="New password"
                value={passwordForm.password}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    password: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />

              <input
                type="password"
                placeholder="Confirm password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeChangePassword}
                className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={changePassword}
                className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white hover:bg-amber-600"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                Delete User
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteUserTarget.username}</span>?
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeDeleteUserPrompt}
                className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={deleteUser}
                className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Floors() {
  const [floors, setFloors] = useState([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const loadFloors = async () => {
    const res = await axios.get(`${API}/floors`);
    setFloors(res.data);
  };

  const addFloor = async () => {
    if (!name.trim()) {
      alert("Enter floor name");
      return;
    }

    try {
      const res = await axios.post(`${API}/floors`, { name });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      setName("");
      loadFloors();
    } catch (error) {
      console.error(error);
      alert("Failed to add floor");
    }
  };

  const updateFloor = async (floorId) => {
    if (!editName.trim()) {
      alert("Enter floor name");
      return;
    }

    try {
      const res = await axios.put(`${API}/floors/${floorId}`, { name: editName });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      setEditId(null);
      setEditName("");
      loadFloors();
    } catch (error) {
      console.error(error);
      alert("Failed to update floor");
    }
  };

  const deleteFloor = async (floorId) => {
    if (!window.confirm("Delete this floor?")) {
      return;
    }

    try {
      await axios.delete(`${API}/floors/${floorId}`);
      loadFloors();
    } catch (error) {
      console.error(error);
      alert("Failed to delete floor");
    }
  };

  useEffect(() => {
    loadFloors();
  }, []);

  return (
    <div>
      <h2 className="text-xl mb-4">Floors</h2>

      <input
        placeholder="Floor Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="p-2 border mr-2"
      />

      <button
        onClick={addFloor}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Add Floor
      </button>

      <div className="mt-4 space-y-2">
        {floors.map((floor) => (
          <div key={floor.id} className="p-3 bg-white rounded shadow">
            {editId === floor.id ? (
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="p-2 border"
                />
                <button
                  onClick={() => updateFloor(floor.id)}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditId(null);
                    setEditName("");
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <span>{floor.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditId(floor.id);
                      setEditName(floor.name);
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteFloor(floor.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tables() {
  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState([]);
  const [form, setForm] = useState({ name: "", floor_id: "" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", floor_id: "" });

  const loadTables = async () => {
    const res = await axios.get(`${API}/tables`);
    setTables(res.data);
  };

  const loadFloors = async () => {
    const res = await axios.get(`${API}/floors`);
    setFloors(res.data);
  };

  const addTable = async () => {
    if (!form.name.trim() || !form.floor_id) {
      alert("Enter table name and select floor");
      return;
    }

    try {
      const res = await axios.post(`${API}/tables`, form);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      setForm({ name: "", floor_id: "" });
      loadTables();
    } catch (error) {
      console.error(error);
      alert("Failed to add table");
    }
  };

  const updateTable = async (tableId) => {
    if (!editForm.name.trim() || !editForm.floor_id) {
      alert("Enter table name and select floor");
      return;
    }

    try {
      const res = await axios.put(`${API}/tables/${tableId}`, editForm);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      setEditId(null);
      setEditForm({ name: "", floor_id: "" });
      loadTables();
    } catch (error) {
      console.error(error);
      alert("Failed to update table");
    }
  };

  const deleteTable = async (tableId) => {
    if (!window.confirm("Delete this table?")) {
      return;
    }

    try {
      await axios.delete(`${API}/tables/${tableId}`);
      loadTables();
    } catch (error) {
      console.error(error);
      alert("Failed to delete table");
    }
  };

  useEffect(() => {
    loadTables();
    loadFloors();
  }, []);

  return (
    <div>
      <h2 className="text-xl mb-4">Tables</h2>

      <input
        placeholder="Table Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="p-2 border mr-2"
      />

      <select
        value={form.floor_id}
        onChange={(e) => setForm({ ...form, floor_id: e.target.value })}
        className="p-2 border mr-2"
      >
        <option value="">Select Floor</option>
        {floors.map((floor) => (
          <option key={floor.id} value={floor.id}>
            {floor.name}
          </option>
        ))}
      </select>

      <button
        onClick={addTable}
        className="bg-purple-500 text-white px-4 py-2 rounded"
      >
        Add Table
      </button>

      <div className="mt-4 space-y-2">
        {tables.map((table) => (
          <div key={table.id} className="p-3 bg-white rounded shadow">
            {editId === table.id ? (
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="p-2 border"
                />
                <select
                  value={editForm.floor_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, floor_id: e.target.value })
                  }
                  className="p-2 border"
                >
                  <option value="">Select Floor</option>
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => updateTable(table.id)}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditId(null);
                    setEditForm({ name: "", floor_id: "" });
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <span>
                  {table.name} ({table.floor})
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditId(table.id);
                      setEditForm({
                        name: table.name,
                        floor_id: String(table.floor_id),
                      });
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTable(table.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintersTab() {
  const [printers, setPrinters] = useState([]);
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [form, setForm] = useState({
    name: "",
    target: "",
    usage: "TOKEN",
  });
  const [receiptSettings, setReceiptSettings] = useState(() =>
    readStoredReceiptSettings(),
  );
  const [receiptSaveState, setReceiptSaveState] = useState("idle");
  const defaultSystemPrinter =
    systemPrinters.find((printer) => printer.is_default) || systemPrinters[0] || null;

  const loadPrinters = async () => {
    const res = await axios.get(`${API}/stock/printers`);
    setPrinters(res.data);
  };

  const loadSystemPrinters = async () => {
    const res = await axios.get(`${API}/stock/system-printers`);
    setSystemPrinters(res.data);
  };

  const loadData = async () => {
    const [printersResult, systemPrintersResult, receiptSettingsResult] =
      await Promise.allSettled([
        axios.get(`${API}/stock/printers`),
        axios.get(`${API}/stock/system-printers`),
        axios.get(`${API}/stock/receipt-settings`),
      ]);

    if (printersResult.status === "fulfilled") {
      setPrinters(printersResult.value.data);
    } else {
      console.error(printersResult.reason);
      setPrinters([]);
    }

    if (systemPrintersResult.status === "fulfilled") {
      setSystemPrinters(systemPrintersResult.value.data);
    } else {
      console.error(systemPrintersResult.reason);
      setSystemPrinters([]);
    }

    if (receiptSettingsResult.status === "fulfilled") {
      const normalizedSettings = normalizeReceiptSettings(
        receiptSettingsResult.value.data,
      );
      setReceiptSettings(normalizedSettings);
      writeStoredReceiptSettings(normalizedSettings);
      return;
    }

    console.error(receiptSettingsResult.reason);
    setReceiptSettings(readStoredReceiptSettings());
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!defaultSystemPrinter || form.target) {
      return;
    }

    setForm((currentValue) => ({
      ...currentValue,
      target: currentValue.target || defaultSystemPrinter.name,
    }));
  }, [defaultSystemPrinter, form.target]);

  useEffect(() => {
    if (receiptSaveState !== "saved") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setReceiptSaveState("idle");
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [receiptSaveState]);

  const addPrinter = async () => {
    if (!form.name.trim()) {
      alert("Enter printer name");
      return;
    }

    if (!form.target) {
      alert("Select system printer");
      return;
    }

    try {
      const res = await axios.post(`${API}/stock/printers`, {
        name: form.name,
        target: form.target,
        token_print_enabled: form.usage === "TOKEN",
        main_bill_enabled: form.usage === "MAIN_BILL",
      });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      setForm({
        name: "",
        target: "",
        usage: "TOKEN",
      });
      loadPrinters();
    } catch (error) {
      console.error(error);
      alert("Failed to add printer");
    }
  };

  const updatePrinterOptions = async (printer, changes) => {
    try {
      const res = await axios.put(`${API}/stock/printers/${printer.id}`, {
        token_print_enabled:
          changes.token_print_enabled ?? !!printer.token_print_enabled,
        main_bill_enabled:
          changes.main_bill_enabled ?? !!printer.main_bill_enabled,
      });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      loadPrinters();
    } catch (error) {
      console.error(error);
      alert("Failed to update printer options");
    }
  };

  const deletePrinter = async (printerId) => {
    if (!window.confirm("Delete this printer?")) {
      return;
    }

    try {
      const res = await axios.delete(`${API}/stock/printers/${printerId}`);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      loadPrinters();
    } catch (error) {
      console.error(error);
      alert("Failed to delete printer");
    }
  };

  const setReceiptField = (field, value) => {
    setReceiptSettings((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
    setReceiptSaveState("idle");
  };

  const handleReceiptLogoChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      alert("Receipt logo supports PNG or JPG only");
      event.target.value = "";
      return;
    }

    try {
      const logoImage = await prepareReceiptLogoImage(file, 300);
      setReceiptSettings((currentValue) => ({
        ...currentValue,
        logo_enabled: true,
        logo_image: logoImage,
      }));
      setReceiptSaveState("idle");
    } catch (error) {
      console.error(error);
      alert("Failed to prepare receipt logo");
    } finally {
      event.target.value = "";
    }
  };

  const saveReceiptSettings = async () => {
    try {
      setReceiptSaveState("saving");
      const response = await axios.put(
        `${API}/stock/receipt-settings`,
        receiptSettings,
      );

      if (response.data?.error) {
        setReceiptSaveState("idle");
        alert(response.data.error);
        return;
      }

      const normalizedSettings = normalizeReceiptSettings(
        response.data?.settings || receiptSettings,
      );
      setReceiptSettings(normalizedSettings);
      writeStoredReceiptSettings(normalizedSettings);
      setReceiptSaveState("saved");
    } catch (error) {
      console.error(error);
      setReceiptSaveState("idle");
      const normalizedSettings = normalizeReceiptSettings(receiptSettings);
      writeStoredReceiptSettings(normalizedSettings);
      setReceiptSettings(normalizedSettings);
      alert(
        isNetworkError(error)
          ? "Backend not connected. Receipt settings were saved locally on this device."
          : getRequestErrorMessage(error, "Failed to save receipt settings"),
      );
    }
  };

  const alignmentOptions = ["LEFT", "CENTER", "RIGHT"];
  const itemLayoutOptions = ["COMPACT", "DETAILED"];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">System Printers</h2>
        <p className="mt-1 text-sm text-slate-500">
          Installed system printers are shown here and can be mapped to POS
          printer names.
        </p>

        {systemPrinters.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {systemPrinters.map((printer) => (
              <div
                key={printer.name}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {getSystemPrinterOptionLabel(printer)}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No system printers were detected right now. Make sure the printer
            service is running and the printers are installed in the system.
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Add POS Printer</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add one main bill printer for the counter and use the other printers
          as token printers for kitchen or section orders.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            placeholder="Printer Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />

          <select
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          >
            <option value="">Select System Printer</option>
            {systemPrinters.map((printer) => (
              <option key={printer.name} value={printer.name}>
                {getSystemPrinterOptionLabel(printer)}
              </option>
            ))}
          </select>

          <select
            value={form.usage}
            onChange={(e) => setForm({ ...form, usage: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          >
            <option value="TOKEN">Token Printer</option>
            <option value="MAIN_BILL">Main Bill Printer</option>
          </select>

          <button
            onClick={addPrinter}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Add Printer
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {printers.map((printer) => (
          <div key={printer.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">{printer.name}</div>
              <div
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getPrinterUsageClass(
                  printer,
                )}`}
              >
                {getPrinterUsageLabel(printer)}
              </div>
            </div>
            <div className="mt-1 text-sm text-slate-500">
              System Printer: {printer.target}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  updatePrinterOptions(printer, {
                    token_print_enabled: true,
                    main_bill_enabled: false,
                  })
                }
                className="rounded-full bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700"
              >
                Set Token Printer
              </button>
              <button
                onClick={() =>
                  updatePrinterOptions(printer, {
                    token_print_enabled: false,
                    main_bill_enabled: true,
                  })
                }
                className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700"
              >
                Set Main Bill Printer
              </button>
            </div>
            <button
              onClick={() => deletePrinter(printer.id)}
              className="mt-4 rounded bg-red-500 px-3 py-2 text-white hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Print Receipt Settings
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Customize the receipt logo, business header, and footer without
              code changes. PNG is recommended, and black & white logos usually
              print best on thermal printers.
            </p>
          </div>

          <div
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
              receiptSaveState === "saved"
                ? "bg-emerald-100 text-emerald-700"
                : receiptSaveState === "saving"
                  ? "bg-sky-100 text-sky-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {receiptSaveState === "saved"
              ? "Saved"
              : receiptSaveState === "saving"
                ? "Saving"
                : "Draft"}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Receipt Format
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Hide unwanted receipt lines and control each section size
                separately.
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Receipt Title
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setReceiptField("title_enabled", !receiptSettings.title_enabled)
                    }
                    className={`mt-3 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                      receiptSettings.title_enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {receiptSettings.title_enabled ? "Title On" : "Title Off"}
                  </button>
                  <div className="mt-4">
                    <ReceiptFontSlider
                      label="Title Size"
                      value={receiptSettings.title_font_size}
                      onChange={(value) => setReceiptField("title_font_size", value)}
                      max={56}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Receipt Details
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setReceiptField(
                        "details_enabled",
                        !receiptSettings.details_enabled,
                      )
                    }
                    className={`mt-3 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                      receiptSettings.details_enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {receiptSettings.details_enabled
                      ? "Details On"
                      : "Details Off"}
                  </button>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Item Layout
                  </div>
                  <select
                    value={receiptSettings.item_layout}
                    onChange={(e) => setReceiptField("item_layout", e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                  >
                    {itemLayoutOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "COMPACT"
                          ? "Compact Item Line"
                          : "Detailed Item Line"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <ReceiptFontSlider
                    label="Details Size"
                    value={receiptSettings.details_font_size}
                    onChange={(value) => setReceiptField("details_font_size", value)}
                  />
                </div>

                <div>
                  <ReceiptFontSlider
                    label="Item Size"
                    value={receiptSettings.item_font_size}
                    onChange={(value) => setReceiptField("item_font_size", value)}
                  />
                </div>

                <div>
                  <ReceiptFontSlider
                    label="Summary Size"
                    value={receiptSettings.summary_font_size}
                    onChange={(value) => setReceiptField("summary_font_size", value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Logo Settings
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Max recommended width: 300px
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setReceiptField("logo_enabled", !receiptSettings.logo_enabled)
                  }
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                    receiptSettings.logo_enabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {receiptSettings.logo_enabled ? "Logo On" : "Logo Off"}
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Upload Logo
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleReceiptLogoChange}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Use PNG or JPG. Black & white is best for thermal printers.
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Logo Preview
                  </div>
                  {receiptSettings.logo_image ? (
                    <div className="mt-3">
                      <div
                        className={`${getReceiptAlignmentClass(receiptSettings.logo_alignment)}`}
                      >
                        <img
                          src={receiptSettings.logo_image}
                          alt="Receipt logo preview"
                          className="inline-block object-contain"
                          style={getReceiptPreviewLogoClass(
                            receiptSettings.logo_width,
                          )}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptSettings((currentValue) => ({
                            ...currentValue,
                            logo_enabled: false,
                            logo_image: "",
                          }));
                          setReceiptSaveState("idle");
                        }}
                        className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-200"
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-500">
                      Upload a logo to preview it here.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Logo Alignment
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {alignmentOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setReceiptField("logo_alignment", option)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                          receiptSettings.logo_alignment === option
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <ReceiptFontSlider
                    label="Logo Size"
                    value={receiptSettings.logo_width}
                    onChange={(value) => setReceiptField("logo_width", value)}
                    min={80}
                    max={300}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Header Settings
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Add restaurant name, address, phone number, GSTIN, or any other
                business lines.
              </div>

              <textarea
                value={receiptSettings.header_text}
                onChange={(e) => setReceiptField("header_text", e.target.value)}
                rows={6}
                placeholder={"Restaurant Name\nAddress Line 1\nPhone Number\nGSTIN"}
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              />

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Header Alignment
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {alignmentOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setReceiptField("header_alignment", option)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        receiptSettings.header_alignment === option
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <ReceiptFontSlider
                  label="Header Size"
                  value={receiptSettings.header_font_size}
                  onChange={(value) => setReceiptField("header_font_size", value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Footer Settings
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Add thank-you text, policy notes, or branding lines.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setReceiptField("footer_enabled", !receiptSettings.footer_enabled)
                  }
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                    receiptSettings.footer_enabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {receiptSettings.footer_enabled ? "Footer On" : "Footer Off"}
                </button>
              </div>

              <textarea
                value={receiptSettings.footer_text}
                onChange={(e) => setReceiptField("footer_text", e.target.value)}
                rows={5}
                placeholder={"Thank You Visit Again\nNo Refund Policy\nPowered by POS"}
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              />

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Footer Alignment
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {alignmentOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setReceiptField("footer_alignment", option)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        receiptSettings.footer_alignment === option
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <ReceiptFontSlider
                  label="Footer Size"
                  value={receiptSettings.footer_font_size}
                  onChange={(value) => setReceiptField("footer_font_size", value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">
                Save these settings once and the receipt layout will update
                without code changes.
              </div>
              <button
                type="button"
                onClick={saveReceiptSettings}
                disabled={receiptSaveState === "saving"}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {receiptSaveState === "saving"
                  ? "Saving..."
                  : "Save Receipt Settings"}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <ReceiptPreview settings={receiptSettings} />
            <TokenPreview />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stock() {
  const [stockTab, setStockTab] = useState("categories");
  const [categories, setCategories] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("ALL");
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [productCostDrafts, setProductCostDrafts] = useState({});
  const [movements, setMovements] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryPosition, setCategoryPosition] = useState("");
  const [productForm, setProductForm] = useState({
    name: "",
    category_id: "",
    display_position: "",
    sale_price: "",
    cost_price: "",
    initial_stock_qty: "",
    tax_mode: "NO_TAX",
    printer_id: "",
    image_data: "",
    image_preview: "",
    image_name: "",
  });
  const [movementForm, setMovementForm] = useState({
    product_id: "",
    movement_type: "IN",
    quantity: "",
    note: "",
  });
  const [imageInputKey, setImageInputKey] = useState(0);
  const productFormRef = useRef(null);
  const assignableProductPrinters = printers.filter(
    (printer) => !printer.main_bill_enabled,
  );
  const productCategoryOptions = [
    "ALL",
    ...categories.map((category) => category.name).filter(Boolean),
  ];
  const filteredProducts = products.filter((product) => {
    const matchesSearch = String(product.name || "")
      .toLowerCase()
      .includes(productSearch.trim().toLowerCase());
    const matchesCategory =
      productCategoryFilter === "ALL" ||
      String(product.category_name || "") === productCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  const loadCategories = async () => {
    const res = await axios.get(`${API}/stock/categories`);
    setCategories(sortCategoriesByPosition(res.data));
  };

  const loadPrinters = async () => {
    const res = await axios.get(`${API}/stock/printers`);
    setPrinters(res.data);
  };

  const loadProducts = async () => {
    const res = await axios.get(`${API}/stock/products`);
    setProducts(sortProductsByCategoryAndPosition(res.data));
    setProductCostDrafts(
      Object.fromEntries(
        (res.data || []).map((product) => [
          product.id,
          String(product.cost_price ?? 0),
        ]),
      ),
    );
  };

  const loadMovements = async () => {
    const res = await axios.get(`${API}/stock/movements`, {
      params: { limit: 40 },
    });
    setMovements(res.data);
  };

  const loadStock = async () => {
    try {
      await Promise.all([
        loadCategories(),
        loadPrinters(),
        loadProducts(),
        loadMovements(),
      ]);
    } catch (error) {
      console.error(error);
      alert("Failed to load stock");
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    if (stockTab !== "products" || !editingProductId) {
      return;
    }

    window.requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [stockTab, editingProductId]);

  const clearCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryPosition("");
  };

  const startCategoryEdit = (category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name || "");
    setCategoryPosition(
      Number(category.display_position) >= 1 &&
        Number(category.display_position) < 9999
        ? String(category.display_position)
        : "",
    );
    setStockTab("categories");
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) {
      alert("Enter category name");
      return;
    }

    try {
      const payload = {
        name: categoryName,
        display_position:
          categoryPosition === "" ? null : Number(categoryPosition),
      };
      const res = editingCategoryId
        ? await axios.put(`${API}/stock/categories/${editingCategoryId}`, payload)
        : await axios.post(`${API}/stock/categories`, payload);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      clearCategoryForm();
      await loadCategories();
    } catch (error) {
      console.error(error);
      alert(
        getRequestErrorMessage(
          error,
          editingCategoryId ? "Failed to update category" : "Failed to add category",
        ),
      );
    }
  };

  const deleteCategory = async (categoryId) => {
    if (!window.confirm("Delete this category?")) {
      return;
    }

    try {
      const res = await axios.delete(`${API}/stock/categories/${categoryId}`);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      if (editingCategoryId === categoryId) {
        clearCategoryForm();
      }
      await loadCategories();
    } catch (error) {
      console.error(error);
      alert("Failed to delete category");
    }
  };

  const clearProductForm = () => {
    setEditingProductId(null);
    setProductForm({
      name: "",
      category_id: "",
      display_position: "",
      sale_price: "",
      cost_price: "",
      initial_stock_qty: "",
      tax_mode: "NO_TAX",
      printer_id: "",
      image_data: "",
      image_preview: "",
      image_name: "",
    });
    setImageInputKey((currentKey) => currentKey + 1);
  };

  const startProductEdit = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || "",
      category_id: product.category_id ? String(product.category_id) : "",
      display_position:
        Number(product.display_position) >= 1 &&
        Number(product.display_position) < 9999
          ? String(product.display_position)
          : "",
      sale_price: product.sale_price != null ? String(product.sale_price) : "",
      cost_price: product.cost_price != null ? String(product.cost_price) : "",
      initial_stock_qty: "",
      tax_mode: product.tax_mode || "NO_TAX",
      printer_id: product.printer_id ? String(product.printer_id) : "",
      image_data: "",
      image_preview: product.image_url ? `${API}${product.image_url}` : "",
      image_name: product.image_url ? "Current image" : "",
    });
    setImageInputKey((currentKey) => currentKey + 1);
    setStockTab("products");
  };

  const clearMovementForm = () => {
    setMovementForm({
      product_id: "",
      movement_type: "IN",
      quantity: "",
      note: "",
    });
  };

  const handleProductImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setProductForm((currentForm) => ({
        ...currentForm,
        image_data: "",
        image_preview: "",
        image_name: "",
      }));
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setProductForm((currentForm) => ({
        ...currentForm,
        image_data: imageData,
        image_preview: imageData,
        image_name: file.name,
      }));
    } catch (error) {
      console.error(error);
      alert("Failed to read image");
    }
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) {
      alert("Enter item name");
      return;
    }

    if (!productForm.category_id) {
      alert("Select category");
      return;
    }

    if (productForm.sale_price === "") {
      alert("Enter sale price");
      return;
    }

    try {
      const payload = {
        name: productForm.name,
        category_id: Number(productForm.category_id),
        display_position:
          productForm.display_position === ""
            ? null
            : Number(productForm.display_position),
        sale_price: Number(productForm.sale_price),
        cost_price: Number(productForm.cost_price || 0),
        tax_mode: productForm.tax_mode,
        printer_id: productForm.printer_id
          ? Number(productForm.printer_id)
          : null,
        image_data: productForm.image_data || null,
      };
      const res = editingProductId
        ? await axios.put(`${API}/stock/products/${editingProductId}`, payload)
        : await axios.post(`${API}/stock/products`, {
            ...payload,
            initial_stock_qty: Number(productForm.initial_stock_qty || 0),
          });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      clearProductForm();
      loadStock();
    } catch (error) {
      console.error(error);
      alert(editingProductId ? "Failed to update product" : "Failed to add product");
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm("Delete this item?")) {
      return;
    }

    try {
      const res = await axios.delete(`${API}/stock/products/${productId}`);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      loadStock();
    } catch (error) {
      console.error(error);
      alert("Failed to delete product");
    }
  };

  const updateProductCost = async (productId) => {
    try {
      const res = await axios.put(
        `${API}/stock/products/${productId}/cost-price`,
        {
          cost_price: Number(productCostDrafts[productId] || 0),
        },
      );

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      loadProducts();
    } catch (error) {
      console.error(error);
      alert("Failed to update cost price");
    }
  };

  const addStockMovement = async () => {
    if (!movementForm.product_id) {
      alert("Select product");
      return;
    }

    if (movementForm.quantity === "") {
      alert("Enter stock quantity");
      return;
    }

    try {
      const res = await axios.post(`${API}/stock/movements`, {
        product_id: Number(movementForm.product_id),
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity),
        note: movementForm.note.trim() || null,
      });

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      clearMovementForm();
      loadStock();
    } catch (error) {
      console.error(error);
      alert("Failed to save stock movement");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStockTab("categories")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              stockTab === "categories"
                ? "bg-slate-900 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setStockTab("products")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              stockTab === "products"
                ? "bg-slate-900 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setStockTab("movements")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              stockTab === "movements"
                ? "bg-slate-900 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            Inventory
          </button>
        </div>
      </div>

      {stockTab === "categories" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Categories</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add, reorder, and edit item categories for stock.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                placeholder="Category Name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="min-w-[240px] rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Category Position (Optional)"
                value={categoryPosition}
                onChange={(e) => setCategoryPosition(e.target.value)}
                className="w-56 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
              <button
                onClick={saveCategory}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                {editingCategoryId ? "Save Category" : "Add Category"}
              </button>
              {editingCategoryId && (
                <button
                  onClick={clearCategoryForm}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
              >
                <div>
                  <div className="font-semibold text-slate-900">{category.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Position{" "}
                    {getCategoryDisplayPosition(category.display_position) >= 9999
                      ? "-"
                      : getCategoryDisplayPosition(category.display_position)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startCategoryEdit(category)}
                    className="rounded bg-blue-500 px-3 py-2 text-white hover:bg-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCategory(category.id)}
                    className="rounded bg-red-500 px-3 py-2 text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stockTab === "products" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div ref={productFormRef} />
            <h2 className="text-xl font-semibold text-slate-900">
              {editingProductId ? "Edit Product" : "Products"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editingProductId
                ? "Update product details and save changes."
                : "Select tax as GST Included or No Tax."}
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                placeholder="Item Name"
                value={productForm.name}
                onChange={(e) =>
                  setProductForm({ ...productForm, name: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />

              <select
                value={productForm.category_id}
                onChange={(e) =>
                  setProductForm({ ...productForm, category_id: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                step="1"
                placeholder="Position In Category (Optional)"
                value={productForm.display_position}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    display_position: e.target.value,
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Sale Price"
                value={productForm.sale_price}
                onChange={(e) =>
                  setProductForm({ ...productForm, sale_price: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Cost Price"
                value={productForm.cost_price}
                onChange={(e) =>
                  setProductForm({ ...productForm, cost_price: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />

              <input
                type="number"
                step="0.001"
                min="0"
                placeholder={
                  editingProductId ? "Opening Stock only for new product" : "Opening Stock"
                }
                value={productForm.initial_stock_qty}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    initial_stock_qty: e.target.value,
                  })
                }
                disabled={Boolean(editingProductId)}
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              />

              <select
                value={productForm.tax_mode}
                onChange={(e) =>
                  setProductForm({ ...productForm, tax_mode: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="GST_INCLUDED">GST Included</option>
                <option value="NO_TAX">No Tax</option>
              </select>

              <select
                value={productForm.printer_id}
                onChange={(e) =>
                  setProductForm({ ...productForm, printer_id: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Select Token Printer (Optional)</option>
                {assignableProductPrinters.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {getAssignablePrinterLabel(printer)}
                  </option>
                ))}
              </select>

              <input
                key={imageInputKey}
                type="file"
                accept="image/*"
                onChange={handleProductImageChange}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            {productForm.image_preview && (
              <div className="mt-4 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <img
                  src={productForm.image_preview}
                  alt="Preview"
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <div className="text-sm text-slate-600">{productForm.image_name}</div>
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={saveProduct}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                {editingProductId ? "Save Product" : "Add Product"}
              </button>
              {editingProductId && (
                <button
                  onClick={clearProductForm}
                  className="ml-3 rounded-lg bg-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Product List
                </h3>
                <div className="mt-1 text-sm text-slate-500">
                  Filter by category or search product name.
                </div>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                {filteredProducts.length} Items
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                {productCategoryOptions.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>
                    {categoryName === "ALL" ? "All Categories" : categoryName}
                  </option>
                ))}
              </select>

              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search product"
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex gap-4">
                  {product.image_url ? (
                    <img
                      src={`${API}${product.image_url}`}
                      alt={product.name}
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-200 text-xs font-semibold text-slate-500">
                      No Image
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-semibold text-slate-900">
                      {product.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {product.category_name}
                    </div>
                    <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Stock: {formatStockQuantity(product.current_stock_qty)}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      Position:{" "}
                      {Number(product.display_position) >= 1 &&
                      Number(product.display_position) < 9999
                        ? product.display_position
                        : "Auto"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Sale: {Number(product.sale_price).toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600">
                      Cost: {Number(product.cost_price || 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600">
                      Tax: {product.tax_mode === "GST_INCLUDED" ? "GST Included" : "No Tax"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Final: {Number(product.final_price).toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600">
                      Token Printer: {product.printer_name || "Not assigned"}
                      {product.printer_target ? ` (${product.printer_target})` : ""}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={productCostDrafts[product.id] ?? ""}
                        onChange={(e) =>
                          setProductCostDrafts((currentValue) => ({
                            ...currentValue,
                            [product.id]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => updateProductCost(product.id)}
                        className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                      >
                        Save Cost
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => startProductEdit(product)}
                    className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="rounded bg-red-500 px-3 py-2 text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No products found for this search or category filter.
              </div>
            )}
          </div>
        </div>
      )}

      {stockTab === "movements" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Inventory Movements
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Track current stock with increase and decrease movements.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <select
                value={movementForm.product_id}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, product_id: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} | Stock {formatStockQuantity(product.current_stock_qty)}
                  </option>
                ))}
              </select>

              <select
                value={movementForm.movement_type}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    movement_type: e.target.value,
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="IN">Increase Stock</option>
                <option value="OUT">Decrease Stock</option>
              </select>

              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="Quantity"
                value={movementForm.quantity}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, quantity: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />

              <input
                placeholder="Note (optional)"
                value={movementForm.note}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, note: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-4">
              <button
                onClick={addStockMovement}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Save Movement
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Recent Movements
            </h3>

            {movements.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {movement.product_name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {movement.created_at || "-"}
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStockMovementTypeClass(
                          movement.movement_type,
                        )}`}
                      >
                        {formatStockMovementType(movement.movement_type)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white px-3 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Change
                        </div>
                        <div className="mt-1 text-lg font-bold text-slate-900">
                          {Number(movement.quantity_change || 0) > 0 ? "+" : ""}
                          {formatStockQuantity(movement.quantity_change)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Stock After
                        </div>
                        <div className="mt-1 text-lg font-bold text-slate-900">
                          {formatStockQuantity(movement.balance_after)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-slate-600">
                      {movement.note || "No note"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
                No stock movements yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
