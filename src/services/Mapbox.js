import { MAPBOX_KEY } from "../lib/constants";
import { decodePolyline } from "../lib/Polyline";

const CHUNK_SIZE = 25; // Mapbox Directions limit per request

// Snap waypoints to the road network. Returns [lng, lat] pairs.
export async function snapToRoad(waypoints) {
  let allCoordinates = [];

  for (let i = 0; i < waypoints.length - 1; i += CHUNK_SIZE - 1) {
    const chunk = waypoints.slice(i, i + CHUNK_SIZE);
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

  return allCoordinates;
}
