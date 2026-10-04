import { TRANSIT_MODES } from "../lib/constants";
import { inputCls, labelCls } from "../lib/Styles";

export default function BackboneConfig({ b }) {
  const routeReady = b.routeSelect && b.routeSelect !== "NEW";

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center">
          <label className={`${labelCls} mb-0 flex-1`}>Master route</label>
          {routeReady && (
            <button
              type="button"
              onClick={b.onDeleteRoute}
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
            >
              🗑️ Delete route
            </button>
          )}
        </div>
        <select
          className={`${inputCls} font-semibold`}
          value={b.routeSelect}
          onChange={(e) => b.onRouteChange(e.target.value)}
        >
          <option value="">-- Select a master route first --</option>
          <option value="NEW">-- ➕ Create new master route --</option>
          {b.routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.transit_mode})
            </option>
          ))}
        </select>
      </div>

      {b.routeSelect === "NEW" && (
        <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/50 p-2">
          <input
            className={inputCls}
            type="text"
            placeholder="Route name (e.g., Alabang - Zapote)"
            value={b.newRouteName}
            onChange={(e) => b.setNewRouteName(e.target.value)}
          />
          <select
            className={inputCls}
            value={b.newRouteMode}
            onChange={(e) => b.setNewRouteMode(e.target.value)}
          >
            {TRANSIT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className={`space-y-3 border-t border-slate-200 pt-3 transition-opacity ${
          routeReady ? "" : "pointer-events-none opacity-40"
        }`}
      >
        {b.inboundDraftAvailable && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-bold text-amber-800">
              💡 Outbound exists but inbound is missing. A reversed draft is
              available.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={b.onAcceptReversed}
                className="flex-1 rounded bg-amber-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
              >
                ✨ Use reversed route
              </button>
              <button
                type="button"
                onClick={b.onDismissDraft}
                className="flex-1 rounded bg-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
              >
                Draw fresh
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={`${labelCls} mb-0`}>Edit existing backbone</label>
            {b.selectedEditId && (
              <button
                type="button"
                onClick={b.onDeleteBackbone}
                className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
              >
                🗑️ Delete direction
              </button>
            )}
          </div>
          <select
            className={inputCls}
            value={b.selectedEditId}
            onChange={(e) => b.onSelectEdit(e.target.value)}
          >
            <option value="">
              -- ➕ Draw fresh backbone for this route --
            </option>
            {b.backbones.map((bb) => (
              <option key={`edit-bb-${bb.id}`} value={bb.id}>
                {bb.name
                  ? `${bb.name} (${bb.direction})`
                  : `Default (${bb.direction})`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelCls}>Direction</label>
            <select
              className={inputCls}
              value={b.direction}
              onChange={(e) => b.onDirectionChange(e.target.value)}
            >
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
            </select>
          </div>
          <div className="flex-1">
            <label className={labelCls}>Variant Name (Optional)</label>
            <input
              className={inputCls}
              type="text"
              placeholder="e.g. via SLEX (Leave blank for default)"
              value={b.backboneName}
              onChange={(e) => b.setBackboneName(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
