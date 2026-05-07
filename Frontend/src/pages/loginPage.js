import { shellTemplate } from "../components/shell.js";
import { setButtonLoading, setStatus, toast } from "../components/feedback.js";
import { login } from "../services/authService.js";
import { navigate } from "../router.js";
import { checkApiBase, getApiBase, setApiBase } from "../services/api.js";

export const loginPage = {
  title: "로그인 페이지",
  publicOnly: true,
  render() {
    return shellTemplate({
      title: "로그인 페이지",
      description: "이메일과 비밀번호로 인증한 뒤, 상담과 마이페이지로 이동합니다.",
      body: `
        <section class="auth-grid">
          <div class="page-card">
            <form id="login-form" class="form-stack">
              <label for="login-api-base"><strong>백엔드 API 주소</strong></label>
              <input id="login-api-base" type="text" />
              <div class="inline-actions">
                <button id="login-save-api-base" type="button" class="button-ghost">API 주소 저장</button>
                <button id="login-check-api-base" type="button" class="button-ghost">연결 확인</button>
              </div>
              <input id="login-email" type="email" placeholder="이메일" required />
              <input id="login-password" type="password" placeholder="비밀번호(8자 이상)" required />
              <button id="login-submit" type="submit">로그인</button>
            </form>
            <div id="login-status" class="status-banner">로그인 후 상담과 알림 기능을 이용할 수 있습니다.</div>
          </div>
          <div class="page-card stack">
            <h3 class="section-title">로그인 후 가능한 일</h3>
            <div class="info-card">마이페이지에서 계정 정보와 알림 상태를 확인합니다.</div>
            <div class="info-card">챗상담 페이지에서 질문과 근거를 세션 단위로 관리합니다.</div>
            <div class="info-card">상담 내역 페이지에서 기존 세션을 다시 열어봅니다.</div>
          </div>
        </section>
      `,
    });
  },
  afterRender() {
    const form = document.getElementById("login-form");
    const status = document.getElementById("login-status");
    const submitButton = document.getElementById("login-submit");
    const apiBaseInput = document.getElementById("login-api-base");
    apiBaseInput.value = getApiBase();

    document.getElementById("login-save-api-base").addEventListener("click", () => {
      setApiBase(apiBaseInput.value);
      setStatus(status, `API 주소 저장 완료: ${getApiBase()}`, "success");
    });

    document.getElementById("login-check-api-base").addEventListener("click", async () => {
      try {
        const okBase = await checkApiBase(apiBaseInput.value);
        setApiBase(okBase);
        apiBaseInput.value = okBase;
        setStatus(status, `연결 성공: ${okBase}`, "success");
      } catch (error) {
        setStatus(status, `연결 실패: ${error.message}`, "error");
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();
      if (!email || !password) {
        setStatus(status, "이메일과 비밀번호를 입력해주세요.", "error");
        return;
      }
      if (password.length < 8) {
        setStatus(status, "비밀번호는 8자 이상이어야 합니다.", "error");
        return;
      }
      const payload = {
        email,
        password,
      };
      try {
        setButtonLoading(submitButton, "로그인 중...", true);
        const data = await login(payload);
        setStatus(status, `로그인 성공\n${JSON.stringify(data.user, null, 2)}`, "success");
        toast("로그인 성공", "success");
        navigate("/chat");
      } catch (error) {
        setStatus(status, `로그인 실패: ${error.message}`, "error");
        toast("로그인 실패", "error");
      } finally {
        setButtonLoading(submitButton, "로그인 중...", false);
      }
    });
  },
};
