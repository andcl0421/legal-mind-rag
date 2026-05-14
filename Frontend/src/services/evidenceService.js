import { getApiBase } from "./api.js";
import { store } from "../store.js";

function authHeaders() {
  if (!store.token) {
    throw new Error("증거 보관함 기능은 로그인 후 사용할 수 있어요.");
  }
  return { Authorization: `Bearer ${store.token}` };
}

export async function fetchEvidenceFiles() {
  const response = await fetch(`${getApiBase()}/evidence`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchEvidenceFilesByFilter({ category = "", chatSessionId = "" } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (chatSessionId) params.set("chat_session_id", chatSessionId);
  const query = params.toString();
  const response = await fetch(`${getApiBase()}/evidence${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function uploadEvidenceFile(file, description = "", category = "", chatSessionId = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (description.trim()) formData.append("description", description.trim());
  if (category.trim()) formData.append("category", category.trim());
  if (chatSessionId.trim()) formData.append("chat_session_id", chatSessionId.trim());

  const response = await fetch(`${getApiBase()}/evidence`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function deleteEvidenceFile(fileId) {
  const response = await fetch(`${getApiBase()}/evidence/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
}

export async function downloadEvidenceFile(fileId, filename) {
  const response = await fetch(`${getApiBase()}/evidence/${fileId}/download`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename || `evidence-${fileId}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function getEvidenceDownloadUrl(fileId) {
  return `${getApiBase()}/evidence/${fileId}/download`;
}
