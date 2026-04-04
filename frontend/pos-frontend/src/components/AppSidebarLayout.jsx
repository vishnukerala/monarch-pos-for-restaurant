import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiBox,
  FiChevronLeft,
  FiChevronRight,
  FiDollarSign,
  FiGrid,
  FiHome,
  FiImage,
  FiLayers,
  FiLogOut,
  FiMail,
  FiPrinter,
  FiRefreshCw,
  FiShoppingCart,
  FiTool,
  FiUsers,
} from "react-icons/fi";
import {
  ROLE_WAITER,
  clearStoredSession,
  formatRoleLabel,
  getRolePermissions,
  normalizeRole,
} from "../lib/accessControl";

export default function AppSidebarLayout({
  children,
  role,
  currentPage,
  onRefresh,
}) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const normalizedRole = normalizeRole(role);
  const permissions = getRolePermissions(normalizedRole);
  const sidebarWidthClass = "w-[min(86vw,290px)] md:w-[280px] xl:w-[290px]";
  const saleActive =
    currentPage === "sale" ||
    currentPage === "sale-billing" ||
    currentPage === "sale-expenses" ||
    currentPage === "waiter" ||
    currentPage === "waiter-order";
  const salePath = normalizedRole === ROLE_WAITER ? "/waiter" : "/billing";

  const goTo = (path) => {
    setShowMenu(false);
    navigate(path);
  };

  const logout = () => {
    clearStoredSession();
    navigate("/");
  };

  const menuButtonClass = (active) =>
    `flex w-full items-center gap-3 rounded px-3 py-2 text-left transition ${
      active ? "bg-slate-800 text-white" : "hover:bg-slate-800"
    }`;

  return (
    <div className="app-shell relative min-h-screen overflow-x-hidden bg-slate-100">
      {showMenu && (
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setShowMenu(false)}
          className="fixed inset-0 z-20 bg-slate-950/45 md:hidden"
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-30 h-screen max-w-full border-r border-slate-800 bg-slate-900 text-white shadow-2xl transition-transform duration-300 ease-out ${sidebarWidthClass} ${
          showMenu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="app-shell-sidebar flex h-screen flex-col p-5">
          <div className="mb-6">
            <h2 className="app-shell-sidebar-title text-lg font-bold">MONARCH POS SYSTEM</h2>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {formatRoleLabel(normalizedRole)}
            </div>
          </div>

          <div className="app-shell-sidebar-scroll flex-1 space-y-6 overflow-y-auto pr-1 sm:pr-2">
            {(permissions.viewOpenTables ||
              permissions.reprintBill ||
              permissions.manageExpenses) && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Sale
                </div>
                {permissions.viewOpenTables && (
                  <button
                    onClick={() =>
                      saleActive ? setShowMenu(false) : goTo(salePath)
                    }
                    className={menuButtonClass(saleActive)}
                  >
                    <FiShoppingCart className="h-4 w-4" />
                    Sale
                  </button>
                )}
                {permissions.reprintBill && (
                  <button
                    onClick={() =>
                      currentPage === "edit-sale"
                        ? setShowMenu(false)
                        : goTo("/sales/edit")
                    }
                    className={`mt-1 ${menuButtonClass(currentPage === "edit-sale")}`}
                  >
                    <FiTool className="h-4 w-4" />
                    {permissions.editBilledSales ? "Edit Sale" : "Bill History"}
                  </button>
                )}
                {permissions.manageExpenses && (
                  <button
                    onClick={() =>
                      currentPage === "sale-expenses"
                        ? setShowMenu(false)
                        : goTo("/sales/expenses")
                    }
                    className={`mt-1 ${menuButtonClass(currentPage === "sale-expenses")}`}
                  >
                    <FiDollarSign className="h-4 w-4" />
                    Daily Expenses
                  </button>
                )}
              </div>
            )}

            {permissions.accessAdministration && (
              <>
                {(permissions.manageUsers ||
                  permissions.managePrinters ||
                  permissions.manageAccessControl) && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Administration
                    </div>
                    {permissions.manageUsers && (
                      <button
                        onClick={() =>
                          currentPage === "users"
                            ? setShowMenu(false)
                            : goTo("/users")
                        }
                        className={menuButtonClass(currentPage === "users")}
                      >
                        <FiUsers className="h-4 w-4" />
                        Users
                      </button>
                    )}
                    {permissions.managePrinters && (
                      <button
                        onClick={() =>
                          currentPage === "printers"
                            ? setShowMenu(false)
                            : goTo("/printers")
                        }
                        className={`mt-1 ${menuButtonClass(currentPage === "printers")}`}
                      >
                        <FiPrinter className="h-4 w-4" />
                        Printers
                      </button>
                    )}
                    {permissions.manageAccessControl && (
                      <button
                        onClick={() =>
                          currentPage === "access-control"
                            ? setShowMenu(false)
                            : goTo("/maintenance/access-control")
                        }
                        className={`mt-1 ${menuButtonClass(currentPage === "access-control")}`}
                      >
                        <FiTool className="h-4 w-4" />
                        Access Control
                      </button>
                    )}
                    <button
                      onClick={() =>
                        currentPage === "mail-configuration"
                          ? setShowMenu(false)
                          : goTo("/mail-configuration")
                      }
                      className={`mt-1 ${menuButtonClass(currentPage === "mail-configuration")}`}
                    >
                      <FiMail className="h-4 w-4" />
                      Mail Configuration
                    </button>
                    <button
                      onClick={() =>
                        currentPage === "login-branding"
                          ? setShowMenu(false)
                          : goTo("/login-branding")
                      }
                      className={`mt-1 ${menuButtonClass(currentPage === "login-branding")}`}
                    >
                      <FiImage className="h-4 w-4" />
                      Login Branding
                    </button>
                  </div>
                )}

                {(permissions.manageFloors ||
                  permissions.manageTables ||
                  permissions.manageStock) && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Maintenance
                    </div>
                    {permissions.manageFloors && (
                      <button
                        onClick={() =>
                          currentPage === "floors"
                            ? setShowMenu(false)
                            : goTo("/maintenance/floors")
                        }
                        className={menuButtonClass(currentPage === "floors")}
                      >
                        <FiLayers className="h-4 w-4" />
                        Floors
                      </button>
                    )}
                    {permissions.manageTables && (
                      <button
                        onClick={() =>
                          currentPage === "tables"
                            ? setShowMenu(false)
                            : goTo("/maintenance/tables")
                        }
                        className={`mt-1 ${menuButtonClass(currentPage === "tables")}`}
                      >
                        <FiGrid className="h-4 w-4" />
                        Tables
                      </button>
                    )}
                    {permissions.manageStock && (
                      <button
                        onClick={() =>
                          currentPage === "stock"
                            ? setShowMenu(false)
                            : goTo("/maintenance/stock")
                        }
                        className={`mt-1 ${menuButtonClass(currentPage === "stock")}`}
                      >
                        <FiBox className="h-4 w-4" />
                        Stock
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                System
              </div>
              {permissions.viewDashboard && (
                <button
                  onClick={() =>
                    currentPage === "dashboard"
                      ? setShowMenu(false)
                      : goTo("/dashboard")
                  }
                  className={menuButtonClass(currentPage === "dashboard")}
                >
                  <FiHome className="h-4 w-4" />
                  Dashboard
                </button>
              )}
              {permissions.accessAdministration && (
                <button
                  onClick={() =>
                    currentPage === "reports"
                      ? setShowMenu(false)
                      : goTo("/reports")
                  }
                  className={`mt-1 ${menuButtonClass(currentPage === "reports")}`}
                >
                  <FiBarChart2 className="h-4 w-4" />
                  Reports
                </button>
              )}

              {onRefresh && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onRefresh();
                  }}
                  className={`${
                    permissions.viewDashboard ? "mt-1" : ""
                  } flex w-full items-center gap-3 rounded px-3 py-2 text-left transition hover:bg-slate-800`}
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              )}

              <button
                onClick={logout}
                className="mt-1 flex w-full items-center gap-3 rounded px-3 py-2 text-left transition hover:bg-red-700"
              >
                <FiLogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setShowMenu((currentValue) => !currentValue)}
        className={`fixed top-1/2 z-40 -translate-y-1/2 rounded-r-2xl bg-slate-900 px-3 py-5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-slate-800 ${
          showMenu
            ? "left-[min(86vw,290px)] md:left-[280px] xl:left-[290px]"
            : "left-0"
        }`}
      >
        {showMenu ? (
          <FiChevronLeft className="h-5 w-5" />
        ) : (
          <FiChevronRight className="h-5 w-5" />
        )}
      </button>

      <div
        className={`app-shell-main min-w-0 space-y-6 p-4 sm:p-6 transition-[margin] duration-300 ease-out ${
          showMenu ? "md:ml-[280px] xl:ml-[290px]" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
