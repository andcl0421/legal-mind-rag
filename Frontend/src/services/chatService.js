import { api } from "./api.js";

export function fetchSessions() {
  return api("/chat");
}

export function fetchSessionDetail(sessionId) {
  return api(`/chat/${sessionId}`);
}

export function fetchSessionMessages(sessionId) {
  return api(`/chat/${sessionId}/messages`);
}

export function sendChat(payload) {
  return api("/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
