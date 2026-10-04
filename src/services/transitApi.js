import { supabase } from "../lib/Supabase";

const STOP_ROW_SELECT = `
  stop_sequence, signboard_text, is_connector_node,
  transit_stops (id, name, aliases, latitude, longitude, stop_type)
`;

// ---------- READS ----------

export async function fetchAllTransitData() {
  const [routes, backbones, stops] = await Promise.all([
    supabase.from("transit_routes").select("*").order("name"),
    supabase
      .from("route_backbones")
      .select(
        `id, direction, encoded_polyline, transit_routes (id, name, transit_mode)`,
      ),
    supabase.from("transit_stops").select("*").order("name"),
  ]);
  return {
    routes: routes.data,
    backbones: backbones.data,
    stops: stops.data,
  };
}

// Light version used by the detour split/merge dropdowns
export async function fetchBackboneStopSummaries(backboneId) {
  const { data } = await supabase
    .from("backbone_stops")
    .select(`stop_id, stop_sequence, transit_stops (name)`)
    .eq("backbone_id", backboneId)
    .order("stop_sequence");
  return data;
}

// Full rows used to rebuild waypoints. Returns { data, error }.
export function fetchBackboneStopRows(backboneId, { ascending = true } = {}) {
  return supabase
    .from("backbone_stops")
    .select(STOP_ROW_SELECT)
    .eq("backbone_id", backboneId)
    .order("stop_sequence", { ascending });
}

// ---------- SINGLE-STOP WRITES ----------

// Returns { data, error }
export function insertStop(w) {
  return supabase
    .from("transit_stops")
    .insert({
      name: w.name || "Unnamed Stop",
      aliases: w.aliases || "",
      latitude: parseFloat(w.lat.toFixed(6)),
      longitude: parseFloat(w.lng.toFixed(6)),
      stop_type: w.stopType,
    })
    .select()
    .single();
}

// Updates an existing stop record by its ID
export async function updateTransitStop(stopId, fields) {
  const { error } = await supabase
    .from("transit_stops")
    .update({
      name: fields.name || "Unnamed Stop",
      aliases: fields.aliases || "",
      latitude: parseFloat(fields.latitude.toFixed(6)),
      longitude: parseFloat(fields.longitude.toFixed(6)),
      stop_type: fields.stop_type,
    })
    .eq("id", stopId);
  return error;
}

async function upsertStop(w) {
  const payload = {
    ...(w.dbId ? { id: w.dbId } : {}),
    name: w.name || "Unnamed Stop",
    aliases: w.aliases || "",
    latitude: parseFloat(w.lat.toFixed(6)),
    longitude: parseFloat(w.lng.toFixed(6)),
    stop_type: w.stopType,
  };
  const { data, error } = await supabase
    .from("transit_stops")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("Stop upsert error:", error);
    return null;
  }
  return data;
}

// Upsert each passenger stop and link it to a backbone/detour in order
async function linkStops(table, parentColumn, parentId, waypoints) {
  let seq = 0;
  for (const w of waypoints) {
    if (w.type !== "stop") continue;
    seq++;
    const stop = await upsertStop(w);
    if (!stop) continue;
    await supabase.from(table).insert({
      [parentColumn]: parentId,
      stop_id: stop.id,
      stop_sequence: seq,
      signboard_text: w.signboard || null,
      is_connector_node: false,
    });
  }
}

// ---------- DELETES ----------

export async function deleteRoute(id) {
  const { error } = await supabase.from("transit_routes").delete().eq("id", id);
  return error;
}

export async function deleteBackbone(id) {
  const { error } = await supabase
    .from("route_backbones")
    .delete()
    .eq("id", id);
  return error;
}

// ---------- SAVES (throw Error with a readable message) ----------

export async function saveBackbone({
  routeSelect,
  newRouteName,
  newRouteMode,
  direction,
  polyline,
  editId,
  waypoints,
}) {
  let routeId = routeSelect;
  if (routeId === "NEW") {
    const { data, error } = await supabase
      .from("transit_routes")
      .insert({ name: newRouteName, transit_mode: newRouteMode })
      .select()
      .single();
    if (error) throw new Error("Route Error: " + error.message);
    routeId = data.id;
  }

  let backbone;
  if (editId) {
    const { data, error } = await supabase
      .from("route_backbones")
      .update({ direction, encoded_polyline: polyline })
      .eq("id", editId)
      .select()
      .single();
    if (error) throw new Error("Backbone Update Error: " + error.message);
    backbone = data;
    await supabase
      .from("backbone_stops")
      .delete()
      .eq("backbone_id", backbone.id);
  } else {
    const { data, error } = await supabase
      .from("route_backbones")
      .insert({ route_id: routeId, direction, encoded_polyline: polyline })
      .select()
      .single();
    if (error) throw new Error("Backbone Insert Error: " + error.message);
    backbone = data;
  }

  await linkStops("backbone_stops", "backbone_id", backbone.id, waypoints);
  return { routeId };
}

export async function saveDetour({
  backboneId,
  name,
  splitStopId,
  mergeStopId,
  triggerSignboard,
  polyline,
  waypoints,
}) {
  const { data, error } = await supabase
    .from("route_detours")
    .insert({
      backbone_id: backboneId,
      name,
      split_stop_id: splitStopId,
      merge_stop_id: mergeStopId,
      trigger_signboard: triggerSignboard,
      encoded_polyline: polyline,
    })
    .select()
    .single();
  if (error) throw new Error("Detour Error: " + error.message);

  await linkStops("detour_stops", "detour_id", data.id, waypoints);
}
