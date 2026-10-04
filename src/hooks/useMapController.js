import { useCallback, useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  EMPTY_LINE,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
} from "../lib/constants";

export function useMapController({
  waypoints,
  popupInfo,
  popupContainer,
  darkMode,
  onMapClick,
  onMarkerDragEnd,
  onMarkerClick,
  onPopupClose,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const popupRef = useRef(null);
  const handlersRef = useRef({});
  const currentCoordsRef = useRef([]);

  // 1. Create a ref for darkMode so the persistent event listener inside
  // the map initialization block always has the absolute latest theme value.
  const darkModeRef = useRef(darkMode);
  useEffect(() => {
    darkModeRef.current = darkMode;
  }, [darkMode]);

  useEffect(() => {
    handlersRef.current = {
      onMapClick,
      onMarkerDragEnd,
      onMarkerClick,
      onPopupClose,
    };
  });

  const remove3DBuildings = (map) => {
    const style = map.getStyle();
    if (!style || !style.layers) return;
    style.layers.forEach((layer) => {
      if (layer.id.includes("building") || layer.type === "fill-extrusion") {
        if (map.getLayer(layer.id)) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }
    });
  };

  const ensureRouteLayer = (map, coordinates, isDark) => {
    const data =
      coordinates && coordinates.length > 0
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          }
        : EMPTY_LINE;

    const source = map.getSource("route");

    if (!source) {
      map.addSource("route", { type: "geojson", data });
    } else {
      source.setData(data);
    }

    if (!map.getLayer("route")) {
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": isDark ? "#22d3ee" : "#3b82f6",
          "line-width": isDark ? 7 : 6,
        },
      });
    } else {
      map.setPaintProperty(
        "route",
        "line-color",
        isDark ? "#22d3ee" : "#3b82f6",
      );
      map.setPaintProperty("route", "line-width", isDark ? 7 : 6);
    }
  };

  // --- create the map once ---
  useEffect(() => {
    if (mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: darkModeRef.current ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      doubleClickZoom: false,
    });
    mapRef.current = map;

    map.addControl(
      new NavigationControl({ visualizePitch: false }),
      "top-right",
    );

    map.on("error", (e) => console.error("MapLibre error:", e.error));

    map.on("styleimagemissing", (e) => {
      if (map.hasImage(e.id)) return;
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    // 2. The Bulletproof Fix: A permanent styledata listener.
    // This continuously monitors the map. Whenever the map finishes painting ANY style
    // changes (including a full setStyle wipe), it heals the map by re-adding the polyline.
    map.on("styledata", () => {
      if (map.isStyleLoaded()) {
        remove3DBuildings(map);
        ensureRouteLayer(map, currentCoordsRef.current, darkModeRef.current);
      }
    });

    map.on("click", (e) => handlersRef.current.onMapClick?.(e.lngLat));
  }, []);

  // --- dynamically switch map style when darkMode changes ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 3. We ONLY need to call setStyle here. The persistent "styledata" listener
    // established above will automatically detect this, wait for the style to load,
    // and correctly inject currentCoordsRef.current back onto the map.
    map.setStyle(darkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT);
  }, [darkMode]);

  // --- keep markers in sync with the waypoint list ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
        // Distinct styling for anchors to indicate they are locked
        const isAnchor = w.isAnchor;
        const el = document.createElement("div");
        el.className = `flex items-center justify-center w-6 h-6 rounded-full border-2 border-white text-white font-bold text-xs shadow-md select-none ${
          isAnchor
            ? "bg-violet-600 opacity-80"
            : w.type === "stop"
              ? "bg-red-500 cursor-pointer"
              : "bg-gray-400 cursor-pointer"
        }`;

        // Only make draggable if it's NOT an anchor
        marker = new Marker({ element: el, draggable: !isAnchor })
          .setLngLat([w.lng, w.lat])
          .addTo(map);

        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();
          handlersRef.current.onMarkerDragEnd?.(w.id, lng, lat);
        });

        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const { lng, lat } = marker.getLngLat();
          handlersRef.current.onMarkerClick?.(w.id, lng, lat);
        });

        markersRef.current[String(w.id)] = marker;
      } else {
        marker.setLngLat([w.lng, w.lat]);
      }
      marker.getElement().textContent = i + 1;
    });
  }, [waypoints]);

  // --- show/hide the edit popup ---
  useEffect(() => {
    const map = mapRef.current;
    if (popupInfo && map && popupContainer) {
      if (!popupRef.current) {
        popupRef.current = new Popup({
          closeButton: false,
          closeOnClick: true,
          offset: 15,
          maxWidth: "300px",
        })
          .setDOMContent(popupContainer)
          .on("close", () => handlersRef.current.onPopupClose?.());
      }
      popupRef.current.setLngLat([popupInfo.lng, popupInfo.lat]).addTo(map);
    } else if (!popupInfo && popupRef.current) {
      popupRef.current.remove();
    }
  }, [popupInfo, popupContainer]);

  const setRouteLine = useCallback((coordinates) => {
    currentCoordsRef.current = coordinates || [];
    const map = mapRef.current;
    if (!map) return;
    ensureRouteLayer(map, currentCoordsRef.current, darkModeRef.current);
  }, []);

  const flyTo = useCallback((center, zoom) => {
    mapRef.current?.flyTo({ center, zoom });
  }, []);

  const fitBounds = useCallback((coordinates) => {
    const map = mapRef.current;
    if (!map || !coordinates || coordinates.length === 0) return;
    const bounds = coordinates.reduce(
      (b, coord) => [
        Math.min(b[0], coord[0]),
        Math.min(b[1], coord[1]),
        Math.max(b[2], coord[0]),
        Math.max(b[3], coord[1]),
      ],
      [Infinity, Infinity, -Infinity, -Infinity],
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 1000 });
  }, []);

  return { containerRef, setRouteLine, flyTo, fitBounds };
}
