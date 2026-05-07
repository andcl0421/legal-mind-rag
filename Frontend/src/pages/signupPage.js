import { shellTemplate } from "../components/shell.js";
import { setButtonLoading, setStatus, toast } from "../components/feedback.js";
import { navigate } from "../router.js";
import { signup } from "../services/authService.js";
import { checkApiBase, getApiBase, setApiBase } from "../services/api.js";

export const signupPage = {
  title: "회원가입 페이지",
  publicOnly: true,
  render() {
    return shellTemplate({
      title: "회원가입 페이지",
      description: "현재 PostgreSQL users 스키마 기준으로 사업장 규모를 포함한 최소 계정 정보를 받습니다.",
      body: `
        <section class="auth-grid">
          <div class="page-card">
            <form id="signup-form" class="form-stack">
              <label for="signup-api-base"><strong>백엔드 API 주소</strong></label>
              <input id="signup-api-base" type="text" />
              <div class="inline-actions">
                <button id="signup-save-api-base" type="button" class="button-ghost">API 주소 저장</button>
                <button id="signup-check-api-base" type="button" class="button-ghost">연결 확인</button>
              </div>
              <input id="signup-email" type="email" placeholder="이메일" required />
              <input id="signup-password" type="password" placeholder="비밀번호(8자 이상)" required />
              <input id="signup-nickname" type="text" placeholder="닉네임" required />
              <select id="signup-emp-count" required>
                <option value="">사업장 규모 선택</option>
                <option value="UNDER_5">5인 미만</option>
                <option value="OVER_5">5인 이상</option>
                <option value="OVER_30">30인 이상</option>
                <option value="OVER_300">300인 이상</option>
              </select>
              <input id="signup-region" type="text" placeholder="지역 코드(선택)" />
              <button id="signup-submit" type="submit">회원가입</button>
            </form>
            <div id="signup-status" class="status-banner">회원가입 시 현재 DB 스키마와 맞는 값이 함께 전송됩니다.</div>
          </div>
          <div class="page-card stack">
            <h3 class="section-title">가입 시 반영되는 정보</h3>
            <div class="info-card">emp_count_type은 PostgreSQL users 테이블의 필수 컬럼입니다.</div>
            <div class="info-card">가입 즉시 토큰을 발급받고, 상담 페이지로 이동합니다.</div>
          </div>
        </section>
      `,
    });
  },
  afterRender() {
    const form = document.getElementById("signup-form");
    const status = document.getElementById("signup-status");
    const submitButton = document.getElementById("signup-submit");
    const apiBaseInput = document.getElementById("signup-api-base");
    apiBaseInput.value = getApiBase();

    document.getElementById("signup-save-api-base").addEventListener("click", () => {
      setApiBase(apiBaseInput.value);
      setStatus(status, `API 주소 저장 완료: ${getApiBase()}`, "success");
    });

    document.getElementById("signup-check-api-base").addEventListener("click", async () => {
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
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value.trim();
      const nickname = document.getElementById("signup-nickname").value.trim();
      const empCountType = document.getElementById("signup-emp-count").value;
      if (!email || !password || !nickname || !empCountType) {
        setStatus(status, "이메일, 비밀번호, 닉네임, 사업장 규모는 필수입니다.", "error");
        return;
      }
      if (password.length < 8) {
        setStatus(status, "비밀번호는 8자 이상이어야 합니다.", "error");
        return;
      }
      const payload = {
        email,
        password,
        nickname,
        emp_count_type: empCountType,
        region_code: document.getElementById("signup-region").value.trim() || null,
      };
      try {
        setButtonLoading(submitButton, "회원가입 중...", true);
        const data = await signup(payload);
        setStatus(status, `회원가입 성공\n${JSON.stringify(data.user, null, 2)}`, "success");
        toast("회원가입 성공", "success");
        navigate("/mypage");
      } catch (error) {
        setStatus(status, `회원가입 실패: ${error.message}`, "error");
        toast("회원가입 실패", "error");
      } finally {
        setButtonLoading(submitButton, "회원가입 중...", false);
      }
    });
  },
};
