import { wireShellEvents } from "./components/shell.js";
import { chatPage } from "./pages/chatPage.js";
import { errorPage } from "./pages/errorPage.js";
import { historyPage } from "./pages/historyPage.js";
import { homePage } from "./pages/homePage.js";
import { loginPage } from "./pages/loginPage.js";
import { myPage } from "./pages/myPage.js";
import { signupPage } from "./pages/signupPage.js";
import { fetchMe } from "./services/authService.js";
import { isAuthenticated, setLastError } from "./store.js";

const routes = {
  "/": homePage,
  "/login": loginPage,
  "/signup": signupPage,
  "/mypage": myPage,
  "/chat": chatPage,
  "/history": historyPage,
  "/error": errorPage,
};

export function navigate(path) {
  location.hash = `#${path}`;
}

function getRouteParts() {
  const hash = location.hash || "#/";
  const trimmed = hash.slice(1);
  const [pathPart, queryString = ""] = trimmed.split("?");
  const path = pathPart || "/";
  return { path, query: new URLSearchParams(queryString) };
}

export async function renderRoute() {
  const app = document.getElementById("app");
  const { path, query } = getRouteParts();
  const page = routes[path] || errorPage;

  if (isAuthenticated()) {
    try {
      await fetchMe();
    } catch {
      setLastError("로그인 세션이 만료되었거나 유효하지 않습니다.");
    }
  }

  if (page.requiresAuth && !isAuthenticated()) {
    location.hash = "#/error?reason=auth";
    return;
  }

  if (page.publicOnly && isAuthenticated()) {
    location.hash = "#/chat";
    return;
  }

  app.innerHTML = page.render({ query });
  wireShellEvents();
  if (typeof page.afterRender === "function") {
    await page.afterRender({ query });
  }
}
