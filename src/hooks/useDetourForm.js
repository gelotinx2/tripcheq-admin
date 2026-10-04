import { useEffect, useState, useMemo } from "react";
import { fetchBackboneStopSummaries } from "../services/transitApi";

export function useDetourForm() {
  const [backboneId, setBackboneId] = useState("");
  const [name, setName] = useState("");
  const [triggerSignboard, setTriggerSignboard] = useState("");
  const [splitStopId, setSplitStopId] = useState("");
  const [mergeStopId, setMergeStopId] = useState("");
  const [backboneStops, setBackboneStops] = useState([]);

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

  // Calculate available merge stops (only those AFTER the selected split stop)
  const availableMergeStops = useMemo(() => {
    if (!splitStopId || backboneStops.length === 0) return [];
    const splitIndex = backboneStops.findIndex(
      (s) => s.stop_id === splitStopId,
    );
    return splitIndex >= 0 ? backboneStops.slice(splitIndex + 1) : [];
  }, [splitStopId, backboneStops]);

  // Auto-correct mergeStopId if user selects a split stop that comes after the current merge
  useEffect(() => {
    if (availableMergeStops.length > 0) {
      const isValid = availableMergeStops.some(
        (s) => s.stop_id === mergeStopId,
      );
      if (!isValid) {
        // Default to the very last stop in the available valid list
        setMergeStopId(
          availableMergeStops[availableMergeStops.length - 1].stop_id,
        );
      }
    } else {
      setMergeStopId(""); // Reset if no valid merge stops
    }
  }, [splitStopId, availableMergeStops]);

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
    availableMergeStops,
  };
}
