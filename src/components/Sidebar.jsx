import { useState } from "react";
import ActionBar from "./ActionBar";
import BackboneConfig from "./BackboneConfig";
import CollapsibleSection from "./CollapsibleSection";
import DetourConfig from "./DetourConfig";
import ModeSwitcher from "./ModeSwitcher";
import StopsPanel from "./StopsPanel";

// One-line reminder shown while the config section is folded
function configSummary(d) {
  if (d.mappingMode === "BACKBONE") {
    const b = d.backbone;
    const routeName =
      b.routeSelect === "NEW"
        ? b.newRouteName || "New route"
        : b.routes.find((r) => r.id === b.routeSelect)?.name;
    if (!routeName) return "No route selected";
    return `${routeName}, ${b.direction.toLowerCase()}`;
  }
  const t = d.detour;
  const backbone = t.allBackbones.find((bb) => bb.id === t.backboneId);
  const backboneLabel = backbone
    ? `${backbone.transit_routes?.name} (${backbone.direction})`
    : "No backbone selected";
  return t.name ? `${t.name} on ${backboneLabel}` : backboneLabel;
}

export default function Sidebar({ d }) {
  const [configOpen, setConfigOpen] = useState(true);
  const isBackbone = d.mappingMode === "BACKBONE";

  return (
    <aside className="z-10 flex h-full w-[520px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 shadow-xl">
      <header className="shrink-0 space-y-3 border-b border-slate-200 bg-white px-4 pb-3 pt-4">
        <h1 className="m-0 text-lg font-bold text-slate-800">
          TripCheq Admin Dashboard
        </h1>
        <ModeSwitcher mode={d.mappingMode} onChange={d.switchMode} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        <CollapsibleSection
          title={isBackbone ? "Backbone setup" : "Detour setup"}
          summary={configSummary(d)}
          accent={isBackbone ? "blue" : "violet"}
          open={configOpen}
          onToggle={() => setConfigOpen((o) => !o)}
        >
          {isBackbone ? (
            <BackboneConfig b={d.backbone} />
          ) : (
            <DetourConfig d={d.detour} />
          )}
        </CollapsibleSection>

        <StopsPanel mappingMode={d.mappingMode} stops={d.stops} />
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white p-4">
        <ActionBar
          mappingMode={d.mappingMode}
          actions={d.actions}
          status={d.status}
        />
      </footer>
    </aside>
  );
}
