import { useState } from "react";
import { STOP_TYPES } from "../lib/constants";
import { inputCls } from "../lib/Styles";

function StatusChip({ waypoint: w }) {
  if (w.type !== "stop") return null;
  if (!w.dbId) {
    return <Chip className="bg-blue-100 text-blue-700">New</Chip>;
  }
  return w.isDirty ? (
    <Chip className="bg-amber-100 text-amber-700">Unsaved changes</Chip>
  ) : (
    <Chip className="bg-emerald-100 text-emerald-700">Linked</Chip>
  );
}

function Chip({ className, children }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${className}`}
    >
      {children}
    </span>
  );
}

export default function StopCard({
  index,
  waypoint: w,
  selected,
  expanded,
  onToggle,
  globalStops,
  onUpdate,
  onRemove,
  onSaveAsNew,
  onSaveChanges,
  onReplace,
  dragProps,
}) {
  const [replacing, setReplacing] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const isStop = w.type === "stop";
  const title = isStop ? w.name || "Unnamed stop" : "Connector node";
  const subtitle = isStop
    ? [w.signboard, w.stopType === "TERMINAL" ? "Terminal" : ""]
        .filter(Boolean)
        .join(", ")
    : "Invisible line bender";

  return (
    <li
      id={`waypoint-${w.id}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        dragProps.onDrop(e);
      }}
      className={`border-b border-slate-200 border-l-4 bg-white transition-all ${
        selected ? "border-l-blue-500 bg-blue-50/60" : "border-l-transparent"
      } ${isOver ? "border-t-2 border-t-blue-500 bg-blue-50/40" : ""}`}
    >
      <div className="flex items-center gap-1 pr-2">
        <span
          draggable
          onDragStart={dragProps.onDragStart}
          className="cursor-grab select-none pl-2 text-lg leading-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          title="Drag to reorder"
          aria-hidden="true"
        >
          ⋮⋮
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
              isStop ? "bg-red-500" : "bg-gray-400"
            }`}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-sm font-semibold ${
                isStop && !w.name ? "text-slate-400" : "text-slate-800"
              }`}
            >
              {title}
            </span>
            {subtitle && (
              <span className="block truncate text-xs text-slate-500">
                {subtitle}
              </span>
            )}
          </span>
          <StatusChip waypoint={w} />
          <span
            aria-hidden="true"
            className={`shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(w.id)}
          title="Remove point"
          aria-label={`Remove point ${index + 1}`}
          className="shrink-0 rounded px-1.5 py-1 text-sm text-red-400 hover:bg-red-50 hover:text-red-600"
        >
          🗑
        </button>
      </div>

      {expanded && (
        <div
          className="space-y-2 px-3 pb-3 pl-12"
          onMouseDown={(e) => e.stopPropagation()} // Prevents drag clash inside input fields
        >
          {isStop ? (
            <>
              <input
                className={inputCls}
                type="text"
                placeholder="Stop name (e.g. Zapote Market)"
                value={w.name}
                onChange={(e) => onUpdate(w.id, "name", e.target.value)}
              />
              <input
                className={inputCls}
                type="text"
                placeholder="Aliases (comma separated)"
                value={w.aliases}
                onChange={(e) => onUpdate(w.id, "aliases", e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  type="text"
                  placeholder="Signboard trigger"
                  value={w.signboard}
                  onChange={(e) => onUpdate(w.id, "signboard", e.target.value)}
                />
                <select
                  className={`${inputCls} flex-1`}
                  value={w.stopType}
                  onChange={(e) => onUpdate(w.id, "stopType", e.target.value)}
                >
                  {STOP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {replacing ? (
                <div className="space-y-1.5 rounded-md border border-slate-300 bg-slate-100 p-2">
                  <select
                    className={inputCls}
                    defaultValue=""
                    onChange={(e) => {
                      onReplace(w.id, e.target.value);
                      setReplacing(false);
                    }}
                  >
                    <option value="">-- Choose a database stop --</option>
                    {globalStops.map((s) => (
                      <option key={`replace-${s.id}`} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setReplacing(false)}
                    className="block w-full text-center text-[11px] text-slate-500 underline hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReplacing(true)}
                  className="text-left text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  🔄 Replace with existing database stop
                </button>
              )}

              {w.isDirty && w.dbId && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onSaveChanges(w.id)}
                    className="flex-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    💾 Save changes
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveAsNew(w.id)}
                    className="flex-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    ✨ Save as new
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs italic text-slate-500">
              Connector nodes only bend the line. They have no properties and
              are not saved as stops.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
