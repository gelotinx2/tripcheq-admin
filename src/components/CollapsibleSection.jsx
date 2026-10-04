const ACCENTS = {
  blue: { border: "border-blue-200", dot: "bg-blue-500" },
  violet: { border: "border-violet-200", dot: "bg-violet-500" },
};

// A titled panel that folds away. While folded, `summary` shows a short
// reminder of what is configured inside.
export default function CollapsibleSection({
  title,
  summary,
  accent = "blue",
  open,
  onToggle,
  children,
}) {
  const a = ACCENTS[accent];
  return (
    <section
      className={`mb-3 shrink-0 overflow-hidden rounded-lg border bg-white shadow-sm ${a.border}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${a.dot}`} />
        <span className="text-sm font-bold text-slate-800">{title}</span>
        {!open && summary && (
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
            {summary}
          </span>
        )}
        <span
          aria-hidden="true"
          className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="max-h-[40vh] overflow-y-auto border-t border-slate-100 p-3">
          {children}
        </div>
      )}
    </section>
  );
}
