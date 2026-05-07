import { shellTemplate } from "../components/shell.js";
import { isAuthenticated } from "../store.js";

const mungiMain = "/src/assets/mungi/mungi-home.png";
const mungiSheet = "/src/assets/mungi/mungi-sheet.png";

function quickCard(icon, title, desc) {
  return `
    <article class="quick-card-v2">
      <div class="quick-icon" aria-hidden="true">${icon}</div>
      <div>
        <h4>${title}</h4>
        <p>${desc}</p>
      </div>
    </article>
  `;
}

export const homePage = {
  title: "홈",
  render() {
    const cta = isAuthenticated()
      ? `<a class="button-link" href="#/chat">상담 시작하기</a>`
      : `<a class="button-link" href="#/login">로그인하고 상담 시작</a>`;

    return shellTemplate({
      title: "홈",
      description: "노무톡톡 메인 화면",
      body: `
        <section class="page-card home-v2">
          <div class="home-v2-hero">
            <div class="home-v2-copy">
              <span class="eyebrow">AI 노무 상담 · 노동법 도우미</span>
              <h2>복잡한 노동법,<br/>쉽게 상담받아보세요<br/><span>노무톡톡</span></h2>
              <p>AI 노무 상담 도우미 뭉이가 근로계약, 임금, 연차, 퇴직금, 부당해고 기준을 차분하게 안내해드려요.</p>
              ${cta}
            </div>
            <div class="home-v2-character">
              <img src="${mungiMain}" alt="뭉이" class="mungi-img pose-home-hero" />
            </div>
          </div>

          <div class="home-v2-row">
            <article class="mood-card law-check-card">
              <div>
                <h3>빠른 노무 상담</h3>
                <p>자주 묻는 노동 이슈부터 바로 확인하세요.</p>
              </div>
              <div class="mood-options">
                <button class="chip">임금 · 주휴수당</button>
                <button class="chip">근로계약서</button>
                <button class="chip">연차 · 휴가</button>
                <button class="chip">해고 · 권고사직</button>
              </div>
            </article>
            <article class="start-card">
              <img src="${mungiSheet}" alt="노무 상담 문서를 든 뭉이" class="mungi-img pose-home-card" />
              <div>
                <h3>뭉이에게 상황 설명하기</h3>
                <p>사업장 규모와 근무 조건을 알려주면 관련 기준을 함께 짚어드려요.</p>
                <a class="button-link" href="#/chat">대화 시작하기</a>
              </div>
            </article>
          </div>

          <div class="home-v2-content">
            <div class="inline-actions spread"><h3>많이 찾는 노무 질문</h3><a href="#/history" class="more-link">더보기</a></div>
            <div class="home-v2-grid">
              ${quickCard("⚖", "5인 미만 사업장도 연차가 있나요?", "사업장 규모별 적용 기준")}
              ${quickCard("₩", "주휴수당 지급 기준이 궁금해요", "근로시간과 개근 요건")}
              ${quickCard("📄", "권고사직과 해고의 차이는 뭔가요?", "절차와 대응 포인트")}
              ${quickCard("💼", "육아휴직 급여는 얼마까지 받을 수 있나요?", "지원 기준과 신청 흐름")}
            </div>
          </div>
        </section>
      `,
    });
  },
};
