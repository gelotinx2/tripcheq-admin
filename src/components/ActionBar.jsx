// Snap / undo / clear / save buttons and the status line
export default function ActionBar({ mappingMode, actions, status }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
        <button
          type="button"
          onClick={actions.snap}
          className="rounded-md bg-blue-500 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Snap to road
        </button>
        <button
          type="button"
          onClick={actions.undo}
          disabled={!actions.canUndo}
          className="rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={actions.clear}
          className="rounded-md bg-red-500 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-600"
        >
          Clear
        </button>
      </div>

      <button
        type="button"
        onClick={actions.save}
        className="w-full rounded-md bg-emerald-500 px-4 py-3 text-base font-bold text-white shadow-md hover:bg-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        ☁ Save {mappingMode === "BACKBONE" ? "backbone" : "detour"} to database
      </button>

      <p className="m-0 h-5 text-center text-sm font-semibold text-emerald-600">
        {status}
      </p>
    </div>
  );
}
