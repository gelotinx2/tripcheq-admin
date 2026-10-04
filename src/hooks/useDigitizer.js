import { useMemo, useState, useEffect } from "react";
import { decodePolyline, encodePolyline } from "../lib/Polyline";
import {
  blankWaypoint,
  globalStopToWaypoint,
  stopRowToWaypoint,
} from "../lib/Waypoints";
import { snapToRoad } from "../services/Mapbox";
import {
  deleteBackbone,
  deleteRoute,
  fetchBackboneStopRows,
  insertStop,
  saveBackbone,
  saveDetour,
  updateTransitStop,
} from "../services/transitApi";
import { useBackboneForm } from "./useBackboneForm";
import { useDetourForm } from "./useDetourForm";
import { useMapController } from "./useMapController";
import { useStatus } from "./useStatus";
import { useTransitData } from "./useTransitData";
import { useUndoShortcut } from "./useUndoShortcut";
import { useWaypoints } from "./useWaypoints";

// Ties the data, map and form hooks together and holds the workflows
// (load, reverse, snap, save, delete). Components only read what it returns.
export function useDigitizer({ darkMode } = {}) {
  const [isSaving, setIsSaving] = useState(false);
  const [mappingMode, setMappingMode] = useState("BACKBONE");
  const [nodeType, setNodeType] = useState("stop");
  const [routePolyline, setRoutePolyline] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const popupContainer = useMemo(() => document.createElement("div"), []);

  const { status, setStatus, flash } = useStatus();
  const data = useTransitData();
  const wp = useWaypoints();
  const bb = useBackboneForm();
  const detour = useDetourForm();

  // ---------- MAP ----------
  const map = useMapController({
    waypoints: wp.waypoints,
    popupInfo,
    popupContainer,
    darkMode,
    onMapClick: ({ lng, lat }) => {
      if (mappingMode === "BACKBONE" && !bb.routeSelect) {
        alert("Please select or create a Master Route first!");
        return;
      }
      if (
        mappingMode === "DETOUR" &&
        (!detour.splitStopId || !detour.mergeStopId)
      ) {
        alert(
          "Please select the Split and Merge stops before drawing the detour.",
        );
        return;
      }

      const id = wp.nextId();

      if (mappingMode === "DETOUR") {
        // Insert logic: add the new node right before the merge anchor
        wp.apply((prev) => {
          const mergeIdx = prev.findIndex((p) => p.isMergeAnchor);
          if (mergeIdx === -1)
            return [...prev, blankWaypoint(id, lng, lat, nodeType)]; // fallback

          const next = [...prev];
          next.splice(mergeIdx, 0, blankWaypoint(id, lng, lat, nodeType));
          return next;
        });
      } else {
        wp.apply((prev) => [...prev, blankWaypoint(id, lng, lat, nodeType)]);
      }
      setPopupInfo({ id, lng, lat });
    },
    onMarkerDragEnd: (id, lng, lat) => {
      const w = wp.waypoints.find((p) => p.id === id);
      if (w && w.isAnchor) return; // Disallow dragging anchor nodes

      wp.apply((prev) =>
        prev.map((p) =>
          p.id === id && !p.isAnchor ? { ...p, lng, lat, isDirty: true } : p,
        ),
      );
      setPopupInfo((prev) =>
        prev && prev.id === id ? { ...prev, lng, lat } : prev,
      );
    },
    onMarkerClick: (id, lng, lat) => setPopupInfo({ id, lng, lat }),
    onPopupClose: () => setPopupInfo(null),
  });

  // ---------- HELPERS ----------
  const clearMapData = () => {
    wp.apply(() => []);
    setRoutePolyline(null);
    bb.setSelectedEditId("");
    bb.setInboundDraftAvailable(false);
    bb.setCachedOutboundBb(null);
    map.setRouteLine(null);
    setPopupInfo(null);
  };

  const refreshRouteView = () => {
    if (routePolyline) {
      const decodedCoords = decodePolyline(routePolyline);
      map.setRouteLine(decodedCoords);
    }
  };

  const undo = () => {
    wp.undo();
    setPopupInfo(null);
  };
  useUndoShortcut(undo);

  const removeWaypoint = (id) => {
    wp.remove(id);
    setPopupInfo((prev) => (prev && prev.id === id ? null : prev));
  };

  // ---------- MODE / ROUTE / DIRECTION ----------
  const switchMode = (mode) => {
    // Save current backbone context before switching
    const currentPolyline = routePolyline;
    setMappingMode(mode);

    if (mode === "BACKBONE") {
      // Return to full backbone editing
      bb.setSelectedEditId("");
    } else if (mode === "DETOUR") {
      // Entering Detour mode: DO NOT clear the map.
      // Keep the backbone line visible as context, but clear the waypoints
      // so the user only edits the detour segment.
      wp.apply(() => []);

      // Auto-set the backbone config to the currently loaded backbone
      if (bb.selectedEditId) {
        detour.setBackboneId(bb.selectedEditId);
      }
    }
  };

  // Watch detour split/merge selections and inject them as anchors
  useEffect(() => {
    if (
      mappingMode === "DETOUR" &&
      detour.splitStopId &&
      detour.mergeStopId &&
      detour.backboneStops.length > 0
    ) {
      // Pull full stop geometry from data.stops to guarantee valid coordinates
      const splitStop = data.stops.find((s) => s.id === detour.splitStopId);
      const mergeStop = data.stops.find((s) => s.id === detour.mergeStopId);

      // Dynamically calculate the index position instead of guessing the database column
      const splitOrder =
        detour.backboneStops.findIndex(
          (s) => s.stop_id === detour.splitStopId,
        ) + 1;
      const mergeOrder =
        detour.backboneStops.findIndex(
          (s) => s.stop_id === detour.mergeStopId,
        ) + 1;

      if (splitStop && mergeStop) {
        wp.apply(() => [
          {
            ...globalStopToWaypoint(splitStop, wp.nextId()),
            isAnchor: true,
            isSplitAnchor: true,
            backboneIndex: splitOrder > 0 ? splitOrder : 1,
          },
          {
            ...globalStopToWaypoint(mergeStop, wp.nextId()),
            isAnchor: true,
            isMergeAnchor: true,
            backboneIndex: mergeOrder > 0 ? mergeOrder : 2,
          },
        ]);

        // Auto-center the map on the split node to help the user start drawing
        map.flyTo([splitStop.longitude, splitStop.latitude], 15);
      }
    }
  }, [
    mappingMode,
    detour.splitStopId,
    detour.mergeStopId,
    detour.backboneStops,
  ]);

  const changeRoute = (routeId) => {
    bb.setRouteSelect(routeId);
    bb.setSelectedEditId("");
    clearMapData();
  };

  const changeDirection = (newDir) => {
    bb.setDirection(newDir);
    bb.setSelectedEditId("");

    const routeBackbones = data.backbones.filter(
      (b) => b.transit_routes?.id === bb.routeSelect,
    );
    const outbound = routeBackbones.find((b) => b.direction === "OUTBOUND");
    const hasInbound = routeBackbones.some((b) => b.direction === "INBOUND");

    if (newDir === "INBOUND" && outbound && !hasInbound) {
      bb.setCachedOutboundBb(outbound);
      bb.setInboundDraftAvailable(true);
      wp.apply(() => []);
      setRoutePolyline(null);
      map.setRouteLine(null);
      setPopupInfo(null);
    } else {
      bb.setInboundDraftAvailable(false);
      bb.setCachedOutboundBb(null);
      clearMapData();
    }
  };

  // ---------- LOAD EXISTING BACKBONE ----------
  const loadBackbone = async (bbId) => {
    if (!bbId) {
      clearMapData();
      return;
    }
    setStatus("Loading backbone data...");

    const found = data.backbones.find((b) => b.id === bbId);
    if (!found) return;

    bb.setRouteSelect(found.transit_routes.id);
    bb.setDirection(found.direction);
    bb.setBackboneName(found.name || "");
    setRoutePolyline(found.encoded_polyline);
    bb.setInboundDraftAvailable(false);

    let decodedCoords = [];
    if (found.encoded_polyline) {
      decodedCoords = decodePolyline(found.encoded_polyline);
      map.setRouteLine(decodedCoords);
    }

    const { data: rows, error } = await fetchBackboneStopRows(bbId);
    if (error) {
      console.error("Error loading backbone stops:", error);
      setStatus("");
      return;
    }

    let loadedWaypoints = [];
    if (rows) {
      loadedWaypoints = rows.map((row) => stopRowToWaypoint(row, wp.nextId()));
      wp.load(loadedWaypoints);
    }

    // Combine polyline coordinates and stop coordinates to calculate overall bounding box
    const allPoints = [
      ...decodedCoords,
      ...loadedWaypoints.map((w) => [w.lng, w.lat]),
    ];

    if (allPoints.length > 0) {
      map.fitBounds(allPoints);
    }

    flash("✅ Backbone loaded successfully!");
  };

  const selectBackboneToEdit = (bbId) => {
    bb.setSelectedEditId(bbId);
    loadBackbone(bbId);
  };

  // ---------- INBOUND DRAFT (REVERSE OF OUTBOUND) ----------
  const acceptReversedRoute = async () => {
    if (!bb.cachedOutboundBb) return;
    setStatus("Loading reversed stop sequence...");

    setRoutePolyline(null);
    map.setRouteLine(null);

    const { data: rows } = await fetchBackboneStopRows(bb.cachedOutboundBb.id, {
      ascending: false,
    });

    if (rows) {
      const reversed = rows.map((row) =>
        stopRowToWaypoint(row, wp.nextId(), { keepSignboard: false }),
      );
      wp.load(reversed);
      if (reversed.length > 0)
        map.flyTo([reversed[0].lng, reversed[0].lat], 14);
    }

    bb.setInboundDraftAvailable(false);
    flash(
      "✨ Reversed stops loaded! Click 'Snap to Road' to generate a fresh polyline.",
      5000,
    );
  };

  // ---------- DELETE ----------
  const deleteMasterRoute = async () => {
    if (!bb.routeSelect || bb.routeSelect === "NEW") return;
    if (
      !confirm(
        "Are you sure you want to delete this Master Route and ALL its backbones/variants?",
      )
    )
      return;

    setStatus("Deleting Master Route...");
    const error = await deleteRoute(bb.routeSelect);
    if (error) {
      setStatus("");
      return alert("Error deleting: " + error.message);
    }
    bb.setRouteSelect("");
    clearMapData();
    flash("✅ Master route deleted.");
    await data.refresh();
  };

  const deleteSelectedBackbone = async () => {
    if (!bb.selectedEditId) return;
    if (!confirm("Delete this Backbone and its stop mappings?")) return;

    setStatus("Deleting Backbone...");
    const error = await deleteBackbone(bb.selectedEditId);
    if (error) {
      setStatus("");
      return alert("Error deleting: " + error.message);
    }
    bb.setSelectedEditId("");
    clearMapData();
    flash("✅ Backbone deleted.");
    await data.refresh();
  };

  // ---------- STOP ACTIONS ----------
  const saveStopAsNew = async (wId) => {
    const target = wp.waypoints.find((w) => w.id === wId);
    if (!target) return;
    setStatus("Saving stop as a new entry...");

    const { data: newStop, error } = await insertStop(target);
    if (error) {
      setStatus("");
      return alert("Error saving new stop: " + error.message);
    }
    wp.apply((prev) =>
      prev.map((w) =>
        w.id === wId
          ? { ...w, dbId: newStop.id, originalDbId: newStop.id, isDirty: false }
          : w,
      ),
    );
    flash("✅ Saved as a brand new stop!");
    await data.refresh();
  };

  const saveStopChanges = async (wId) => {
    const target = wp.waypoints.find((w) => w.id === wId);
    if (!target || !target.dbId) return;
    setStatus("Saving stop changes...");

    const error = await updateTransitStop(target.dbId, {
      name: target.name,
      aliases: target.aliases,
      stop_type: target.stopType,
      latitude: target.lat,
      longitude: target.lng,
    });

    if (error) {
      setStatus("");
      return alert("Error updating stop: " + error.message);
    }

    wp.apply((prev) =>
      prev.map((w) => (w.id === wId ? { ...w, isDirty: false } : w)),
    );
    flash("✅ Stop changes saved successfully!");
    await data.refresh();
  };

  const replaceStopWithExisting = (wId, dbStopId) => {
    if (!dbStopId) return;
    const stop = data.stops.find((s) => s.id === dbStopId);
    if (!stop) return;

    wp.apply((prev) =>
      prev.map((w) =>
        w.id === wId
          ? {
              ...w,
              dbId: stop.id,
              originalDbId: stop.id,
              lng: stop.longitude,
              lat: stop.latitude,
              name: stop.name,
              aliases: stop.aliases || "",
              stopType: stop.stop_type || "STREET_STOP",
              isDirty: false,
            }
          : w,
      ),
    );
    map.flyTo([stop.longitude, stop.latitude], 15);
    flash("✅ Stop replaced with existing database stop!");
  };

  const addExistingStop = (stopId) => {
    if (!stopId) return;
    const stop = data.stops.find((s) => s.id === stopId);
    if (!stop) return;
    wp.apply((prev) => [...prev, globalStopToWaypoint(stop, wp.nextId())]);
    map.flyTo([stop.longitude, stop.latitude], 15);
  };

  // ---------- SNAP + SAVE ----------
  const snap = async () => {
    if (wp.waypoints.length < 2) return alert("Drop at least 2 points.");
    setStatus("Snapping line to road network...");
    try {
      const coords = await snapToRoad(wp.waypoints);
      setRoutePolyline(encodePolyline(coords));
      map.setRouteLine(coords);
      setStatus("");
    } catch (e) {
      setStatus("");
      alert("Error generating route: " + e.message);
    }
  };

  const save = async () => {
    if (!routePolyline) {
      return alert(
        "Please click 'Snap to Road' first to generate the polyline.",
      );
    }
    setIsSaving(true);
    try {
      const dirtyStops = wp.waypoints.filter(
        (w) => w.type === "stop" && w.dbId && w.isDirty,
      );
      if (dirtyStops.length > 0) {
        const confirmOverwrite = confirm(
          `You have ${dirtyStops.length} edited stop(s) with unsaved changes. Do you want to overwrite these existing stops in the database?`,
        );
        if (!confirmOverwrite) return;

        // Automatically push updates for dirty stops before saving backbone
        for (const ds of dirtyStops) {
          await updateTransitStop(ds.dbId, {
            name: ds.name,
            aliases: ds.aliases,
            stop_type: ds.stopType,
            latitude: ds.lat,
            longitude: ds.lng,
          });
        }
      }

      try {
        if (mappingMode === "BACKBONE") {
          if (!bb.routeSelect) {
            return alert("Please select or create a Master Route first.");
          }
          if (bb.routeSelect === "NEW" && !bb.newRouteName) {
            return alert("Enter a name for the new route.");
          }
          setStatus("Saving Backbone & Polyline...");
          const { routeId } = await saveBackbone({
            routeSelect: bb.routeSelect,
            newRouteName: bb.newRouteName,
            newRouteMode: bb.newRouteMode,
            backboneName: bb.backboneName,
            direction: bb.direction,
            polyline: routePolyline,
            editId: bb.selectedEditId,
            waypoints: wp.waypoints,
          });
          bb.setRouteSelect(routeId);
        } else {
          if (
            !detour.backboneId ||
            !detour.splitStopId ||
            !detour.mergeStopId ||
            !detour.name ||
            !detour.triggerSignboard
          ) {
            return alert("Please fill out all Detour fields.");
          }
          setStatus("Saving Detour & Polyline...");
          await saveDetour({
            backboneId: detour.backboneId,
            name: detour.name,
            splitStopId: detour.splitStopId,
            mergeStopId: detour.mergeStopId,
            triggerSignboard: detour.triggerSignboard,
            polyline: routePolyline,
            waypoints: wp.waypoints,
          });
        }
        flash("✅ Successfully saved to Supabase!", 5000);
        await data.refresh();
      } catch (e) {
        setStatus("");
        alert(e.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- DERIVED ----------
  const filteredBackbones =
    bb.routeSelect && bb.routeSelect !== "NEW"
      ? data.backbones.filter((b) => b.transit_routes?.id === bb.routeSelect)
      : [];

  const popupWaypoint = popupInfo
    ? wp.waypoints.find((w) => w.id === popupInfo.id)
    : null;

  const stopsDisabled = !bb.routeSelect && mappingMode === "BACKBONE";

  return {
    mapContainerRef: map.containerRef,
    status,
    mappingMode,
    switchMode,

    backbone: {
      routes: data.routes,
      backbones: filteredBackbones,
      routeSelect: bb.routeSelect,
      onRouteChange: changeRoute,
      newRouteName: bb.newRouteName,
      setNewRouteName: bb.setNewRouteName,
      newRouteMode: bb.newRouteMode,
      setNewRouteMode: bb.setNewRouteMode,
      direction: bb.direction,
      onDirectionChange: changeDirection,
      selectedEditId: bb.selectedEditId,
      onSelectEdit: selectBackboneToEdit,
      onDeleteRoute: deleteMasterRoute,
      onDeleteBackbone: deleteSelectedBackbone,
      inboundDraftAvailable: bb.inboundDraftAvailable,
      onAcceptReversed: acceptReversedRoute,
      onDismissDraft: () => bb.setInboundDraftAvailable(false),
    },

    detour: {
      allBackbones: data.backbones,
      backboneId: detour.backboneId,
      setBackboneId: detour.setBackboneId,
      backboneStops: detour.backboneStops,
      availableMergeStops: detour.availableMergeStops,
      splitStopId: detour.splitStopId,
      setSplitStopId: detour.setSplitStopId,
      mergeStopId: detour.mergeStopId,
      setMergeStopId: detour.setMergeStopId,
      name: detour.name,
      setName: detour.setName,
      triggerSignboard: detour.triggerSignboard,
      setTriggerSignboard: detour.setTriggerSignboard,
    },

    stops: {
      waypoints: wp.waypoints,
      selectedId: popupInfo?.id ?? null,
      disabled: stopsDisabled,
      nodeType,
      setNodeType,
      globalStops: data.stops,
      onAddExisting: addExistingStop,
      onUpdate: wp.update,
      onRemove: removeWaypoint,
      onReorder: wp.reorder,
      onSaveAsNew: saveStopAsNew,
      onSaveChanges: saveStopChanges,
      onReplace: replaceStopWithExisting,
    },

    actions: {
      snap,
      undo,
      canUndo: wp.canUndo,
      clear: clearMapData,
      save,
      redraw: refreshRouteView,
      loadBackbone,
    },

    popup: {
      container: popupContainer,
      waypoint: popupWaypoint,
      onUpdate: wp.update,
      onRemove: removeWaypoint,
      onSaveAsNew: saveStopAsNew,
      onSaveChanges: saveStopChanges,
      onClose: () => setPopupInfo(null),
    },
  };
}
