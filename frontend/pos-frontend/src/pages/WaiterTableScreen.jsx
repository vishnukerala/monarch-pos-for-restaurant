import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { FiClock, FiLayers, FiRefreshCw } from "react-icons/fi";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getStoredUser } from "../lib/accessControl";
import { API } from "../lib/api";
import { getLocalDraftSalesLookup } from "../lib/saleDrafts";

function getOrderStatusLabel(order) {
  if (!order || order.status === "VACANT") {
    return "Vacant";
  }

  if (order.status === "RUNNING_ORDER") {
    return "Running";
  }

  return "Occupied";
}

function getOrderStatusClass(order) {
  if (!order || order.status === "VACANT") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (order.status === "RUNNING_ORDER") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-rose-100 text-rose-700";
}

function formatUpdatedTime(value) {
  if (!value) {
    return "No order yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function WaiterTableScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = getStoredUser();
  const [floors, setFloors] = useState([]);
  const [tables, setTables] = useState([]);
  const [openSalesByTable, setOpenSalesByTable] = useState({});
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [floorsRes, tablesRes] = await Promise.all([
        axios.get(`${API}/floors`),
        axios.get(`${API}/tables`),
      ]);

      let salesLookup = {};

      try {
        const salesRes = await axios.get(`${API}/sales/open`);
        const remoteSales = Array.isArray(salesRes.data) ? salesRes.data : [];
        salesLookup = remoteSales.reduce((lookup, sale) => {
          lookup[sale.table_id] = sale;
          return lookup;
        }, {});
      } catch (error) {
        console.warn("Sales endpoint unavailable", error);
        salesLookup = getLocalDraftSalesLookup();
      }

      setFloors(floorsRes.data || []);
      setTables(tablesRes.data || []);
      setOpenSalesByTable(salesLookup);

      const preferredFloorId = location.state?.selectedFloorId;
      const floorList = floorsRes.data || [];

      if (floorList.length === 0) {
        setSelectedFloorId("");
        return;
      }

      setSelectedFloorId((currentValue) => {
        if (
          preferredFloorId &&
          floorList.some((floor) => String(floor.id) === String(preferredFloorId))
        ) {
          return String(preferredFloorId);
        }

        const hasCurrentFloor = floorList.some(
          (floor) => String(floor.id) === String(currentValue),
        );

        return hasCurrentFloor ? currentValue : String(floorList[0].id);
      });
    } catch (error) {
      console.error(error);
      alert("Failed to load waiter tables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [location.state]);

  const filteredTables = selectedFloorId
    ? tables.filter((table) => String(table.floor_id) === String(selectedFloorId))
    : tables;

  const openWaiterOrder = (table) => {
    navigate(`/waiter/table/${table.id}`, {
      state: {
        table,
        selectedFloorId: String(selectedFloorId || table.floor_id || ""),
      },
    });
  };

  return (
    <AppSidebarLayout role={role} currentPage="waiter" onRefresh={loadData}>
      <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#eef6ff_100%)] p-5 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.65)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Waiter Mode
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Table Ordering
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Built for phone and tablet ordering. Open a table, add items, and
              print token quickly.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-50"
          >
            <FiRefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {floors.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => setSelectedFloorId(String(floor.id))}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                  String(floor.id) === String(selectedFloorId)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <FiLayers className="h-4 w-4" />
                {floor.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            Loading tables...
          </div>
        ) : filteredTables.length > 0 ? (
          filteredTables.map((table) => {
            const order = openSalesByTable[table.id];

            return (
              <button
                key={table.id}
                type="button"
                onClick={() => openWaiterOrder(table)}
                className="rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_22px_45px_-28px_rgba(14,165,233,0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-bold text-slate-900">
                      {table.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {table.floor || "No Floor"}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getOrderStatusClass(
                      order,
                    )}`}
                  >
                    {getOrderStatusLabel(order)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Items
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      {order?.units || 0}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Pending
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      {order?.pending_units || 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
                  <FiClock className="h-4 w-4" />
                  <span>{formatUpdatedTime(order?.updated_at)}</span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            No tables found for this floor.
          </div>
        )}
      </div>
    </AppSidebarLayout>
  );
}
