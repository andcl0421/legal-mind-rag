import { clearAuth, isAuthenticated, store } from "../store.js";

const brandMungi = "/src/assets/mungi/mungi-profile-chat.png";

export function shellTemplate({ title, description = "", body }) {
  const userLabel = store.user?.nickname || store.user?.email || "게스트";
  return `
    <div class="app-shell">
      <header class="topbar topbar-nomu">
        <div class="brand-block brand-nomu">
          <a href="#/" class="brand-lockup">
            <span class="brand-mark" aria-hidden="true">
              <img src="${brandMungi}" alt="" />
            </span>
            <span>
              <span class="brand-title">노무톡톡</span>
              <span class="brand-subtitle">AI 노무 상담 · 노동법 도우미</span>
            </span>
          </a>
        </div>

        <nav class="topbar-nav nav-nomu">
          ${navLink("/", "홈")}
          ${navLink("/history", "상담내역")}
          ${navLink("/mypage", "마이페이지")}
          ${navLink("/chat", "상담")}
          ${!isAuthenticated() ? navLink("/login", "로그인") : ""}
        </nav>

        <div class="topbar-actions">
          <button class="icon-btn" type="button" aria-label="알림">🔔</button>
          <button class="icon-btn" type="button" aria-label="내 정보">👤</button>
          <span class="user-chip">${userLabel}</span>
          ${
            isAuthenticated()
              ? '<button id="logout-button" class="button-danger">로그아웃</button>'
              : '<a class="button-link button-ghost" href="#/signup">회원가입</a>'
          }
        </div>
      </header>

      <main class="page-wrap">
        <section class="page-grid">
          <div class="content-card slim-head">
            <div class="stack head-stack">
              <span class="pill">${title}</span>
              <h1 class="page-title">${title}</h1>
              ${description ? `<p class="page-description">${description}</p>` : ""}
            </div>
          </div>
          ${body}
        </section>
      </main>
    </div>
  `;
}

function navLink(path, label) {
  const active = location.hash === `#${path}` || (path === "/" && (location.hash === "" || location.hash === "#/"));
  return `<a href="#${path}" class="nav-link${active ? " active" : ""}">${label}</a>`;
}

export function wireShellEvents() {
  const logoutButton = document.getElementById("logout-button");
  if (!logoutButton) return;
  logoutButton.addEventListener("click", () => {
    clearAuth();
    location.hash = "#/login";
  });
}
