// A point freshly dropped on the map
export function blankWaypoint(id, lng, lat, type) {
  return {
    id,
    dbId: null,
    originalDbId: null,
    lng,
    lat,
    type,
    name: "",
    aliases: "",
    signboard: "",
    stopType: "STREET_STOP",
    isDirty: false,
  };
}

// A row from backbone_stops (joined with transit_stops) -> waypoint
export function stopRowToWaypoint(row, id, { keepSignboard = true } = {}) {
  const s = row.transit_stops;
  return {
    id,
    dbId: s.id,
    originalDbId: s.id,
    lng: s.longitude,
    lat: s.latitude,
    type: row.is_connector_node ? "connector" : "stop",
    name: s.name || "",
    aliases: s.aliases || "",
    signboard: keepSignboard ? row.signboard_text || "" : "",
    stopType: s.stop_type || "STREET_STOP",
    isDirty: false,
  };
}

// A row from transit_stops -> waypoint
export function globalStopToWaypoint(stop, id) {
  return {
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
  };
}
