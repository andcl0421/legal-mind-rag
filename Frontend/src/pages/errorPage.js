import { shellTemplate } from "../components/shell.js";
import { store } from "../store.js";

export const errorPage = {
  title: "에러/접근 제한 페이지",
  render({ query }) {
    const reason = query.get("reason");
    const message =
      reason === "auth"
        ? "이 페이지는 로그인 후 접근할 수 있습니다."
        : store.lastError || "요청을 처리하는 중 문제가 발생했습니다.";

    return shellTemplate({
      title: "에러/접근 제한 페이지",
      description: "인증이 없거나, 백엔드 응답이 실패했을 때 안내를 보여주는 화면입니다.",
      body: `
        <section class="content-card error-hero">
          <h2>접근을 계속할 수 없습니다.</h2>
          <p class="page-description">${message}</p>
          <div class="hero-actions">
            <a class="button-link" href="#/">홈으로</a>
            <a class="button-link button-ghost" href="#/login">로그인</a>
          </div>
        </section>
      `,
    });
  },
};
