import { api } from "./api.js";

export function fetchAlerts(unreadOnly = false, source = "") {
  const params = new URLSearchParams();
  params.set("unread_only", unreadOnly ? "true" : "false");
  if (source) params.set("source", source);
  return api(`/alerts?${params.toString()}`, {}, true);
}

export function createAlert(payload) {
  return api(
    "/alerts",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true
  );
}

export function markAlertRead(alertId) {
  return api(`/alerts/${alertId}/read`, { method: "PATCH" }, true);
}
