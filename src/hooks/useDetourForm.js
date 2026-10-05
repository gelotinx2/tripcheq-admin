import { useEffect, useState, useMemo } from "react";
import {
  fetchBackboneStopSummaries,
  fetchDetoursByBackbone,
} from "../services/transitApi";

export function useDetourForm() {
  // Cascading Selection State
  const [masterRouteId, setMasterRouteId] = useState("");
  const [backboneId, setBackboneId] = useState("");
  const [detourEditId, setDetourEditId] = useState(""); // "" = none, "NEW" = create, "<uuid>" = edit

  // Fetched Data
  const [backboneStops, setBackboneStops] = useState([]);
  const [existingDetours, setExistingDetours] = useState([]);

  // Form Fields
  const [name, setName] = useState("");
  const [triggerSignboard, setTriggerSignboard] = useState("");
  const [splitStopId, setSplitStopId] = useState("");
  const [mergeStopId, setMergeStopId] = useState("");

  // 1. Reset backbone when master route changes
  useEffect(() => {
    setBackboneId("");
  }, [masterRouteId]);

  // 2. Fetch stops & detours when backbone changes
  useEffect(() => {
    setDetourEditId("");
    setExistingDetours([]);
    setBackboneStops([]);
    setName("");
    setTriggerSignboard("");
    setSplitStopId("");
    setMergeStopId("");

    if (!backboneId) return;

    let cancelled = false;
    Promise.all([
      fetchBackboneStopSummaries(backboneId),
      fetchDetoursByBackbone(backboneId),
    ]).then(([stopsData, detoursData]) => {
      if (cancelled) return;

      if (stopsData) {
        setBackboneStops(stopsData);
        if (stopsData.length > 0) {
          setSplitStopId(stopsData[0].stop_id);
          setMergeStopId(stopsData[stopsData.length - 1].stop_id);
        }
      }
      if (detoursData) setExistingDetours(detoursData);
    });

    return () => {
      cancelled = true;
    };
  }, [backboneId]);

  // 3. Auto-fill form when an existing detour is selected
  useEffect(() => {
    if (detourEditId && detourEditId !== "NEW") {
      const d = existingDetours.find((x) => x.id === detourEditId);
      if (d) {
        setName(d.name || "");
        setTriggerSignboard(d.trigger_signboard || "");
        setSplitStopId(d.split_stop_id || "");
        setMergeStopId(d.merge_stop_id || "");
      }
    } else if (detourEditId === "NEW") {
      setName("");
      setTriggerSignboard("");
      if (backboneStops.length > 0) {
        setSplitStopId(backboneStops[0].stop_id);
        setMergeStopId(backboneStops[backboneStops.length - 1].stop_id);
      }
    }
  }, [detourEditId, existingDetours, backboneStops]);

  const selectedDetour = useMemo(() => {
    return existingDetours.find((x) => x.id === detourEditId) || null;
  }, [detourEditId, existingDetours]);

  // Calculate available merge stops (only those AFTER the selected split stop)
  const availableMergeStops = useMemo(() => {
    if (!splitStopId || backboneStops.length === 0) return [];
    const splitIndex = backboneStops.findIndex(
      (s) => s.stop_id === splitStopId,
    );
    return splitIndex >= 0 ? backboneStops.slice(splitIndex + 1) : [];
  }, [splitStopId, backboneStops]);

  // Auto-correct mergeStopId if invalid
  useEffect(() => {
    if (availableMergeStops.length > 0) {
      const isValid = availableMergeStops.some(
        (s) => s.stop_id === mergeStopId,
      );
      if (!isValid) {
        setMergeStopId(
          availableMergeStops[availableMergeStops.length - 1].stop_id,
        );
      }
    } else {
      setMergeStopId("");
    }
  }, [splitStopId, availableMergeStops, mergeStopId]);

  return {
    masterRouteId,
    setMasterRouteId,
    backboneId,
    setBackboneId,
    detourEditId,
    setDetourEditId,
    selectedDetour,
    existingDetours,
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
