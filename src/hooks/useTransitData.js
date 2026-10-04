import { useCallback, useEffect, useState } from "react";
import { fetchAllTransitData } from "../services/transitApi";

// Routes, backbones and the global stop dictionary from Supabase
export function useTransitData() {
  const [routes, setRoutes] = useState([]);
  const [backbones, setBackbones] = useState([]);
  const [stops, setStops] = useState([]);

  const refresh = useCallback(async () => {
    const data = await fetchAllTransitData();
    if (data.routes) setRoutes(data.routes);
    if (data.backbones) setBackbones(data.backbones);
    if (data.stops) setStops(data.stops);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { routes, backbones, stops, refresh };
}
