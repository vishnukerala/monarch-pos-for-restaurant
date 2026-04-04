import { FiBarChart2, FiDollarSign, FiPrinter, FiShoppingCart, FiTool, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getRolePermissions, getStoredUser } from "../lib/accessControl";

function DashboardActionCard({ title, description, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-500">{description}</div>
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const permissions = getRolePermissions(currentUser.role);

  const actions = [
    permissions.viewOpenTables && {
      title: "Sale",
      description: "Open tables and start billing.",
      path: "/billing",
      icon: <FiShoppingCart className="h-6 w-6" />,
    },
    permissions.reprintBill && {
      title: "Edit Sale",
      description: "Review, reprint, or edit billed sales.",
      path: "/sales/edit",
      icon: <FiTool className="h-6 w-6" />,
    },
    permissions.manageExpenses && {
      title: "Daily Expenses",
      description: "Record and review today's counter expenses.",
      path: "/sales/expenses",
      icon: <FiDollarSign className="h-6 w-6" />,
    },
    permissions.accessAdministration && {
      title: "Reports",
      description: "Run exports and review sales performance.",
      path: "/reports",
      icon: <FiBarChart2 className="h-6 w-6" />,
    },
    permissions.managePrinters && {
      title: "Printers",
      description: "Configure bill and token printers.",
      path: "/printers",
      icon: <FiPrinter className="h-6 w-6" />,
    },
    permissions.manageUsers && {
      title: "Users",
      description: "Manage staff accounts and permissions.",
      path: "/users",
      icon: <FiUsers className="h-6 w-6" />,
    },
  ].filter(Boolean);

  return (
    <AppSidebarLayout role={currentUser.role} currentPage="dashboard">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">
            Dashboard
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Welcome back, {currentUser.username || "User"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Use these shortcuts to jump into the busiest POS tasks quickly.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <DashboardActionCard
              key={action.path}
              title={action.title}
              description={action.description}
              icon={action.icon}
              onClick={() => navigate(action.path)}
            />
          ))}
        </section>
      </div>
    </AppSidebarLayout>
  );
}
