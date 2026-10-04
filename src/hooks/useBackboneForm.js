import { useState } from "react";

// Form state for the "Draw Backbone" mode
export function useBackboneForm() {
  const [routeSelect, setRouteSelect] = useState("");
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteMode, setNewRouteMode] = useState("JEEPNEY_TRADITIONAL");
  const [direction, setDirection] = useState("OUTBOUND");
  const [selectedEditId, setSelectedEditId] = useState("");

  // Auto-generated inbound draft (reverse of an existing outbound)
  const [inboundDraftAvailable, setInboundDraftAvailable] = useState(false);
  const [cachedOutboundBb, setCachedOutboundBb] = useState(null);

  return {
    routeSelect,
    setRouteSelect,
    newRouteName,
    setNewRouteName,
    newRouteMode,
    setNewRouteMode,
    direction,
    setDirection,
    selectedEditId,
    setSelectedEditId,
    inboundDraftAvailable,
    setInboundDraftAvailable,
    cachedOutboundBb,
    setCachedOutboundBb,
  };
}
