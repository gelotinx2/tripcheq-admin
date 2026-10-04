import { useCallback, useReducer, useRef } from "react";

const MAX_HISTORY = 50;

function reducer(state, action) {
  switch (action.type) {
    case "apply":
      return {
        present: action.updater(state.present),
        past: [...state.past, state.present].slice(-MAX_HISTORY),
      };
    case "load": // replace everything and drop history
      return { present: action.waypoints, past: [] };
    case "undo":
      if (state.past.length === 0) return state;
      return {
        present: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
      };
    default:
      return state;
  }
}

// Waypoint list with undo history
export function useWaypoints() {
  const [state, dispatch] = useReducer(reducer, { present: [], past: [] });
  const idRef = useRef(1);

  const nextId = useCallback(() => idRef.current++, []);

  // Accepts either a new array or an updater function, like setState
  const apply = useCallback((updater) => {
    dispatch({
      type: "apply",
      updater: typeof updater === "function" ? updater : () => updater,
    });
  }, []);

  const load = useCallback(
    (waypoints) => dispatch({ type: "load", waypoints }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), []);

  const update = useCallback(
    (id, field, value) =>
      apply((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, [field]: value, isDirty: true } : w,
        ),
      ),
    [apply],
  );

  const remove = useCallback(
    (id) => apply((prev) => prev.filter((w) => w.id !== id)),
    [apply],
  );

  const reorder = useCallback(
    (from, to) =>
      apply((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      }),
    [apply],
  );

  return {
    waypoints: state.present,
    canUndo: state.past.length > 0,
    nextId,
    apply,
    load,
    undo,
    update,
    remove,
    reorder,
  };
}
