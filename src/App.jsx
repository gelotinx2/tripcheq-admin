import { useEffect, useRef, useState } from "react";
import { Map, Marker } from "maplibre-gl";
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

// Decode a Mapbox polyline (precision 5) into [lng, lat] pairs
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

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef({});
  const nextId = useRef(1);
  const nodeTypeRef = useRef("stop");
  const waypointsRef = useRef([]);

  const [existingRoutes, setExistingRoutes] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [nodeType, setNodeType] = useState("stop");
  const [routePolyline, setRoutePolyline] = useState(null);
  const [status, setStatus] = useState("");

  // Form State
  const [routeSelect, setRouteSelect] = useState("NEW");
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteMode, setNewRouteMode] = useState("JEEPNEY_TRADITIONAL");
  const [variantDirection, setVariantDirection] = useState("OUTBOUND");
  const [variantName, setVariantName] = useState("");

  // Keep refs in sync so the one-time map click handler sees current values
  useEffect(() => {
    nodeTypeRef.current = nodeType;
  }, [nodeType]);
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

  const setRouteLine = (coordinates) => {
    const src = map.current && map.current.getSource("route");
    if (src) {
      src.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      });
    }
  };

  const fetchRoutes = async () => {
    const { data, error } = await supabase
      .from("transit_routes")
      .select("*")
      .order("name");
    if (error) {
      console.error("Error loading routes", error);
      return;
    }
    if (data) setExistingRoutes(data);
  };

  // --- INITIALIZE MAP (once) ---
  useEffect(() => {
    if (map.current) return;

    fetchRoutes();

    map.current = new Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
      center: [121.0, 14.425],
      zoom: 13,
      doubleClickZoom: false,
    });

    map.current.on("error", (e) => {
      console.error("MapLibre error:", e.error);
      setStatus("Map error: " + (e.error?.message || "see console"));
    });

    map.current.on("styleimagemissing", (e) => {
      if (map.current.hasImage(e.id)) return;
      map.current.addImage(e.id, {
        width: 1,
        height: 1,
        data: new Uint8Array(4),
      });
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
      if (waypointsRef.current.length >= 25) {
        alert("Mapbox limit: 25 max points per request.");
        return;
      }
      const id = nextId.current++;
      setWaypoints((prev) => [
        ...prev,
        {
          id,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          type: nodeTypeRef.current,
          name: "",
          signboard: "",
          stopType: "STREET_STOP",
        },
      ]);
    });
  }, []);

  // --- SYNC MARKERS WITH WAYPOINT STATE ---
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const ids = new Set(waypoints.map((w) => String(w.id)));
    Object.keys(markersRef.current).forEach((key) => {
      if (!ids.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    waypoints.forEach((w, i) => {
      let marker = markersRef.current[String(w.id)];
      if (!marker) {
        const el = document.createElement("div");
        el.className = `flex items-center justify-center w-6 h-6 rounded-full border-2 border-white text-white font-bold text-xs cursor-pointer shadow-md select-none ${
          w.type === "stop" ? "bg-red-500" : "bg-gray-400"
        }`;
        marker = new Marker({ element: el, draggable: true })
          .setLngLat([w.lng, w.lat])
          .addTo(m);

        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();
          setWaypoints((prev) =>
            prev.map((p) => (p.id === w.id ? { ...p, lng, lat } : p)),
          );
        });
        el.addEventListener("dblclick", (ev) => {
          ev.stopPropagation();
          setWaypoints((prev) => prev.filter((p) => p.id !== w.id));
        });

        markersRef.current[String(w.id)] = marker;
      }
      marker.getElement().textContent = i + 1;
    });
  }, [waypoints]);

  // --- CLEAR SNAPPED LINE WHEN GEOMETRY CHANGES (add/remove/move) ---
  const geometryKey = waypoints
    .map((w) => `${w.id}:${w.lng}:${w.lat}`)
    .join("|");
  useEffect(() => {
    setRoutePolyline(null);
    setRouteLine([]);
  }, [geometryKey]);

  const updateWaypoint = (id, field, value) => {
    setWaypoints((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
    );
  };

  const removeWaypoint = (id) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  };

  // --- SNAP TO ROAD ---
  const generateRoute = async () => {
    if (waypoints.length < 2) return alert("Drop at least 2 points.");
    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=polyline&overview=full&access_token=${MAPBOX_KEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== "Ok") throw new Error(data.message || data.code);
      const encoded = data.routes[0].geometry;
      setRoutePolyline(encoded);
      setRouteLine(decodePolyline(encoded));
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const clearAll = () => {
    setWaypoints([]);
    setVariantName("");
    setRoutePolyline(null);
    setRouteLine([]);
  };

  // --- SAVE TO SUPABASE ---
  const saveToDatabase = async () => {
    if (!routePolyline) return alert("Please click 'Snap to Road' first.");
    if (!variantName) return alert("Please fill out Variant Name.");

    setStatus("Saving Master Route...");

    // 1. Get or create master route
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
      await fetchRoutes();
      setRouteSelect(routeId);
    }

    setStatus("Saving Variant & Polyline...");

    // 2. Insert variant
    const { data: variantObj, error: varErr } = await supabase
      .from("route_variants")
      .insert({
        route_id: routeId,
        direction: variantDirection,
        name: variantName,
        encoded_polyline: routePolyline,
      })
      .select()
      .single();
    if (varErr) {
      setStatus("");
      return alert("Variant Error: " + varErr.message);
    }

    setStatus("Saving Passenger Stops...");

    // 3. Upsert stops and link them to the variant
    let formalSeq = 0;
    for (const w of waypoints) {
      if (w.type !== "stop") continue;
      formalSeq++;

      const { data: stopObj, error: stopErr } = await supabase
        .from("transit_stops")
        .upsert(
          {
            name: w.name || "Unnamed Stop",
            latitude: parseFloat(w.lat.toFixed(6)),
            longitude: parseFloat(w.lng.toFixed(6)),
            stop_type: w.stopType,
          },
          { onConflict: "latitude, longitude" },
        )
        .select()
        .single();

      if (stopErr) {
        console.error("Stop Error:", stopErr);
        continue;
      }

      const { error: linkErr } = await supabase.from("route_stops").insert({
        variant_id: variantObj.id,
        stop_id: stopObj.id,
        stop_sequence: formalSeq,
        signboard_text: w.signboard || null,
        is_connector_node: false,
      });
      if (linkErr) console.error("Route stop link error:", linkErr);
    }

    setStatus("✅ Successfully saved to Supabase!");
    setTimeout(() => setStatus(""), 5000);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      <div className="w-[420px] h-full bg-white p-5 shadow-lg z-10 flex flex-col overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Pasada Admin Dashboard
        </h2>

        <div className="border border-gray-200 p-3 rounded-md mb-4 bg-gray-50">
          <h3 className="mt-0 text-gray-800 font-bold mb-3 text-sm">
            1. Master Route
          </h3>
          <select
            className="w-full p-2 mb-2 border border-gray-300 rounded text-sm bg-white"
            value={routeSelect}
            onChange={(e) => setRouteSelect(e.target.value)}
          >
            <option value="NEW">-- ➕ Create New Master Route --</option>
            {existingRoutes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.transit_mode})
              </option>
            ))}
          </select>
          {routeSelect === "NEW" && (
            <div className="mt-2">
              <input
                className="w-full p-2 mb-2 border border-gray-300 rounded text-sm"
                type="text"
                placeholder="e.g., Alabang - Zapote"
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
              />
              <select
                className="w-full p-2 mb-2 border border-gray-300 rounded text-sm bg-white"
                value={newRouteMode}
                onChange={(e) => setNewRouteMode(e.target.value)}
              >
                <option value="JEEPNEY_TRADITIONAL">Traditional Jeepney</option>
                <option value="JEEPNEY_MODERN">Modern Jeepney</option>
                <option value="BUS">Bus</option>
                <option value="UV_EXPRESS">UV Express</option>
              </select>
            </div>
          )}
        </div>

        <div className="border border-gray-200 p-3 rounded-md mb-4 bg-gray-50">
          <h3 className="mt-0 text-gray-800 font-bold mb-3 text-sm">
            2. Variant
          </h3>
          <select
            className="w-full p-2 mb-2 border border-gray-300 rounded text-sm bg-white"
            value={variantDirection}
            onChange={(e) => setVariantDirection(e.target.value)}
          >
            <option value="OUTBOUND">Outbound (Forward)</option>
            <option value="INBOUND">Inbound (Vice Versa / Return)</option>
          </select>
          <input
            className="w-full p-2 mb-2 border border-gray-300 rounded text-sm"
            type="text"
            placeholder="e.g., Derecho, Via Palengke"
            value={variantName}
            onChange={(e) => setVariantName(e.target.value)}
          />
        </div>

        <div className="border border-gray-200 p-3 rounded-md mb-4 bg-gray-50">
          <h3 className="mt-0 text-gray-800 font-bold mb-3 text-sm">
            3. Map Digitizer
          </h3>
          <select
            className="w-full p-2 mb-4 border border-gray-300 rounded text-sm bg-white"
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value)}
          >
            <option value="stop">🛑 Passenger Stop</option>
            <option value="connector">🔗 Connector Node</option>
          </select>

          <ul className="list-none p-0 m-0 mb-4 border border-gray-200 rounded-md bg-white max-h-64 overflow-y-auto">
            {waypoints.length === 0 && (
              <li className="p-2 text-xs text-gray-500">
                Click the map to drop points. Double-click a marker to remove
                it.
              </li>
            )}
            {waypoints.map((w, i) => (
              <li
                key={w.id}
                className="p-2 border-b border-gray-200 flex flex-col"
              >
                <div className="flex items-center text-xs font-bold mb-1">
                  <span
                    className={`inline-block w-5 h-5 leading-5 text-center rounded-full text-white text-[10px] mr-1.5 ${
                      w.type === "stop" ? "bg-red-500" : "bg-gray-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    {w.type === "stop" ? "Passenger Stop" : "Connector Node"}
                  </span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500 text-sm px-1"
                    onClick={() => removeWaypoint(w.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
                {w.type === "stop" && (
                  <>
                    <input
                      className="w-full p-1.5 mb-1 border border-gray-300 rounded text-xs"
                      type="text"
                      placeholder="Stop Name (e.g. Zapote Market)"
                      value={w.name}
                      onChange={(e) =>
                        updateWaypoint(w.id, "name", e.target.value)
                      }
                    />
                    <input
                      className="w-full p-1.5 mb-1 border border-gray-300 rounded text-xs"
                      type="text"
                      placeholder="Signboard Text (e.g. ZAPOTE KABILA)"
                      value={w.signboard}
                      onChange={(e) =>
                        updateWaypoint(w.id, "signboard", e.target.value)
                      }
                    />
                    <select
                      className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                      value={w.stopType}
                      onChange={(e) =>
                        updateWaypoint(w.id, "stopType", e.target.value)
                      }
                    >
                      <option value="STREET_STOP">Street Stop</option>
                      <option value="TERMINAL">Terminal / Hub</option>
                    </select>
                  </>
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={generateRoute}
            className="w-full p-2.5 mb-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-bold transition-colors"
          >
            Snap to Road
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="w-full p-2.5 mb-2 bg-red-500 hover:bg-red-600 text-white rounded font-bold transition-colors"
          >
            Clear Map
          </button>
        </div>

        <button
          type="button"
          onClick={saveToDatabase}
          className="w-full p-4 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-base transition-colors shadow-md"
        >
          ☁️ SAVE TO DATABASE
        </button>
        <div className="text-sm text-emerald-600 font-bold text-center mt-2">
          {status}
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
