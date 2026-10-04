import { useState } from "react";
import ActionBar from "./ActionBar";
import BackboneConfig from "./BackboneConfig";
import CollapsibleSection from "./CollapsibleSection";
import DetourConfig from "./DetourConfig";
import ModeSwitcher from "./ModeSwitcher";
import StopsPanel from "./StopsPanel";

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

export default function Sidebar({ d, darkMode, setDarkMode }) {
  const [configOpen, setConfigOpen] = useState(true);
  const isBackbone = d.mappingMode === "BACKBONE";

  return (
    <aside className="z-10 flex h-full w-[520px] shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-xl transition-colors">
      <header className="shrink-0 space-y-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 pb-3 pt-4 transition-colors">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-lg font-bold text-slate-800 dark:text-slate-100">
            TripCheq Admin Dashboard
          </h1>
          <button
            type="button"
            onClick={() => {
              setDarkMode(!darkMode);
              setTimeout(() => {
                if (d.backbone.selectedEditId) {
                  // If a backbone is selected, reload it fresh from the database
                  d.actions.loadBackbone(d.backbone.selectedEditId);
                } else if (typeof d.actions.redraw === "function") {
                  // Fallback for when you are drawing a new route that isn't saved yet
                  d.actions.redraw();
                }
              }, 100);
            }}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {darkMode ? "☀️️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>
        <ModeSwitcher mode={d.mappingMode} onChange={d.switchMode} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 overflow-y-auto">
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

      <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 transition-colors">
        <ActionBar
          mappingMode={d.mappingMode}
          actions={d.actions}
          status={d.status}
          isSaving={d.actions.isSaving}
        />
      </footer>
    </aside>
  );
}
