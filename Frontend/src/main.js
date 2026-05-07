import { renderRoute } from "./router.js";
import { resolveWorkingApiBase } from "./services/api.js";

function renderFatalError(error) {
  const app = document.getElementById("app");
  if (!app) return;
  const message = error instanceof Error ? error.message : String(error || "알 수 없는 오류");
  app.innerHTML = `
    <div class="app-shell">
      <main class="page-wrap">
        <section class="content-card error-hero">
          <h1 class="page-title">화면을 불러오지 못했습니다.</h1>
          <p class="page-description">프론트 초기화 중 오류가 발생했습니다.</p>
          <pre class="status-banner">${message}</pre>
          <div class="hero-actions">
            <a class="button-link" href="#/">홈으로</a>
            <button class="button-link button-ghost" onclick="location.reload()">새로고침</button>
          </div>
        </section>
      </main>
    </div>
  `;
}

async function boot() {
  try {
    await resolveWorkingApiBase();
    if (!location.hash) {
      location.hash = "#/";
    }
    await renderRoute();
  } catch (error) {
    renderFatalError(error);
  }
}

window.addEventListener("error", (event) => {
  renderFatalError(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatalError(event.reason);
});

window.addEventListener("hashchange", () => {
  boot();
});

window.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `
      <div class="app-shell">
        <main class="page-wrap">
          <section class="content-card">
            <p class="page-description">화면을 준비하고 있습니다...</p>
          </section>
        </main>
      </div>
    `;
  }
  boot();
});
