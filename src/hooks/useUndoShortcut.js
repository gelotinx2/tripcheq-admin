import { useEffect, useRef } from "react";

// Ctrl/Cmd+Z calls `onUndo`, except while typing in a form field
export function useUndoShortcut(onUndo) {
  const handlerRef = useRef(onUndo);

  useEffect(() => {
    handlerRef.current = onUndo;
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        handlerRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
