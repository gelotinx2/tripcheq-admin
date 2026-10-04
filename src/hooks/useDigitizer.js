import { useMemo, useState } from "react";
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
export function useDigitizer() {
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
    onMapClick: ({ lng, lat }) => {
      if (!bb.routeSelect && mappingMode === "BACKBONE") {
        alert("Please select or create a Master Route first!");
        return;
      }
      const id = wp.nextId();
      wp.apply((prev) => [...prev, blankWaypoint(id, lng, lat, nodeType)]);
      setPopupInfo({ id, lng, lat });
    },
    onMarkerDragEnd: (id, lng, lat) => {
      wp.apply((prev) =>
        prev.map((p) => (p.id === id ? { ...p, lng, lat, isDirty: true } : p)),
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
    setMappingMode(mode);
    clearMapData();
  };

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
    setRoutePolyline(found.encoded_polyline);
    bb.setInboundDraftAvailable(false);

    if (found.encoded_polyline) {
      const coords = decodePolyline(found.encoded_polyline);
      map.setRouteLine(coords);
      if (coords.length > 0) map.flyTo(coords[0], 14);
    }

    const { data: rows, error } = await fetchBackboneStopRows(bbId);
    if (error) {
      console.error("Error loading backbone stops:", error);
      setStatus("");
      return;
    }
    if (rows) {
      wp.load(rows.map((row) => stopRowToWaypoint(row, wp.nextId())));
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
      onReplace: replaceStopWithExisting,
    },

    actions: {
      snap,
      undo,
      canUndo: wp.canUndo,
      clear: clearMapData,
      save,
    },

    popup: {
      container: popupContainer,
      waypoint: popupWaypoint,
      onUpdate: wp.update,
      onRemove: removeWaypoint,
      onSaveAsNew: saveStopAsNew,
      onClose: () => setPopupInfo(null),
    },
  };
}
