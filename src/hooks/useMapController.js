import { useCallback, useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  EMPTY_LINE,
  MAP_STYLE_URL,
} from "../lib/constants";

// Owns the MapLibre instance, the numbered markers and the edit popup.
// It reports user actions through callbacks and holds no app state itself.
export function useMapController({
  waypoints,
  popupInfo,
  popupContainer,
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

  // Always point at the latest callbacks without re-registering map events
  useEffect(() => {
    handlersRef.current = {
      onMapClick,
      onMarkerDragEnd,
      onMarkerClick,
      onPopupClose,
    };
  });

  // --- create the map once ---
  useEffect(() => {
    if (mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      doubleClickZoom: false,
    });
    mapRef.current = map;

    map.on("error", (e) => console.error("MapLibre error:", e.error));

    // MapTiler's style references an icon that isn't in its sprite;
    // register a transparent 1x1 image so MapLibre stops warning about it.
    map.on("styleimagemissing", (e) => {
      if (map.hasImage(e.id)) return;
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: EMPTY_LINE });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3b82f6", "line-width": 6 },
      });
    });

    map.on("click", (e) => handlersRef.current.onMapClick?.(e.lngLat));
  }, []);

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
        const el = document.createElement("div");
        el.className = `flex items-center justify-center w-6 h-6 rounded-full border-2 border-white text-white font-bold text-xs cursor-pointer shadow-md select-none ${
          w.type === "stop" ? "bg-red-500" : "bg-gray-400"
        }`;

        marker = new Marker({ element: el, draggable: true })
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

  // Draw a line, or clear it when given null/empty coordinates
  const setRouteLine = useCallback((coordinates) => {
    const source = mapRef.current?.getSource("route");
    if (!source) return;
    source.setData(
      coordinates && coordinates.length
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          }
        : EMPTY_LINE,
    );
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
