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
  onClose,
}) {
  if (!w || !container) return null;

  return createPortal(
    <div className="flex w-56 flex-col gap-2 pb-1 text-slate-800">
      <div className="mb-1 flex items-center justify-between border-b border-slate-200 pb-2">
        <h4 className="m-0 text-sm font-bold">Edit point</h4>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-lg font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900"
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
            <button
              type="button"
              onClick={() => onSaveAsNew(w.id)}
              className="w-full rounded border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
            >
              💾 Save as new stop
            </button>
          )}
        </>
      ) : (
        <p className="mb-1 text-xs italic text-slate-500">
          Connector node (invisible)
        </p>
      )}

      <button
        type="button"
        onClick={() => onRemove(w.id)}
        className="flex w-full items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
      >
        🗑 Delete point
      </button>
    </div>,
    container,
  );
}
