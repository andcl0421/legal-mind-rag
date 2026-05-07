const TOKEN_KEY = "lm_token";

export const store = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: null,
  currentSessionId: null,
  currentHistorySessionId: null,
  lastError: "",
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

export function clearAuth() {
  setToken("");
  setUser(null);
}

export function setLastError(message) {
  store.lastError = message || "";
}
