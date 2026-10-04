import { useCallback, useRef, useState } from "react";

// Status line text. `flash` shows a message and clears it after `ms`.
export function useStatus() {
  const [status, setStatusState] = useState("");
  const timer = useRef(null);

  const setStatus = useCallback((msg) => {
    clearTimeout(timer.current);
    setStatusState(msg);
  }, []);

  const flash = useCallback((msg, ms = 3000) => {
    clearTimeout(timer.current);
    setStatusState(msg);
    timer.current = setTimeout(() => setStatusState(""), ms);
  }, []);

  return { status, setStatus, flash };
}
