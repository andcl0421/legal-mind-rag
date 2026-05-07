import { clearAuth, setLastError, store } from "../store.js";

const API_BASE_KEY = "lm_api_base";
const DEFAULT_API_BASE = "http://127.0.0.1:8000/api/v1";
const CANDIDATE_API_BASES = [
  "http://127.0.0.1:8000/api/v1",
  "http://localhost:8000/api/v1",
  "http://127.0.0.1:8001/api/v1",
  "http://localhost:8001/api/v1",
  "http://127.0.0.1:8010/api/v1",
  "http://localhost:8010/api/v1",
];

function normalizeApiBase(raw) {
  const value = String(raw || "").trim();
  if (!value) return DEFAULT_API_BASE;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getApiBase() {
  return normalizeApiBase(localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE);
}

export function setApiBase(value) {
  localStorage.setItem(API_BASE_KEY, normalizeApiBase(value));
}

export async function checkApiBase(base) {
  const apiBase = normalizeApiBase(base);
  const res = await fetch(`${apiBase}/auth/health`);
  if (!res.ok) {
    throw new Error(`헬스체크 실패: ${apiBase}/auth/health (HTTP ${res.status})`);
  }
  return apiBase;
}

export async function resolveWorkingApiBase(preferredBase = "") {
  const normalizedPreferred = normalizeApiBase(preferredBase);
  const deduped = [...new Set([normalizedPreferred, getApiBase(), ...CANDIDATE_API_BASES].filter(Boolean))];
  for (const candidate of deduped) {
    try {
      const ok = await checkApiBase(candidate);
      setApiBase(ok);
      return ok;
    } catch {
      continue;
    }
  }
  throw new Error("동작 중인 백엔드 API 주소를 찾지 못했습니다. 백엔드 실행 포트(8000/8001/8010)를 확인해주세요.");
}

export async function api(path, options = {}, useAuth = false) {
  try {
    const apiBase = getApiBase();
    const url = `${apiBase}${path}`;
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (useAuth && store.token) headers.Authorization = `Bearer ${store.token}`;

    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`API 경로를 찾지 못했습니다: ${url}`);
      }
      const detail = data?.detail || data?.message || data?.raw || `HTTP ${res.status}`;
      if (res.status === 401 && useAuth) {
        clearAuth();
      }
      throw new Error(String(detail));
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      try {
        await resolveWorkingApiBase();
      } catch {
        // ignore and keep original network error below
      }
    }
    const message =
      error instanceof TypeError
        ? `서버 연결 실패: 백엔드(${getApiBase()})가 실행 중인지 확인하세요.`
        : error.message;
    setLastError(message);
    throw new Error(message);
  }
}
