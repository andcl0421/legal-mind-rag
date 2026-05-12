import { api } from "./api.js";
import { setToken, setUser } from "../store.js";

export async function signup(payload) {
  const data = await api("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(data.token.access_token);
  setUser(data.user);
  return data;
}

export async function login(payload) {
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(data.token.access_token);
  setUser(data.user);
  return data;
}

export async function fetchMe() {
  const data = await api("/auth/me", {}, true);
  setUser(data);
  return data;
}

export async function updateMe(payload) {
  const data = await api(
    "/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
  setUser(data);
  return data;
}
