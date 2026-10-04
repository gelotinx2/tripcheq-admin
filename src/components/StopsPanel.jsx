import { useEffect, useState } from "react";
import { inputCls } from "../lib/Styles";
import StopCard from "./StopCard";

function emptyMessage(mappingMode, disabled) {
  if (disabled) return "Select a master route above to start digitizing.";
  if (mappingMode === "BACKBONE") {
    return "Click the map to draw the route, or add an existing stop from the dropdown above.";
  }
  return "Click the map to draw only the detour stops between split and merge.";
}

// The stop list. It takes all the vertical space the sidebar has left.
export default function StopsPanel({ mappingMode, stops }) {
  const { waypoints, selectedId, disabled } = stops;
  const [expanded, setExpanded] = useState(() => new Set());

  // Selecting a point on the map opens its card and scrolls it into view
  useEffect(() => {
    if (selectedId == null) return;
    setExpanded((prev) => new Set(prev).add(selectedId));
    requestAnimationFrame(() => {
      document
        .getElementById(`waypoint-${selectedId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selectedId]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDragStart = (e, index) => {
    if (["INPUT", "SELECT"].includes(e.target.tagName)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    stops.onReorder(sourceIndex, targetIndex);
  };

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-opacity ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">
            Stops{" "}
            <span className="font-semibold text-slate-400">
              ({waypoints.length})
            </span>
          </h3>
          <span className="ml-auto text-[11px] text-slate-400">
            Ctrl+Z to undo
          </span>
          <button
            type="button"
            onClick={() => setExpanded(new Set(waypoints.map((w) => w.id)))}
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set())}
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
          >
            Collapse all
          </button>
        </div>

        <div className="flex gap-2">
          <select
            className={`${inputCls} flex-1`}
            value={stops.nodeType}
            onChange={(e) => stops.setNodeType(e.target.value)}
            aria-label="Type of point placed by the next map click"
          >
            <option value="stop">🛑 Map click adds a stop</option>
            <option value="connector">🔗 Map click adds a connector</option>
          </select>
          <select
            className={`${inputCls} flex-1 border-emerald-300 bg-emerald-50 font-semibold text-emerald-700`}
            defaultValue=""
            onChange={(e) => {
              stops.onAddExisting(e.target.value);
              e.target.value = "";
            }}
            aria-label="Add an existing database stop"
          >
            <option value="">➕ Add existing stop</option>
            {stops.globalStops.map((s) => (
              <option key={`global-${s.id}`} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {waypoints.length === 0 && (
          <li className="p-8 text-center text-sm italic text-slate-400">
            {emptyMessage(mappingMode, disabled)}
          </li>
        )}
        {waypoints.map((w, i) => (
          <StopCard
            key={w.id}
            index={i}
            waypoint={w}
            selected={selectedId === w.id}
            expanded={expanded.has(w.id)}
            onToggle={() => toggle(w.id)}
            globalStops={stops.globalStops}
            onUpdate={stops.onUpdate}
            onRemove={stops.onRemove}
            onSaveAsNew={stops.onSaveAsNew}
            onReplace={stops.onReplace}
            dragProps={{
              draggable: true,
              onDragStart: (e) => handleDragStart(e, i),
              onDragOver: (e) => e.preventDefault(),
              onDrop: (e) => handleDrop(e, i),
            }}
          />
        ))}
      </ul>
    </section>
  );
}
