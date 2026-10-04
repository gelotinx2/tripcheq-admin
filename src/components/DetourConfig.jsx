import { inputCls, labelCls } from "../lib/Styles";

export default function DetourConfig({ d }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Attach to backbone</label>
        <select
          className={inputCls}
          value={d.backboneId}
          onChange={(e) => d.setBackboneId(e.target.value)}
        >
          <option value="">-- Select a backbone --</option>
          {d.allBackbones.map((bb) => (
            <option key={bb.id} value={bb.id}>
              {bb.transit_routes?.name} ({bb.direction})
            </option>
          ))}
        </select>
      </div>

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
                {s.transit_stops.name}
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
            {d.backboneStops.map((s) => (
              <option key={`merge-${s.stop_id}`} value={s.stop_id}>
                {s.transit_stops.name}
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
  );
}
