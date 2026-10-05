import { inputCls, labelCls } from "../lib/Styles";

export default function DetourConfig({ d }) {
  // Filter backbones to only show ones belonging to the selected Master Route
  const filteredBackbones = d.allBackbones.filter(
    (b) => b.transit_routes?.id === d.masterRouteId,
  );

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>1. Select Master Route</label>
        <select
          className={`${inputCls} font-semibold`}
          value={d.masterRouteId}
          onChange={(e) => d.setMasterRouteId(e.target.value)}
        >
          <option value="">-- Select Master Route --</option>
          {d.allRoutes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.transit_mode})
            </option>
          ))}
        </select>
      </div>
      <div
        className={`transition-opacity ${!d.masterRouteId ? "pointer-events-none opacity-40" : ""}`}
      >
        <label className={labelCls}>2. Select Backbone</label>
        <select
          className={inputCls}
          value={d.backboneId}
          onChange={(e) => d.setBackboneId(e.target.value)}
        >
          <option value="">-- Select Backbone --</option>
          {filteredBackbones.map((bb) => (
            <option key={bb.id} value={bb.id}>
              {bb.name
                ? `${bb.name} (${bb.direction})`
                : `Default (${bb.direction})`}
            </option>
          ))}
        </select>
      </div>
      <div
        className={`transition-opacity ${!d.backboneId ? "pointer-events-none opacity-40" : ""}`}
      >
        <label className={labelCls}>3. Create or Edit Detour</label>
        <select
          className={inputCls}
          value={d.detourEditId}
          onChange={(e) => d.setDetourEditId(e.target.value)}
        >
          <option value="">-- Choose action --</option>
          <option value="NEW">-- ➕ Create New Detour --</option>
          {d.existingDetours.map((detour) => (
            <option key={detour.id} value={detour.id}>
              ✏️ Edit: {detour.name}
            </option>
          ))}
        </select>
      </div>
      {d.detourEditId && (
        <div className="space-y-3 border-t border-slate-200 pt-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelCls}>Split node (start)</label>
              <select
                className={inputCls}
                value={d.splitStopId}
                onChange={(e) => d.setSplitStopId(e.target.value)}
              >
                {d.backboneStops.map((s) => (
                  <option key={`split-${s.stop_id}`} value={s.stop_id}>
                    {s.route_order ? `${s.route_order}. ` : ""}
                    {s.transit_stops?.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Merge node (end)</label>
              <select
                className={inputCls}
                value={d.mergeStopId}
                onChange={(e) => d.setMergeStopId(e.target.value)}
              >
                {d.availableMergeStops &&
                  d.availableMergeStops.map((s) => (
                    <option key={`merge-${s.stop_id}`} value={s.stop_id}>
                      {s.route_order ? `${s.route_order}. ` : ""}
                      {s.transit_stops?.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Detour name (internal)</label>
            <input
              className={inputCls}
              type="text"
              placeholder="e.g. Via Cabuyao Bayan"
              value={d.name}
              onChange={(e) => d.setName(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Signboard trigger</label>
            <input
              className={inputCls}
              type="text"
              placeholder="e.g. CABUYAO BAYAN"
              value={d.triggerSignboard}
              onChange={(e) => d.setTriggerSignboard(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
