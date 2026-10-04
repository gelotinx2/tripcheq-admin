export const MAPBOX_KEY = import.meta.env.VITE_MAPBOX_KEY;
export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

export const MAP_STYLE_LIGHT = `https://api.maptiler.com/maps/streets-v2/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`;
export const MAP_STYLE_DARK = `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`;
export const DEFAULT_CENTER = [121.0, 14.425];
export const DEFAULT_ZOOM = 13;

export const EMPTY_LINE = {
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: [] },
};

export const TRANSIT_MODES = [
  { value: "JEEPNEY_TRADITIONAL", label: "Traditional Jeepney" },
  { value: "JEEPNEY_MODERN", label: "Modern Jeepney" },
  { value: "BUS", label: "Bus" },
  { value: "UV_EXPRESS", label: "UV Express" },
];

export const STOP_TYPES = [
  { value: "STREET_STOP", label: "Street Stop" },
  { value: "TERMINAL", label: "Terminal / Hub" },
];
