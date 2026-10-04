const MODES = [
  { id: "BACKBONE", label: "📍 Draw backbone", active: "text-blue-600" },
  { id: "DETOUR", label: "🔀 Add detour", active: "text-violet-600" },
];

export default function ModeSwitcher({ mode, onChange }) {
  return (
    <div className="flex rounded-lg bg-slate-200 p-1" role="tablist">
      {MODES.map((m) => {
        const selected = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(m.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
              selected
                ? `bg-white shadow-sm ${m.active}`
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
