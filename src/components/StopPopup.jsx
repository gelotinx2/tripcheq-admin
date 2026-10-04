import { createPortal } from "react-dom";
import { STOP_TYPES } from "../lib/constants";
import { inputCls } from "../lib/Styles";

// Content of the MapLibre popup, rendered into its DOM node with a portal
export default function StopPopup({
  container,
  waypoint: w,
  onUpdate,
  onRemove,
  onSaveAsNew,
  onSaveChanges,
  onClose,
}) {
  if (!w || !container) return null;

  return createPortal(
    <div
      className="flex w-64 flex-col gap-2 pb-1 text-slate-800 dark:text-slate-200"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
        <h4 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">
          Edit point
        </h4>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      {w.type === "stop" ? (
        <>
          <input
            className={inputCls}
            type="text"
            placeholder="Stop name"
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
          <input
            className={inputCls}
            type="text"
            placeholder="Signboard text"
            value={w.signboard}
            onChange={(e) => onUpdate(w.id, "signboard", e.target.value)}
          />
          <select
            className={inputCls}
            value={w.stopType}
            onChange={(e) => onUpdate(w.id, "stopType", e.target.value)}
          >
            {STOP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {w.isDirty && w.dbId && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSaveChanges(w.id)}
                className="flex-1 rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800 transition-colors"
              >
                💾 Save changes
              </button>
              <button
                type="button"
                onClick={() => onSaveAsNew(w.id)}
                className="flex-1 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
              >
                ✨ Save as new
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="mb-1 text-xs italic text-slate-500 dark:text-slate-400">
          Connector node (invisible)
        </p>
      )}

      <button
        type="button"
        onClick={() => onRemove(w.id)}
        className="flex w-full items-center justify-center gap-1 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
      >
        🗑 Delete point
      </button>
    </div>,
    container,
  );
}
