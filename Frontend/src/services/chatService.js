import { api, getApiBase } from "./api.js";
import { store } from "../store.js";

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
  }, true);
}

export function deleteSession(sessionId) {
  return api(`/chat/${sessionId}`, {
    method: "DELETE",
  }, true);
}

export async function downloadSessionReport(sessionId) {
  if (!store.token) {
    throw new Error("리포트 다운로드에는 로그인 상태가 필요합니다.");
  }

  const url = `${getApiBase()}/chat/${sessionId}/report.pdf`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${store.token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `nomutalktalk-report-${sessionId.slice(0, 8)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
