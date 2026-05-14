import { api } from "./api.js";

export function fetchChecklistItems(chatSessionId) {
  const params = new URLSearchParams();
  params.set("chat_session_id", chatSessionId);
  return api(`/checklist?${params.toString()}`, {}, true);
}

export function saveChecklistItem(payload) {
  return api(
    "/checklist",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}
