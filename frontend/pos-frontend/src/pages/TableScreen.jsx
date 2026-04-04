import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Rnd } from "react-rnd";
import axios from "axios";
import {
  FiGrid,
  FiLayout,
  FiMove,
  FiRefreshCw,
  FiSave,
  FiX,
} from "react-icons/fi";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getRolePermissions, getStoredUser } from "../lib/accessControl";
import { API } from "../lib/api";
import { getLocalDraftSalesLookup } from "../lib/saleDrafts";
const GRID_SIZE = 20;
const CANVAS_WIDTH = 1160;
const CANVAS_HEIGHT = 700;
const FLOOR_VIEW_SCALE = 1;
const DEFAULT_TABLE_WIDTH = 140;
const DEFAULT_TABLE_HEIGHT = 90;
const DEFAULT_TABLE_START_X = 32;
const DEFAULT_TABLE_START_Y = 32;
const DEFAULT_TABLE_GAP_X = 180;
const DEFAULT_TABLE_GAP_Y = 130;
const DEFAULT_TABLES_PER_ROW = 4;

function getFallbackLayout(index) {
  const columnIndex = index % DEFAULT_TABLES_PER_ROW;
  const rowIndex = Math.floor(index / DEFAULT_TABLES_PER_ROW);

  return {
    pos_x: DEFAULT_TABLE_START_X + columnIndex * DEFAULT_TABLE_GAP_X,
    pos_y: DEFAULT_TABLE_START_Y + rowIndex * DEFAULT_TABLE_GAP_Y,
    table_width: DEFAULT_TABLE_WIDTH,
    table_height: DEFAULT_TABLE_HEIGHT,
  };
}

function getTableLayout(table, index) {
  const fallback = getFallbackLayout(index);
  const posX = Number(table.pos_x);
  const posY = Number(table.pos_y);
  const tableWidth = Number(table.table_width);
  const tableHeight = Number(table.table_height);

  return {
    pos_x: Number.isFinite(posX) ? posX : fallback.pos_x,
    pos_y: Number.isFinite(posY) ? posY : fallback.pos_y,
    table_width: Number.isFinite(tableWidth) ? tableWidth : fallback.table_width,
    table_height: Number.isFinite(tableHeight)
      ? tableHeight
      : fallback.table_height,
  };
}

function buildDraftLayouts(tableList) {
  return tableList.reduce((layouts, table, index) => {
    layouts[table.id] = getTableLayout(table, index);
    return layouts;
  }, {});
}

function getOrderStatusDetails(order) {
  if (!order || order.status === "VACANT") {
    return {
      cardClass:
        "border-emerald-300 bg-[linear-gradient(180deg,#f0fdf4_0%,#dcfce7_100%)] hover:border-emerald-400 hover:shadow-[0_20px_30px_-24px_rgba(34,197,94,0.7)]",
      activeClass:
        "border-emerald-400 bg-[linear-gradient(180deg,#f0fdf4_0%,#bbf7d0_100%)] ring-2 ring-emerald-200 shadow-[0_20px_32px_-24px_rgba(34,197,94,0.8)]",
      textClass: "text-emerald-700",
    };
  }

  return {
    cardClass:
      "border-rose-300 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)] hover:border-rose-400 hover:shadow-[0_20px_32px_-24px_rgba(244,63,94,0.75)]",
    activeClass:
      "border-rose-400 bg-[linear-gradient(180deg,#fff1f2_0%,#fecdd3_100%)] ring-2 ring-rose-200 shadow-[0_20px_32px_-24px_rgba(244,63,94,0.85)]",
    textClass: "text-rose-700",
  };
}

export default function TableScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = getStoredUser();
  const permissions = getRolePermissions(role);
  const isAdmin = permissions.manageFloorLayout;
  const [floors, setFloors] = useState([]);
  const [tables, setTables] = useState([]);
  const [openSalesByTable, setOpenSalesByTable] = useState({});
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [designMode, setDesignMode] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [draftLayouts, setDraftLayouts] = useState({});

  const loadData = async (options = {}) => {
    const showFailureAlert = options.showFailureAlert !== false;

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
      } catch (salesError) {
        console.warn("Sales endpoint unavailable", salesError);
        salesLookup = getLocalDraftSalesLookup();
      }

      const floorList = floorsRes.data;
      const tableList = tablesRes.data;

      setFloors(floorList);
      setTables(tableList);
      setOpenSalesByTable(salesLookup);
      setDraftLayouts(buildDraftLayouts(tableList));

      if (floorList.length === 0) {
        setSelectedFloorId("");
        setSelectedTableId(null);
        return;
      }

      const preferredFloorId = location.state?.selectedFloorId;
      setSelectedFloorId((currentFloorId) => {
        if (
          preferredFloorId &&
          floorList.some((floor) => String(floor.id) === String(preferredFloorId))
        ) {
          return String(preferredFloorId);
        }

        const hasCurrentFloor = floorList.some(
          (floor) => String(floor.id) === String(currentFloorId),
        );

        return hasCurrentFloor ? currentFloorId : String(floorList[0].id);
      });

      if (location.state?.selectedTableId) {
        const preferredTableId = Number(location.state.selectedTableId);
        const hasPreferredTable = tableList.some(
          (table) => table.id === preferredTableId,
        );

        setSelectedTableId(hasPreferredTable ? preferredTableId : null);
      }
    } catch (error) {
      console.error(error);
      if (showFailureAlert) {
        alert("Failed to load floor chart");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [location.state]);

  const selectedFloor = floors.find(
    (floor) => String(floor.id) === String(selectedFloorId),
  );

  const filteredTables = selectedFloorId
    ? tables.filter((table) => String(table.floor_id) === String(selectedFloorId))
    : [];

  const selectedTable =
    filteredTables.find((table) => table.id === selectedTableId) || null;

  useEffect(() => {
    if (filteredTables.length === 0) {
      setSelectedTableId(null);
      return;
    }

    const hasSelectedTable = filteredTables.some(
      (table) => table.id === selectedTableId,
    );

    if (!hasSelectedTable) {
      setSelectedTableId(filteredTables[0].id);
    }
  }, [selectedFloorId, tables]);

  const openDesignMode = () => {
    setDraftLayouts(buildDraftLayouts(tables));
    setDesignMode(true);
  };

  const cancelDesignMode = () => {
    setDraftLayouts(buildDraftLayouts(tables));
    setDesignMode(false);
  };

  const updateDraftLayout = (tableId, changes) => {
    setDraftLayouts((currentLayouts) => ({
      ...currentLayouts,
      [tableId]: {
        ...currentLayouts[tableId],
        ...changes,
      },
    }));
  };

  const autoArrangeFloor = () => {
    setDraftLayouts((currentLayouts) => {
      const nextLayouts = { ...currentLayouts };

      filteredTables.forEach((table, index) => {
        nextLayouts[table.id] = getFallbackLayout(index);
      });

      return nextLayouts;
    });
  };

  const saveLayout = async () => {
    try {
      setSavingLayout(true);

      const updates = filteredTables
        .map((table, index) => {
          const originalLayout = getTableLayout(table, index);
          const draftLayout = draftLayouts[table.id] || originalLayout;

          const changed =
            originalLayout.pos_x !== draftLayout.pos_x ||
            originalLayout.pos_y !== draftLayout.pos_y ||
            originalLayout.table_width !== draftLayout.table_width ||
            originalLayout.table_height !== draftLayout.table_height;

          if (!changed) {
            return null;
          }

          return axios.put(`${API}/tables/${table.id}/layout`, draftLayout);
        })
        .filter(Boolean);

      await Promise.all(updates);
      setDesignMode(false);
      await loadData();
      alert("Floor layout saved");
    } catch (error) {
      console.error(error);
      alert("Failed to save floor layout");
    } finally {
      setSavingLayout(false);
    }
  };

  const openBilling = (table) => {
    setSelectedTableId(table.id);
    navigate(`/billing/table/${table.id}`, {
      state: {
        table,
      },
    });
  };

  return (
    <AppSidebarLayout role={role} currentPage="sale" onRefresh={loadData}>
      <div className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_48%,#eef6ff_100%)] px-5 py-4 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.65)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-50"
            >
              <FiRefreshCw className="h-4 w-4" />
              Reload
            </button>
            {isAdmin &&
              (designMode ? (
                <>
                  <button
                    type="button"
                    onClick={autoArrangeFloor}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <FiGrid className="h-4 w-4" />
                    Auto Arrange
                  </button>
                  <button
                    type="button"
                    onClick={cancelDesignMode}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <FiX className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveLayout}
                    disabled={savingLayout}
                    className="inline-flex items-center gap-2 rounded-2xl border border-sky-500 bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300"
                  >
                    <FiSave className="h-4 w-4" />
                    {savingLayout ? "Saving..." : "Save Layout"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openDesignMode}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-50"
                >
                  <FiMove className="h-4 w-4" />
                  Layout
                </button>
              ))}
          </div>
        </div>

        {floors.length > 0 ? (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Restaurant floor
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Click a table to open or resume billing.
                </div>
              </div>

              {floors.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {floors.map((floor) => (
                    <button
                      key={floor.id}
                      onClick={() => setSelectedFloorId(String(floor.id))}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm ${
                        String(floor.id) === String(selectedFloorId)
                          ? "border-sky-400 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <FiLayout className="h-4 w-4" />
                      {floor.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {designMode && (
              <div className="mt-4 rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                Layout mode is on. Drag tables with the mouse, resize from the
                corners, and then save the plan for this floor.
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 text-sm text-slate-500">
            No floors available. Add floors in Maintenance first.
          </div>
        )}
      </div>

      <div
        className={
          designMode ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" : ""
        }
      >
        <div className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.7)]">
          <div className="overflow-auto rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-4">
            <div className="mx-auto w-fit rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_40px_-30px_rgba(15,23,42,0.6)]">
              <div
                style={
                  designMode
                    ? undefined
                    : {
                        width: `${CANVAS_WIDTH * FLOOR_VIEW_SCALE}px`,
                        height: `${CANVAS_HEIGHT * FLOOR_VIEW_SCALE}px`,
                      }
                }
              >
              <div
                className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-[#f8fbff]"
                style={{
                  minWidth: `${CANVAS_WIDTH}px`,
                  height: `${CANVAS_HEIGHT}px`,
                  transform: designMode
                    ? undefined
                    : `scale(${FLOOR_VIEW_SCALE})`,
                  transformOrigin: designMode ? undefined : "top left",
                  backgroundImage: designMode
                    ? "linear-gradient(to right, rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.15) 1px, transparent 1px)"
                    : "radial-gradient(circle at top, rgba(14,165,233,0.10), rgba(255,255,255,0) 32%), radial-gradient(circle at bottom right, rgba(59,130,246,0.08), rgba(255,255,255,0) 28%)",
                  backgroundSize: designMode
                    ? `${GRID_SIZE}px ${GRID_SIZE}px`
                    : "100% 100%",
                }}
              >
                {!designMode && (
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_transparent_26%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.06),_transparent_42%)]" />
                )}

                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                    Loading layout...
                  </div>
                ) : filteredTables.length > 0 ? (
                  filteredTables.map((table, index) => {
                    const layout = designMode
                      ? draftLayouts[table.id] || getTableLayout(table, index)
                      : getTableLayout(table, index);
                    const isSelected = table.id === selectedTableId;
                    const openSale = openSalesByTable[table.id];
                    const status = getOrderStatusDetails(openSale);

                    if (designMode && isAdmin) {
                      return (
                        <Rnd
                          key={table.id}
                          bounds="parent"
                          dragGrid={[GRID_SIZE, GRID_SIZE]}
                          resizeGrid={[GRID_SIZE, GRID_SIZE]}
                          minWidth={100}
                          minHeight={70}
                          size={{
                            width: layout.table_width,
                            height: layout.table_height,
                          }}
                          position={{
                            x: layout.pos_x,
                            y: layout.pos_y,
                          }}
                          onDragStart={() => setSelectedTableId(table.id)}
                          onDragStop={(event, data) => {
                            updateDraftLayout(table.id, {
                              pos_x: data.x,
                              pos_y: data.y,
                            });
                          }}
                          onResizeStop={(event, direction, ref, delta, position) => {
                            updateDraftLayout(table.id, {
                              pos_x: position.x,
                              pos_y: position.y,
                              table_width: ref.offsetWidth,
                              table_height: ref.offsetHeight,
                            });
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedTableId(table.id)}
                            className={`flex h-full w-full flex-col justify-between rounded-[24px] border p-4 text-left shadow-[0_20px_30px_-24px_rgba(15,23,42,0.7)] transition ${
                              isSelected
                                ? "border-sky-400 bg-gradient-to-br from-white to-sky-50 ring-2 ring-sky-200"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div>
                              <div className="text-lg font-bold text-slate-900">
                                {table.name}
                              </div>
                              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                                Drag And Resize
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{layout.table_width}px</span>
                              <span>{layout.table_height}px</span>
                            </div>
                          </button>
                        </Rnd>
                      );
                    }

                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => openBilling(table)}
                        className={`absolute flex flex-col justify-between rounded-[24px] border p-3 text-center shadow-[0_22px_36px_-28px_rgba(15,23,42,0.75)] transition duration-200 hover:-translate-y-0.5 ${
                          isSelected ? status.activeClass : status.cardClass
                        }`}
                        style={{
                          left: `${layout.pos_x}px`,
                          top: `${layout.pos_y}px`,
                          width: `${layout.table_width}px`,
                          height: `${layout.table_height}px`,
                        }}
                      >
                        <div className="flex h-full flex-col items-center justify-center">
                          <div className={`text-base font-bold leading-tight ${status.textClass}`}>
                            {table.name}
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-slate-500">
                    {floors.length === 0
                      ? "No floor selected."
                      : "No tables found for this floor."}
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>

        {designMode && (
          <div className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.7)]">
              <h3 className="text-lg font-semibold text-slate-900">Table Details</h3>
              <p className="mt-1 text-sm text-slate-500">
                Select a table to review its current size and position.
              </p>

              {selectedTable ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xl font-bold text-slate-900">
                      {selectedTable.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Floor: {selectedTable.floor || selectedFloor?.name || "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Position X
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {draftLayouts[selectedTable.id]?.pos_x ??
                          getTableLayout(selectedTable, 0).pos_x}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Position Y
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {draftLayouts[selectedTable.id]?.pos_y ??
                          getTableLayout(selectedTable, 0).pos_y}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Width
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {draftLayouts[selectedTable.id]?.table_width ??
                          getTableLayout(selectedTable, 0).table_width}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Height
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {draftLayouts[selectedTable.id]?.table_height ??
                          getTableLayout(selectedTable, 0).table_height}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                    Use the mouse to place this table exactly where you want it
                    on the floor plan.
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  Choose a floor and select a table to view details.
                </div>
              )}
          </div>
        )}
      </div>
    </AppSidebarLayout>
  );
}
