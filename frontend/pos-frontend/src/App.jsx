import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import {
  ROLE_WAITER,
  getStoredUser,
  getRolePermissions,
  hasPermission,
} from "./lib/accessControl";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const TableScreen = lazy(() => import("./pages/TableScreen"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const SalesExpensesPage = lazy(() => import("./pages/SalesExpensesPage"));
const WaiterTableScreen = lazy(() => import("./pages/WaiterTableScreen"));
const WaiterOrderPage = lazy(() => import("./pages/WaiterOrderPage"));
const EditSalesPage = lazy(() => import("./pages/EditSalesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const MailConfigurationPage = lazy(() => import("./pages/MailConfigurationPage"));
const LoginBrandingPage = lazy(() => import("./pages/LoginBrandingPage"));

function ProtectedRoute({ permission, permissions, children }) {
  const { role } = getStoredUser();

  if (!role) {
    return <Navigate to="/" replace />;
  }

  const requiredPermissions = permissions || (permission ? [permission] : []);

  if (requiredPermissions.some((item) => !hasPermission(role, item))) {
    const normalizedRole = role === ROLE_WAITER ? ROLE_WAITER : role;
    const availablePermissions = getRolePermissions(normalizedRole);
    let fallbackPath = "/";

    if (normalizedRole === ROLE_WAITER && availablePermissions.viewOpenTables) {
      fallbackPath = "/waiter";
    } else if (availablePermissions.viewOpenTables) {
      fallbackPath = "/billing";
    } else if (availablePermissions.manageExpenses) {
      fallbackPath = "/sales/expenses";
    } else if (availablePermissions.reprintBill) {
      fallbackPath = "/sales/edit";
    } else if (availablePermissions.viewDashboard) {
      fallbackPath = "/dashboard";
    } else if (
      availablePermissions.accessAdministration &&
      availablePermissions.manageUsers
    ) {
      fallbackPath = "/users";
    } else if (
      availablePermissions.accessAdministration &&
      availablePermissions.managePrinters
    ) {
      fallbackPath = "/printers";
    } else if (
      availablePermissions.accessAdministration &&
      availablePermissions.manageStock
    ) {
      fallbackPath = "/maintenance/stock";
    } else if (
      availablePermissions.accessAdministration &&
      availablePermissions.manageFloors
    ) {
      fallbackPath = "/maintenance/floors";
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}

function App() {
  const storedUser = getStoredUser();
  const isWaiter = storedUser.role === ROLE_WAITER;

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-semibold text-slate-600">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute permission="viewDashboard">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute permission="accessAdministration">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mail-configuration"
            element={
              <ProtectedRoute permission="accessAdministration">
                <MailConfigurationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login-branding"
            element={
              <ProtectedRoute permission="accessAdministration">
                <LoginBrandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute permission="viewOpenTables">
                {isWaiter ? <Navigate to="/waiter" replace /> : <TableScreen />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/table/:tableId"
            element={
              <ProtectedRoute permission="openBill">
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales/expenses"
            element={
              <ProtectedRoute permission="manageExpenses">
                <SalesExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waiter"
            element={
              <ProtectedRoute permission="viewOpenTables">
                <WaiterTableScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waiter/table/:tableId"
            element={
              <ProtectedRoute permission="openBill">
                <WaiterOrderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales/edit"
            element={
              <ProtectedRoute permission="reprintBill">
                <EditSalesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute
                permissions={["accessAdministration", "manageUsers"]}
              >
                <Maintenance page="users" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/printers"
            element={
              <ProtectedRoute
                permissions={["accessAdministration", "managePrinters"]}
              >
                <Maintenance page="printers" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/maintenance"
            element={
              <ProtectedRoute
                permissions={["accessAdministration", "manageFloors"]}
              >
                <Maintenance page="floors" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/maintenance/floors"
            element={
              <ProtectedRoute
                permissions={["accessAdministration", "manageFloors"]}
              >
                <Maintenance page="floors" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/maintenance/tables"
            element={
              <ProtectedRoute
                permissions={["accessAdministration", "manageTables"]}
              >
                <Maintenance page="tables" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/maintenance/stock"
            element={
              <ProtectedRoute
                permissions={["accessAdministration", "manageStock"]}
              >
                <Maintenance page="stock" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/maintenance/access-control"
            element={
              <ProtectedRoute
                permissions={["accessAdministration", "manageAccessControl"]}
              >
                <Maintenance page="access-control" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
