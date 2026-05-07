import { shellTemplate } from "../components/shell.js";
import { setStatus, toast } from "../components/feedback.js";
import { fetchAlerts, createAlert, markAlertRead } from "../services/alertService.js";
import { fetchMe } from "../services/authService.js";

const mungiMain = "/src/assets/mungi/mungi-profile-chat.png";

function alertMarkup(item) {
  return `
    <li class="alert-item">
      <div class="stack">
        <div class="inline-actions spread"><strong>${item.title}</strong><span class="pill">${item.source === "chat_auto" ? "자동" : "수동"}</span></div>
        <div>${item.content}</div>
        <small class="muted">${item.is_read ? "읽음" : "미읽음"}</small>
        ${item.is_read ? "" : `<button class="button-ghost" data-alert-read="${item.user_notif_id}">읽음 처리</button>`}
      </div>
    </li>
  `;
}

export const myPage = {
  title: "마이페이지",
  requiresAuth: true,
  render() {
    return shellTemplate({
      title: "마이페이지",
      description: "프로필과 상담 통계",
      body: `
        <section class="page-card my-v2">
          <div class="my-v2-layout">
            <aside class="my-v2-side">
              <img src="${mungiMain}" alt="뭉이" class="mungi-img pose-mypage" />
              <h3>사용자 님</h3>
              <p>현재 5인 이상 사업장 기준으로 상담이 제공되고 있어요.</p>
              <button id="reload-me" class="button-ghost">정보 새로고침</button>
              <div id="my-info" class="info-card">사용자 정보를 불러오는 중입니다.</div>
              <div class="stack menu-stack">
                <button class="menu-btn">내 정보</button>
                <button class="menu-btn">사업장 정보</button>
                <button class="menu-btn">상담 설정</button>
                <button class="menu-btn">알림 설정</button>
                <button class="menu-btn">고객센터</button>
              </div>
            </aside>

            <main class="my-v2-main">
              <div class="inline-actions spread"><h3>상담 통계</h3><span class="pill">최근 30일</span></div>
              <div class="chart-soft">
                <div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div><div class="bar b4"></div><div class="bar b5"></div><div class="bar b6"></div>
              </div>
              <div class="stats-grid">
                <div class="stat-soft"><p>전체 상담</p><h4>18회</h4></div>
                <div class="stat-soft"><p>임금 상담</p><h4>7회</h4></div>
                <div class="stat-soft"><p>연차 상담</p><h4>5회</h4></div>
                <div class="stat-soft"><p>해고 상담</p><h4>3회</h4></div>
              </div>
              <div class="keyword-panel">
                <h4>최근 상담 키워드</h4>
                <div class="keyword-list">
                  <span>#주휴수당</span><span>#퇴직금</span><span>#근로계약</span><span>#연차</span><span>#육아휴직</span><span>#부당해고</span>
                </div>
              </div>
            </main>
          </div>
        </section>

        <section class="page-card stack">
          <div class="inline-actions spread">
            <h3 class="section-title">알림 관리</h3>
            <div class="button-row">
              <button id="load-auto-alerts" class="button-ghost" type="button">자동</button>
              <button id="load-all-alerts" class="button-ghost" type="button">전체</button>
              <button id="load-unread-alerts" class="button-ghost" type="button">미읽음</button>
            </div>
          </div>

          <form id="alert-create-form" class="form-stack">
            <input id="alert-title" type="text" placeholder="알림 제목" required />
            <textarea id="alert-content" placeholder="알림 내용" required></textarea>
            <div class="button-row"><button type="submit">수동 알림 생성</button></div>
          </form>

          <div id="alert-status" class="status-banner">상담 후 생성된 자동 알림을 확인하세요.</div>
          <ul id="mypage-alert-list" class="alert-list"></ul>
        </section>
      `,
    });
  },
  async afterRender() {
    const info = document.getElementById("my-info");
    const status = document.getElementById("alert-status");
    const alertList = document.getElementById("mypage-alert-list");
    let currentSourceFilter = "";

    async function loadMe() {
      try {
        const user = await fetchMe();
        info.innerHTML = `
          <div><strong>이메일</strong><div>${user.email}</div></div>
          <div><strong>닉네임</strong><div>${user.nickname || "-"}</div></div>
          <div><strong>사업장 규모</strong><div>${user.emp_count_type}</div></div>
          <div><strong>지역 코드</strong><div>${user.region_code || "-"}</div></div>
        `;
      } catch (error) {
        info.textContent = `내 정보 조회 실패: ${error.message}`;
      }
    }

    async function loadAlerts(unreadOnly = false) {
      try {
        const data = await fetchAlerts(unreadOnly, currentSourceFilter);
        alertList.innerHTML = data.items.length
          ? data.items.map(alertMarkup).join("")
          : '<li class="empty-state">조회된 알림이 없습니다.</li>';
        setStatus(status, `알림 ${data.items.length}건 조회`, "info");
        alertList.querySelectorAll("[data-alert-read]").forEach((button) => {
          button.addEventListener("click", async () => {
            await markAlertRead(button.dataset.alertRead);
            await loadAlerts(unreadOnly);
          });
        });
      } catch (error) {
        setStatus(status, `알림 조회 실패: ${error.message}`, "error");
      }
    }

    document.getElementById("reload-me").addEventListener("click", loadMe);
    document.getElementById("load-unread-alerts").addEventListener("click", () => loadAlerts(true));
    document.getElementById("load-auto-alerts").addEventListener("click", () => {
      currentSourceFilter = "chat_auto";
      loadAlerts(false);
    });
    document.getElementById("load-all-alerts").addEventListener("click", () => {
      currentSourceFilter = "";
      loadAlerts(false);
    });

    document.getElementById("alert-create-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await createAlert({
          title: document.getElementById("alert-title").value.trim(),
          content: document.getElementById("alert-content").value.trim(),
        });
        toast("알림 생성 완료", "success");
        document.getElementById("alert-title").value = "";
        document.getElementById("alert-content").value = "";
        await loadAlerts(false);
      } catch (error) {
        setStatus(status, `알림 생성 실패: ${error.message}`, "error");
      }
    });

    await loadMe();
    await loadAlerts(false);
  },
};
