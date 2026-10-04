import { useEffect, useState } from "react";
import { fetchBackboneStopSummaries } from "../services/transitApi";

// Form state for the "Add Detour" mode
export function useDetourForm() {
  const [backboneId, setBackboneId] = useState("");
  const [name, setName] = useState("");
  const [triggerSignboard, setTriggerSignboard] = useState("");
  const [splitStopId, setSplitStopId] = useState("");
  const [mergeStopId, setMergeStopId] = useState("");
  const [backboneStops, setBackboneStops] = useState([]);

  // Load the chosen backbone's stops for the split/merge dropdowns
  useEffect(() => {
    if (!backboneId) {
      setBackboneStops([]);
      return;
    }
    let cancelled = false;
    fetchBackboneStopSummaries(backboneId).then((data) => {
      if (cancelled || !data) return;
      setBackboneStops(data);
      if (data.length > 0) {
        setSplitStopId(data[0].stop_id);
        setMergeStopId(data[data.length - 1].stop_id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [backboneId]);

  return {
    backboneId,
    setBackboneId,
    name,
    setName,
    triggerSignboard,
    setTriggerSignboard,
    splitStopId,
    setSplitStopId,
    mergeStopId,
    setMergeStopId,
    backboneStops,
  };
}
