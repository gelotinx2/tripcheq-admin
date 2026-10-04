import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Map, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
);

const MAPBOX_KEY = import.meta.env.VITE_MAPBOX_KEY;
const EMPTY_LINE = {
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: [] },
};

function decodePolyline(str, precision = 5) {
  let index = 0,
    lat = 0,
    lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);
  while (index < str.length) {
    let byte,
      shift = 0,
      result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}

function encodePolyline(coordinates, precision = 5) {
  const factor = Math.pow(10, precision);
  let result = "";
  let lastLat = 0,
    lastLng = 0;

  const encodeValue = (value) => {
    value = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (value >= 0x20) {
      chunk += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    chunk += String.fromCharCode(value + 63);
    return chunk;
  };

  for (const [lng, lat] of coordinates) {
    const latE5 = Math.round(lat * factor);
    const lngE5 = Math.round(lng * factor);
    result += encodeValue(latE5 - lastLat) + encodeValue(lngE5 - lastLng);
    lastLat = latE5;
    lastLng = lngE5;
  }
  return result;
}

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef({});
  const nextId = useRef(1);
  const nodeTypeRef = useRef("stop");
  const waypointsRef = useRef([]);
  const routeSelectRef = useRef("");
  const mappingModeRef = useRef("BACKBONE");
  const popupRef = useRef(null);
  const popupContainerRef = useRef(null);

  // --- STATE ---
  const [mappingMode, setMappingMode] = useState("BACKBONE");
  const [status, setStatus] = useState("");

  // Data State
  const [existingRoutes, setExistingRoutes] = useState([]);
  const [existingBackbones, setExistingBackbones] = useState([]);
  const [backboneStops, setBackboneStops] = useState([]);
  const [globalStops, setGlobalStops] = useState([]);

  // Map & History State
  const [waypoints, setWaypoints] = useState([]);
  const [pastWaypoints, setPastWaypoints] = useState([]);
  const [nodeType, setNodeType] = useState("stop");
  const [routePolyline, setRoutePolyline] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);

  // Backbone Form
  const [routeSelect, setRouteSelect] = useState("");
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteMode, setNewRouteMode] = useState("JEEPNEY_TRADITIONAL");
  const [backboneDirection, setBackboneDirection] = useState("OUTBOUND");
  const [selectedBackboneEditId, setSelectedBackboneEditId] = useState("");

  // Inbound Draft Feature State
  const [inboundDraftAvailable, setInboundDraftAvailable] = useState(false);
  const [cachedOutboundBb, setCachedOutboundBb] = useState(null);

  // Detour Form
  const [selectedBackboneId, setSelectedBackboneId] = useState("");
  const [detourName, setDetourName] = useState("");
  const [triggerSignboard, setTriggerSignboard] = useState("");
  const [splitStopId, setSplitStopId] = useState("");
  const [mergeStopId, setMergeStopId] = useState("");

  // Replacement UI State per Stop item
  const [replacingStopId, setReplacingStopId] = useState(null);

  useEffect(() => {
    routeSelectRef.current = routeSelect;
  }, [routeSelect]);
  useEffect(() => {
    mappingModeRef.current = mappingMode;
  }, [mappingMode]);
  useEffect(() => {
    nodeTypeRef.current = nodeType;
  }, [nodeType]);
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);
  useEffect(() => {
    popupContainerRef.current = document.createElement("div");
  }, []);

  const dispatchWaypoints = (updater) => {
    setWaypoints((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setPastWaypoints((currPast) => [...(currPast || []), prev].slice(-50));
      return next;
    });
  };

  const undoLastAction = () => {
    setPastWaypoints((prevPast) => {
      const past = prevPast || [];
      if (past.length === 0) return past;
      setWaypoints(past[past.length - 1]);
      return past.slice(0, -1);
    });
    setPopupInfo(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        undoLastAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchGlobalData = async () => {
    const { data: routes } = await supabase
      .from("transit_routes")
      .select("*")
      .order("name");
    if (routes) setExistingRoutes(routes);

    const { data: backbones } = await supabase
      .from("route_backbones")
      .select(
        `id, direction, encoded_polyline, transit_routes (id, name, transit_mode)`,
      );
    if (backbones) setExistingBackbones(backbones);

    const { data: stops } = await supabase
      .from("transit_stops")
      .select("*")
      .order("name");
    if (stops) setGlobalStops(stops);
  };

  const fetchBackboneStops = async (bbId) => {
    if (!bbId) {
      setBackboneStops([]);
      return;
    }
    const { data } = await supabase
      .from("backbone_stops")
      .select(`stop_id, stop_sequence, transit_stops (name)`)
      .eq("backbone_id", bbId)
      .order("stop_sequence");

    if (data) {
      setBackboneStops(data);
      if (data.length > 0) {
        setSplitStopId(data[0].stop_id);
        setMergeStopId(data[data.length - 1].stop_id);
      }
    }
  };

  useEffect(() => {
    fetchBackboneStops(selectedBackboneId);
  }, [selectedBackboneId]);

  const handleDirectionChange = (newDir) => {
    setBackboneDirection(newDir);
    setSelectedBackboneEditId("");

    const routeBackbones = existingBackbones.filter(
      (bb) => bb.transit_routes?.id === routeSelect,
    );
    const outboundBb = routeBackbones.find((bb) => bb.direction === "OUTBOUND");
    const hasInbound = routeBackbones.some((bb) => bb.direction === "INBOUND");

    if (newDir === "INBOUND" && outboundBb && !hasInbound) {
      setCachedOutboundBb(outboundBb);
      setInboundDraftAvailable(true);
      dispatchWaypoints([]);
      setRoutePolyline(null);
      if (map.current?.getSource("route"))
        map.current.getSource("route").setData(EMPTY_LINE);
      setPopupInfo(null);
    } else {
      setInboundDraftAvailable(false);
      setCachedOutboundBb(null);
      clearAllMapData();
    }
  };

  const loadBackboneForEditing = async (bbId) => {
    if (!bbId) {
      clearAllMapData();
      return;
    }
    setStatus("Loading backbone data...");

    const bb = existingBackbones.find((b) => b.id === bbId);
    if (!bb) return;

    setRouteSelect(bb.transit_routes.id);
    setBackboneDirection(bb.direction);
    setRoutePolyline(bb.encoded_polyline);
    setInboundDraftAvailable(false);

    if (bb.encoded_polyline && map.current) {
      const decodedCoords = decodePolyline(bb.encoded_polyline);
      map.current.getSource("route")?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: decodedCoords },
      });
      if (decodedCoords.length > 0) {
        map.current.flyTo({ center: decodedCoords[0], zoom: 14 });
      }
    }

    const { data: stopsData, error } = await supabase
      .from("backbone_stops")
      .select(
        `
        stop_sequence, signboard_text, is_connector_node,
        transit_stops (id, name, aliases, latitude, longitude, stop_type)
      `,
      )
      .eq("backbone_id", bbId)
      .order("stop_sequence");

    if (error) {
      console.error("Error loading backbone stops:", error);
      setStatus("");
      return;
    }

    if (stopsData) {
      const loadedWaypoints = stopsData.map((item) => ({
        id: nextId.current++,
        dbId: item.transit_stops.id,
        originalDbId: item.transit_stops.id,
        lng: item.transit_stops.longitude,
        lat: item.transit_stops.latitude,
        type: item.is_connector_node ? "connector" : "stop",
        name: item.transit_stops.name || "",
        aliases: item.transit_stops.aliases || "",
        signboard: item.signboard_text || "",
        stopType: item.transit_stops.stop_type || "STREET_STOP",
        isDirty: false,
      }));

      setWaypoints(loadedWaypoints);
      setPastWaypoints([]);
    }

    setStatus("✅ Backbone loaded successfully!");
    setTimeout(() => setStatus(""), 3000);
  };

  const acceptReversedRoute = async () => {
    if (!cachedOutboundBb) return;
    setStatus("Loading reversed stop sequence...");

    setRoutePolyline(null);
    if (map.current) {
      map.current.getSource("route")?.setData(EMPTY_LINE);
    }

    const { data: stopsData } = await supabase
      .from("backbone_stops")
      .select(
        `
        stop_sequence, signboard_text, is_connector_node,
        transit_stops (id, name, aliases, latitude, longitude, stop_type)
      `,
      )
      .eq("backbone_id", cachedOutboundBb.id)
      .order("stop_sequence", { ascending: false });

    if (stopsData) {
      const reversedWaypoints = stopsData.map((item) => ({
        id: nextId.current++,
        dbId: item.transit_stops.id,
        originalDbId: item.transit_stops.id,
        lng: item.transit_stops.longitude,
        lat: item.transit_stops.latitude,
        type: item.is_connector_node ? "connector" : "stop",
        name: item.transit_stops.name || "",
        aliases: item.transit_stops.aliases || "",
        signboard: "",
        stopType: item.transit_stops.stop_type || "STREET_STOP",
        isDirty: false,
      }));

      setWaypoints(reversedWaypoints);
      setPastWaypoints([]);

      if (reversedWaypoints.length > 0 && map.current) {
        map.current.flyTo({
          center: [reversedWaypoints[0].lng, reversedWaypoints[0].lat],
          zoom: 14,
        });
      }
    }

    setInboundDraftAvailable(false);
    setStatus(
      "✨ Reversed stops loaded! Click 'Snap to Road' to generate a fresh polyline.",
    );
    setTimeout(() => setStatus(""), 5000);
  };

  useEffect(() => {
    if (map.current) return;
    fetchGlobalData();

    map.current = new Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
      center: [121.0, 14.425],
      zoom: 13,
      doubleClickZoom: false,
    });

    map.current.on("load", () => {
      map.current.addSource("route", { type: "geojson", data: EMPTY_LINE });
      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3b82f6", "line-width": 6 },
      });
    });

    map.current.on("click", (e) => {
      if (!routeSelectRef.current && mappingModeRef.current === "BACKBONE") {
        alert("Please select or create a Master Route first!");
        return;
      }
      const id = nextId.current++;
      const newPoint = {
        id,
        dbId: null,
        originalDbId: null,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        type: nodeTypeRef.current,
        name: "",
        aliases: "",
        signboard: "",
        stopType: "STREET_STOP",
        isDirty: false,
      };
      dispatchWaypoints((prev) => [...(prev || []), newPoint]);
      setPopupInfo({ id, lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const currentWaypoints = waypoints || [];
    const ids = new Set(currentWaypoints.map((w) => String(w.id)));
    Object.keys(markersRef.current).forEach((key) => {
      if (!ids.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    currentWaypoints.forEach((w, i) => {
      let marker = markersRef.current[String(w.id)];
      if (!marker) {
        const el = document.createElement("div");
        el.className = `flex items-center justify-center w-6 h-6 rounded-full border-2 border-white text-white font-bold text-xs cursor-pointer shadow-md select-none ${w.type === "stop" ? "bg-red-500" : "bg-gray-400"}`;

        marker = new Marker({ element: el, draggable: true })
          .setLngLat([w.lng, w.lat])
          .addTo(m);

        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();
          dispatchWaypoints((prev) =>
            (prev || []).map((p) =>
              p.id === w.id ? { ...p, lng, lat, isDirty: true } : p,
            ),
          );
          setPopupInfo((prev) =>
            prev && prev.id === w.id ? { ...prev, lng, lat } : prev,
          );
        });

        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setPopupInfo({ id: w.id, lng: w.lng, lat: w.lat });
          const listItem = document.getElementById(`waypoint-${w.id}`);
          if (listItem) {
            listItem.scrollIntoView({ behavior: "smooth", block: "center" });
            listItem.classList.add("bg-blue-100");
            setTimeout(() => listItem.classList.remove("bg-blue-100"), 1500);
          }
        });

        markersRef.current[String(w.id)] = marker;
      } else {
        marker.setLngLat([w.lng, w.lat]);
      }
      marker.getElement().textContent = i + 1;
    });
  }, [waypoints]);

  useEffect(() => {
    if (popupInfo && map.current && popupContainerRef.current) {
      if (!popupRef.current) {
        popupRef.current = new Popup({
          closeButton: false,
          closeOnClick: true,
          offset: 15,
          maxWidth: "300px",
        })
          .setDOMContent(popupContainerRef.current)
          .on("close", () => setPopupInfo(null));
      }
      popupRef.current
        .setLngLat([popupInfo.lng, popupInfo.lat])
        .addTo(map.current);
    } else if (!popupInfo && popupRef.current) {
      popupRef.current.remove();
    }
  }, [popupInfo]);

  const handleDragStart = (e, index) => {
    if (["INPUT", "SELECT"].includes(e.target.tagName)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", index);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;
    dispatchWaypoints((prev) => {
      const newWaypoints = [...(prev || [])];
      const [movedItem] = newWaypoints.splice(sourceIndex, 1);
      newWaypoints.splice(targetIndex, 0, movedItem);
      return newWaypoints;
    });
  };

  const updateWaypoint = (id, field, value) => {
    dispatchWaypoints((prev) =>
      (prev || []).map((w) =>
        w.id === id ? { ...w, [field]: value, isDirty: true } : w,
      ),
    );
  };

  const removeWaypoint = (id) => {
    dispatchWaypoints((prev) => (prev || []).filter((w) => w.id !== id));
    setPopupInfo((prev) => (prev && prev.id === id ? null : prev));
  };

  const saveStopAsNew = async (wId) => {
    const target = waypoints.find((w) => w.id === wId);
    if (!target) return;
    setStatus("Saving stop as a new entry...");

    const { data: newStop, error } = await supabase
      .from("transit_stops")
      .insert({
        name: target.name || "Unnamed Stop",
        aliases: target.aliases || "",
        latitude: parseFloat(target.lat.toFixed(6)),
        longitude: parseFloat(target.lng.toFixed(6)),
        stop_type: target.stopType,
      })
      .select()
      .single();

    if (error) {
      setStatus("");
      return alert("Error saving new stop: " + error.message);
    }

    dispatchWaypoints((prev) =>
      prev.map((w) =>
        w.id === wId
          ? { ...w, dbId: newStop.id, originalDbId: newStop.id, isDirty: false }
          : w,
      ),
    );
    setStatus("✅ Saved as a brand new stop!");
    await fetchGlobalData();
    setTimeout(() => setStatus(""), 3000);
  };

  const replaceStopWithExisting = (wId, dbStopId) => {
    if (!dbStopId) return;
    const targetDbStop = globalStops.find((s) => s.id === dbStopId);
    if (!targetDbStop) return;

    dispatchWaypoints((prev) =>
      prev.map((w) => {
        if (w.id === wId) {
          return {
            ...w,
            dbId: targetDbStop.id,
            originalDbId: targetDbStop.id,
            lng: targetDbStop.longitude,
            lat: targetDbStop.latitude,
            name: targetDbStop.name,
            aliases: targetDbStop.aliases || "",
            stopType: targetDbStop.stop_type || "STREET_STOP",
            isDirty: false,
          };
        }
        return w;
      }),
    );

    setReplacingStopId(null);
    map.current.flyTo({
      center: [targetDbStop.longitude, targetDbStop.latitude],
      zoom: 15,
    });
    setStatus("✅ Stop replaced with existing database stop!");
    setTimeout(() => setStatus(""), 3000);
  };

  const addExistingStop = (stopId) => {
    if (!stopId) return;
    const stop = globalStops.find((s) => s.id === stopId);
    if (stop) {
      const id = nextId.current++;
      dispatchWaypoints((prev) => [
        ...(prev || []),
        {
          id,
          dbId: stop.id,
          originalDbId: stop.id,
          lng: stop.longitude,
          lat: stop.latitude,
          type: "stop",
          name: stop.name,
          aliases: stop.aliases || "",
          signboard: "",
          stopType: stop.stop_type || "STREET_STOP",
          isDirty: false,
        },
      ]);
      map.current.flyTo({ center: [stop.longitude, stop.latitude], zoom: 15 });
    }
  };

  const generateRoute = async () => {
    const currentWaypoints = waypoints || [];
    if (currentWaypoints.length < 2) return alert("Drop at least 2 points.");

    let allCoordinates = [];
    const chunkSize = 25;
    setStatus("Snapping line to road network...");

    try {
      for (let i = 0; i < currentWaypoints.length - 1; i += chunkSize - 1) {
        const chunk = currentWaypoints.slice(i, i + chunkSize);
        if (chunk.length < 2) break;

        const coords = chunk.map((w) => `${w.lng},${w.lat}`).join(";");
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=polyline&overview=full&access_token=${MAPBOX_KEY}`;

        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== "Ok") throw new Error(data.message || data.code);

        const decoded = decodePolyline(data.routes[0].geometry);
        if (i > 0) decoded.shift();
        allCoordinates = allCoordinates.concat(decoded);
      }

      const finalEncoded = encodePolyline(allCoordinates);
      setRoutePolyline(finalEncoded);
      if (map.current?.getSource("route")) {
        map.current.getSource("route").setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: allCoordinates },
        });
      }
      setStatus("");
    } catch (e) {
      setStatus("");
      alert("Error generating route: " + e.message);
    }
  };

  const clearAllMapData = () => {
    dispatchWaypoints([]);
    setRoutePolyline(null);
    setSelectedBackboneEditId("");
    setInboundDraftAvailable(false);
    setCachedOutboundBb(null);
    if (map.current?.getSource("route"))
      map.current.getSource("route").setData(EMPTY_LINE);
    setPopupInfo(null);
  };

  const handleModeSwitch = (mode) => {
    setMappingMode(mode);
    clearAllMapData();
  };

  const deleteMasterRoute = async () => {
    if (!routeSelect || routeSelect === "NEW") return;
    if (
      !confirm(
        "Are you sure you want to delete this Master Route and ALL its backbones/variants?",
      )
    )
      return;

    setStatus("Deleting Master Route...");
    const { error } = await supabase
      .from("transit_routes")
      .delete()
      .eq("id", routeSelect);
    if (error) {
      setStatus("");
      return alert("Error deleting: " + error.message);
    }

    setRouteSelect("");
    clearAllMapData();
    setStatus("✅ Master route deleted.");
    await fetchGlobalData();
    setTimeout(() => setStatus(""), 3000);
  };

  const deleteSelectedBackbone = async () => {
    if (!selectedBackboneEditId) return;
    if (!confirm("Delete this Backbone and its stop mappings?")) return;

    setStatus("Deleting Backbone...");
    const { error } = await supabase
      .from("route_backbones")
      .delete()
      .eq("id", selectedBackboneEditId);
    if (error) {
      setStatus("");
      return alert("Error deleting: " + error.message);
    }

    setSelectedBackboneEditId("");
    clearAllMapData();
    setStatus("✅ Backbone deleted.");
    await fetchGlobalData();
    setTimeout(() => setStatus(""), 3000);
  };

  const saveToDatabase = async () => {
    if (!routePolyline)
      return alert(
        "Please click 'Snap to Road' first to generate the polyline.",
      );
    const currentWaypoints = waypoints || [];

    if (mappingMode === "BACKBONE") {
      if (!routeSelect)
        return alert("Please select or create a Master Route first.");
      setStatus("Saving Backbone & Polyline...");

      let routeId = routeSelect;
      if (routeId === "NEW") {
        if (!newRouteName) {
          setStatus("");
          return alert("Enter a name for the new route.");
        }
        const { data, error } = await supabase
          .from("transit_routes")
          .insert({ name: newRouteName, transit_mode: newRouteMode })
          .select()
          .single();
        if (error) {
          setStatus("");
          return alert("Route Error: " + error.message);
        }
        routeId = data.id;
        setRouteSelect(routeId);
      }

      let backboneObj;
      if (selectedBackboneEditId) {
        const { data, error } = await supabase
          .from("route_backbones")
          .update({
            direction: backboneDirection,
            encoded_polyline: routePolyline,
          })
          .eq("id", selectedBackboneEditId)
          .select()
          .single();
        if (error) {
          setStatus("");
          return alert("Backbone Update Error: " + error.message);
        }
        backboneObj = data;

        await supabase
          .from("backbone_stops")
          .delete()
          .eq("backbone_id", backboneObj.id);
      } else {
        const { data, error } = await supabase
          .from("route_backbones")
          .insert({
            route_id: routeId,
            direction: backboneDirection,
            encoded_polyline: routePolyline,
          })
          .select()
          .single();
        if (error) {
          setStatus("");
          return alert("Backbone Insert Error: " + error.message);
        }
        backboneObj = data;
      }

      let formalSeq = 0;
      for (const w of currentWaypoints) {
        if (w.type !== "stop") continue;
        formalSeq++;

        const stopPayload = {
          name: w.name || "Unnamed Stop",
          aliases: w.aliases || "",
          latitude: parseFloat(w.lat.toFixed(6)),
          longitude: parseFloat(w.lng.toFixed(6)),
          stop_type: w.stopType,
        };

        if (w.dbId) stopPayload.id = w.dbId;

        const { data: stopObj, error: stopErr } = await supabase
          .from("transit_stops")
          .upsert(stopPayload, { onConflict: "id" })
          .select()
          .single();

        if (stopErr) {
          console.error("Stop upsert error:", stopErr);
          continue;
        }

        if (stopObj) {
          await supabase.from("backbone_stops").insert({
            backbone_id: backboneObj.id,
            stop_id: stopObj.id,
            stop_sequence: formalSeq,
            signboard_text: w.signboard || null,
            is_connector_node: false,
          });
        }
      }
    } else if (mappingMode === "DETOUR") {
      if (
        !selectedBackboneId ||
        !splitStopId ||
        !mergeStopId ||
        !detourName ||
        !triggerSignboard
      ) {
        return alert("Please fill out all Detour fields.");
      }
      setStatus("Saving Detour & Polyline...");

      const { data: detourObj, error: detErr } = await supabase
        .from("route_detours")
        .insert({
          backbone_id: selectedBackboneId,
          name: detourName,
          split_stop_id: splitStopId,
          merge_stop_id: mergeStopId,
          trigger_signboard: triggerSignboard,
          encoded_polyline: routePolyline,
        })
        .select()
        .single();
      if (detErr) {
        setStatus("");
        return alert("Detour Error: " + detErr.message);
      }

      let formalSeq = 0;
      for (const w of currentWaypoints) {
        if (w.type !== "stop") continue;
        formalSeq++;
        const { data: stopObj } = await supabase
          .from("transit_stops")
          .upsert(
            {
              ...(w.dbId ? { id: w.dbId } : {}),
              name: w.name || "Unnamed Stop",
              aliases: w.aliases || "",
              latitude: parseFloat(w.lat.toFixed(6)),
              longitude: parseFloat(w.lng.toFixed(6)),
              stop_type: w.stopType,
            },
            { onConflict: "id" },
          )
          .select()
          .single();

        if (stopObj) {
          await supabase.from("detour_stops").insert({
            detour_id: detourObj.id,
            stop_id: stopObj.id,
            stop_sequence: formalSeq,
            signboard_text: w.signboard || null,
            is_connector_node: false,
          });
        }
      }
    }

    setStatus("✅ Successfully saved to Supabase!");
    await fetchGlobalData();
    setTimeout(() => setStatus(""), 5000);
  };

  const currentWaypoints = waypoints || [];
  const activePopupWaypoint = popupInfo
    ? currentWaypoints.find((w) => w.id === popupInfo.id)
    : null;
  const filteredBackbones =
    routeSelect && routeSelect !== "NEW"
      ? existingBackbones.filter((bb) => bb.transit_routes?.id === routeSelect)
      : [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      {/* REACT PORTAL: MAP POPUP */}
      {popupInfo &&
        activePopupWaypoint &&
        popupContainerRef.current &&
        createPortal(
          <div className="flex flex-col gap-2 w-52 text-gray-800 pb-1">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-1">
              <h4 className="font-bold text-sm m-0">Edit Stop Properties</h4>
              <button
                type="button"
                onClick={() => setPopupInfo(null)}
                className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 text-lg font-bold transition-colors"
                title="Close"
              >
                ×
              </button>
            </div>
            {activePopupWaypoint.type === "stop" ? (
              <>
                <input
                  className="w-full p-1.5 border border-gray-300 rounded text-xs outline-blue-500"
                  type="text"
                  placeholder="Stop Name"
                  value={activePopupWaypoint.name}
                  onChange={(e) =>
                    updateWaypoint(
                      activePopupWaypoint.id,
                      "name",
                      e.target.value,
                    )
                  }
                />
                <input
                  className="w-full p-1.5 border border-gray-300 rounded text-xs outline-blue-500"
                  type="text"
                  placeholder="Aliases (comma separated)"
                  value={activePopupWaypoint.aliases}
                  onChange={(e) =>
                    updateWaypoint(
                      activePopupWaypoint.id,
                      "aliases",
                      e.target.value,
                    )
                  }
                />
                <input
                  className="w-full p-1.5 border border-gray-300 rounded text-xs outline-blue-500"
                  type="text"
                  placeholder="Signboard Text"
                  value={activePopupWaypoint.signboard}
                  onChange={(e) =>
                    updateWaypoint(
                      activePopupWaypoint.id,
                      "signboard",
                      e.target.value,
                    )
                  }
                />
                <select
                  className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white outline-blue-500"
                  value={activePopupWaypoint.stopType}
                  onChange={(e) =>
                    updateWaypoint(
                      activePopupWaypoint.id,
                      "stopType",
                      e.target.value,
                    )
                  }
                >
                  <option value="STREET_STOP">Street Stop</option>
                  <option value="TERMINAL">Terminal / Hub</option>
                </select>
                {activePopupWaypoint.isDirty && activePopupWaypoint.dbId && (
                  <button
                    type="button"
                    onClick={() => saveStopAsNew(activePopupWaypoint.id)}
                    className="w-full p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded text-xs transition-colors"
                  >
                    💾 Save as New Stop
                  </button>
                )}
              </>
            ) : (
              <div className="text-xs text-gray-500 italic mb-1">
                Connector Node (Invisible)
              </div>
            )}
            <button
              type="button"
              onClick={() => removeWaypoint(activePopupWaypoint.id)}
              className="w-full p-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold border border-red-200 rounded text-xs transition-colors flex items-center justify-center gap-1"
            >
              <span className="text-[10px]">🗑</span> Delete Point
            </button>
          </div>,
          popupContainerRef.current,
        )}

      {/* LEFT PANEL */}
      <div className="w-[460px] h-full bg-white p-5 shadow-lg z-10 flex flex-col overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          TripCheq Admin Dashboard
        </h2>

        {/* MODE SWITCHER */}
        <div className="flex bg-gray-200 p-1 rounded-md mb-4 shadow-inner">
          <button
            className={`flex-1 p-2 rounded text-sm font-bold transition-all ${mappingMode === "BACKBONE" ? "bg-white text-blue-600 shadow" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => handleModeSwitch("BACKBONE")}
          >
            📍 1. Draw Backbone
          </button>
          <button
            className={`flex-1 p-2 rounded text-sm font-bold transition-all ${mappingMode === "DETOUR" ? "bg-white text-purple-600 shadow" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => handleModeSwitch("DETOUR")}
          >
            🔀 2. Add Detour
          </button>
        </div>

        {/* CONDITIONAL FORMS */}
        {mappingMode === "BACKBONE" ? (
          <div className="border-l-4 border-blue-500 bg-blue-50/30 p-3 rounded-r-md mb-4">
            <h3 className="mt-0 text-blue-800 font-bold mb-3 text-sm">
              Master Backbone Config
            </h3>

            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-bold text-blue-800 flex-1">
                Master Route (Prerequisite):
              </label>
              {routeSelect && routeSelect !== "NEW" && (
                <button
                  type="button"
                  onClick={deleteMasterRoute}
                  className="text-[11px] text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded font-semibold transition-colors"
                >
                  🗑️ Delete Route
                </button>
              )}
            </div>
            <select
              className="w-full p-2 mb-2 border border-blue-300 rounded text-sm bg-white font-semibold"
              value={routeSelect}
              onChange={(e) => {
                setRouteSelect(e.target.value);
                setSelectedBackboneEditId("");
                clearAllMapData();
              }}
            >
              <option value="">-- Select Master Route First --</option>
              <option value="NEW">-- ➕ Create New Master Route --</option>
              {existingRoutes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.transit_mode})
                </option>
              ))}
            </select>

            {routeSelect === "NEW" && (
              <div className="mt-1 mb-2 p-2 bg-white rounded border border-blue-100">
                <input
                  className="w-full p-2 mb-2 border border-gray-300 rounded text-sm"
                  type="text"
                  placeholder="Route Name (e.g., Alabang - Zapote)"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                />
                <select
                  className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                  value={newRouteMode}
                  onChange={(e) => setNewRouteMode(e.target.value)}
                >
                  <option value="JEEPNEY_TRADITIONAL">
                    Traditional Jeepney
                  </option>
                  <option value="JEEPNEY_MODERN">Modern Jeepney</option>
                  <option value="BUS">Bus</option>
                  <option value="UV_EXPRESS">UV Express</option>
                </select>
              </div>
            )}

            <div
              className={`mt-3 pt-3 border-t border-blue-200 transition-opacity ${!routeSelect || routeSelect === "NEW" ? "opacity-40 pointer-events-none" : "opacity-100"}`}
            >
              {inboundDraftAvailable && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-md shadow-sm">
                  <p className="text-xs font-bold text-amber-800 mb-2">
                    💡 Outbound exists, but Inbound is missing. Auto-generated
                    draft available!
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={acceptReversedRoute}
                      className="flex-1 p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition-colors"
                    >
                      ✨ Accept Reversed Route
                    </button>
                    <button
                      type="button"
                      onClick={() => setInboundDraftAvailable(false)}
                      className="flex-1 p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                    >
                      Draw Fresh
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700">
                  Load Existing Backbone to Edit:
                </label>
                {selectedBackboneEditId && (
                  <button
                    type="button"
                    onClick={deleteSelectedBackbone}
                    className="text-[11px] text-red-600 hover:bg-red-50 px-1 py-0.5 rounded font-semibold"
                  >
                    🗑️ Delete Direction
                  </button>
                )}
              </div>
              <select
                className="w-full p-2 mb-2 border border-gray-300 rounded text-sm bg-white"
                value={selectedBackboneEditId}
                onChange={(e) => {
                  setSelectedBackboneEditId(e.target.value);
                  loadBackboneForEditing(e.target.value);
                }}
              >
                <option value="">
                  -- ➕ Draw Fresh Backbone for this Route --
                </option>
                {filteredBackbones.map((bb) => (
                  <option key={`edit-bb-${bb.id}`} value={bb.id}>
                    {bb.direction} Backbone (
                    {bb.encoded_polyline ? "Has Polyline" : "No Polyline"})
                  </option>
                ))}
              </select>

              <label className="text-xs font-bold block mt-2 mb-1 text-gray-600">
                Direction:
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                value={backboneDirection}
                onChange={(e) => handleDirectionChange(e.target.value)}
              >
                <option value="OUTBOUND">Outbound (Forward)</option>
                <option value="INBOUND">Inbound (Vice Versa / Return)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="border-l-4 border-purple-500 bg-purple-50/30 p-3 rounded-r-md mb-4">
            <h3 className="mt-0 text-purple-800 font-bold mb-3 text-sm">
              Detour Envelope Config
            </h3>

            <label className="text-xs font-bold block mb-1 text-gray-600">
              Attach to Backbone:
            </label>
            <select
              className="w-full p-2 mb-3 border border-gray-300 rounded text-sm bg-white"
              value={selectedBackboneId}
              onChange={(e) => setSelectedBackboneId(e.target.value)}
            >
              <option value="">-- Select a Backbone --</option>
              {existingBackbones.map((bb) => (
                <option key={bb.id} value={bb.id}>
                  {bb.transit_routes?.name} ({bb.direction})
                </option>
              ))}
            </select>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="text-xs font-bold block mb-1 text-gray-600">
                  Split Node (Start):
                </label>
                <select
                  className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  value={splitStopId}
                  onChange={(e) => setSplitStopId(e.target.value)}
                >
                  {backboneStops.map((s) => (
                    <option key={`split-${s.stop_id}`} value={s.stop_id}>
                      {s.transit_stops.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold block mb-1 text-gray-600">
                  Merge Node (End):
                </label>
                <select
                  className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  value={mergeStopId}
                  onChange={(e) => setMergeStopId(e.target.value)}
                >
                  {backboneStops.map((s) => (
                    <option key={`merge-${s.stop_id}`} value={s.stop_id}>
                      {s.transit_stops.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="text-xs font-bold block mb-1 text-gray-600">
              Detour Name (Internal):
            </label>
            <input
              className="w-full p-2 mb-3 border border-gray-300 rounded text-sm"
              type="text"
              placeholder="e.g. Via Cabuyao Bayan"
              value={detourName}
              onChange={(e) => setDetourName(e.target.value)}
            />

            <label className="text-xs font-bold block mb-1 text-gray-600">
              Signboard Trigger:
            </label>
            <input
              className="w-full p-2 border border-gray-300 rounded text-sm"
              type="text"
              placeholder="e.g. CABUYAO BAYAN"
              value={triggerSignboard}
              onChange={(e) => setTriggerSignboard(e.target.value)}
            />
          </div>
        )}

        {/* DIGITIZER (EXPANDED UI) */}
        <div
          className={`border border-gray-200 p-3 rounded-md mb-4 bg-gray-50 flex-1 flex flex-col min-h-[350px] transition-opacity ${!routeSelect && mappingMode === "BACKBONE" ? "opacity-50 pointer-events-none" : "opacity-100"}`}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="mt-0 text-gray-800 font-bold text-sm">
              3. Map Digitizer & Stops
            </h3>
            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold">
              Ctrl+Z to Undo
            </span>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <select
              className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
            >
              <option value="stop">🛑 Click: New Stop</option>
              <option value="connector">🔗 Click: New Connector</option>
            </select>

            <select
              className="w-full p-2 border border-gray-300 rounded text-sm bg-emerald-50 text-emerald-700 font-semibold"
              onChange={(e) => {
                addExistingStop(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">➕ Add Existing DB Stop</option>
              {globalStops.map((s) => (
                <option key={`global-${s.id}`} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <ul className="list-none p-0 m-0 mb-3 border border-gray-200 rounded-md bg-white flex-1 overflow-y-auto shadow-inner min-h-[220px]">
            {currentWaypoints.length === 0 && (
              <li className="p-6 text-xs text-gray-400 italic text-center">
                {!routeSelect && mappingMode === "BACKBONE"
                  ? "Select a Master Route above to start digitizing."
                  : mappingMode === "BACKBONE"
                    ? "Click the map to draw the route, or add an existing stop from the dropdown above."
                    : "Click to draw ONLY the detour stops between Split and Merge."}
              </li>
            )}
            {currentWaypoints.map((w, i) => (
              <li
                id={`waypoint-${w.id}`}
                key={w.id}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, i)}
                className={`p-3 border-b border-gray-200 flex flex-col transition-colors duration-500 ${popupInfo?.id === w.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "border-l-4 border-l-transparent"}`}
              >
                <div className="flex items-center text-xs font-bold mb-2">
                  <span
                    className="cursor-grab text-gray-400 hover:text-gray-600 mr-2 text-lg leading-none"
                    title="Drag to reorder"
                  >
                    ⋮⋮
                  </span>
                  <span
                    className={`inline-block w-5 h-5 leading-5 text-center rounded-full text-white text-[10px] mr-2 ${w.type === "stop" ? "bg-red-500" : "bg-gray-400"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    {w.type === "stop" ? "Passenger Stop" : "Connector Node"}
                    {w.dbId ? (
                      w.isDirty ? (
                        <span
                          className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold"
                          title="Stop edited locally"
                        >
                          UNSAVED CHANGES
                        </span>
                      ) : (
                        <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded">
                          DB LINKED
                        </span>
                      )
                    ) : (
                      <span className="ml-2 text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                        NEW STOP
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded px-1.5 py-0.5 text-sm transition-colors"
                    onClick={() => removeWaypoint(w.id)}
                    title="Remove Stop"
                  >
                    🗑
                  </button>
                </div>
                {w.type === "stop" && (
                  <div className="flex flex-col gap-1.5 ml-12">
                    <input
                      className="w-full p-1.5 border border-gray-300 rounded text-xs outline-blue-500"
                      type="text"
                      placeholder="Stop Name (e.g. Zapote Market)"
                      value={w.name}
                      onChange={(e) =>
                        updateWaypoint(w.id, "name", e.target.value)
                      }
                    />
                    <input
                      className="w-full p-1.5 border border-gray-300 rounded text-xs outline-blue-500"
                      type="text"
                      placeholder="Aliases (comma separated)"
                      value={w.aliases}
                      onChange={(e) =>
                        updateWaypoint(w.id, "aliases", e.target.value)
                      }
                    />
                    <div className="flex gap-1.5">
                      <input
                        className="flex-1 p-1.5 border border-gray-300 rounded text-xs outline-blue-500"
                        type="text"
                        placeholder="Signboard Trigger"
                        value={w.signboard}
                        onChange={(e) =>
                          updateWaypoint(w.id, "signboard", e.target.value)
                        }
                      />
                      <select
                        className="flex-1 p-1.5 border border-gray-300 rounded text-xs bg-white outline-blue-500"
                        value={w.stopType}
                        onChange={(e) =>
                          updateWaypoint(w.id, "stopType", e.target.value)
                        }
                      >
                        <option value="STREET_STOP">Street Stop</option>
                        <option value="TERMINAL">Terminal / Hub</option>
                      </select>
                    </div>

                    {/* REPLACE WITH EXISTING DB STOP TOGGLE/DROPDOWN */}
                    {replacingStopId === w.id ? (
                      <div className="mt-1 p-2 bg-gray-100 rounded border border-gray-300 flex flex-col gap-1.5">
                        <select
                          className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                          onChange={(e) =>
                            replaceStopWithExisting(w.id, e.target.value)
                          }
                        >
                          <option value="">
                            -- Choose DB Stop to Replace With --
                          </option>
                          {globalStops.map((s) => (
                            <option key={`replace-${s.id}`} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setReplacingStopId(null)}
                          className="text-[10px] text-gray-500 hover:text-gray-700 underline text-center"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReplacingStopId(w.id)}
                        className="mt-1 text-left text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        🔄 Replace with Existing DB Stop
                      </button>
                    )}

                    {w.isDirty && w.dbId && (
                      <button
                        type="button"
                        onClick={() => saveStopAsNew(w.id)}
                        className="mt-1 p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded text-[11px] transition-colors"
                      >
                        💾 Save as New Stop Instead
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={generateRoute}
              className="flex-[2] p-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-bold text-sm transition-colors shadow-sm"
            >
              Snap to Road
            </button>
            <button
              type="button"
              onClick={undoLastAction}
              disabled={(pastWaypoints || []).length === 0}
              className="flex-1 p-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded font-bold text-sm transition-colors shadow-sm"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={clearAllMapData}
              className="flex-1 p-2 bg-red-500 hover:bg-red-600 text-white rounded font-bold text-sm transition-colors shadow-sm"
            >
              Clear
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={saveToDatabase}
          className="w-full p-4 mt-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-base transition-colors shadow-md"
        >
          ☁ SAVE {mappingMode} TO DATABASE
        </button>
        <div className="text-sm text-emerald-600 font-bold text-center mt-2 h-5">
          {status}
        </div>
      </div>

      {/* MAP */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
