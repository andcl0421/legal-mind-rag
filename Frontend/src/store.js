const TOKEN_KEY = "lm_token";
const CONSULT_SETTINGS_KEY = "lm_consult_settings";

export const store = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: null,
  currentSessionId: null,
  currentHistorySessionId: null,
  lastError: "",
  consultSettings: loadConsultSettings(),
};

export function isAuthenticated() {
  return Boolean(store.token);
}

export function setToken(token) {
  store.token = token || "";
  if (store.token) {
    localStorage.setItem(TOKEN_KEY, store.token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function setUser(user) {
  store.user = user || null;
}

export function setConsultSettings(settings) {
  store.consultSettings = {
    industry: settings?.industry || "",
    employment_type: settings?.employment_type || "",
    employment_status: settings?.employment_status || "",
  };
  localStorage.setItem(CONSULT_SETTINGS_KEY, JSON.stringify(store.consultSettings));
}

export function clearAuth() {
  setToken("");
  setUser(null);
}

export function setLastError(message) {
  store.lastError = message || "";
}

function loadConsultSettings() {
  try {
    const raw = localStorage.getItem(CONSULT_SETTINGS_KEY);
    if (!raw) return { industry: "", employment_type: "", employment_status: "" };
    const parsed = JSON.parse(raw);
    return {
      industry: parsed?.industry || "",
      employment_type: parsed?.employment_type || "",
      employment_status: parsed?.employment_status || "",
    };
  } catch {
    return { industry: "", employment_type: "", employment_status: "" };
  }
}
