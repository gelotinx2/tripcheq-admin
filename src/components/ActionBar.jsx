export default function ActionBar({ mappingMode, actions, status, isSaving }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
        <button
          type="button"
          onClick={actions.snap}
          disabled={isSaving}
          className="rounded-md bg-blue-500 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50"
        >
          Snap to road
        </button>
        <button
          type="button"
          onClick={actions.undo}
          disabled={!actions.canUndo || isSaving}
          className="rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={actions.clear}
          disabled={isSaving}
          className="rounded-md bg-red-500 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-600 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      <button
        type="button"
        onClick={actions.save}
        disabled={isSaving}
        className="w-full rounded-md bg-emerald-500 px-4 py-3 text-base font-bold text-white shadow-md hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-wait flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Saving to database...
          </>
        ) : (
          `☁ Save ${mappingMode === "BACKBONE" ? "backbone" : "detour"} to database`
        )}
      </button>

      <p className="m-0 h-5 text-center text-sm font-semibold text-emerald-600">
        {status}
      </p>
    </div>
  );
}
