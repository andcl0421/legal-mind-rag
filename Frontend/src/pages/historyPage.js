import { shellTemplate } from "../components/shell.js";
import { fetchSessionDetail, fetchSessions } from "../services/chatService.js";
import { store } from "../store.js";

const mungiMain = "/src/assets/mungi/mungi-history.png";

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function historyRow(session) {
  return `
    <tr>
      <td>${formatDate(session.updated_at || session.created_at)}</td>
      <td>${session.category || "AI 상담"}</td>
      <td><button class="topic-button" data-history-session="${session.chat_session_id}">${session.title || "상담 세션"}</button></td>
      <td>${session.message_count || 0}건</td>
      <td><span class="status-chip done">완료</span></td>
    </tr>
  `;
}

export const historyPage = {
  title: "상담내역",
  requiresAuth: true,
  render() {
    return shellTemplate({
      title: "상담내역",
      description: "이전 상담 기록 확인",
      body: `
        <section class="page-card history-v2">
          <div class="history-v2-head">
            <div>
              <h2>상담내역</h2>
              <p>이전 노무 상담 기록과 답변 근거를 확인해보세요.</p>
            </div>
            <button id="refresh-history" class="button-link">상담 새로고침</button>
          </div>

          <div class="history-v2-tabs">
            <button class="chip active">전체</button>
            <button class="chip">AI 상담</button>
            <button class="chip">전문가 상담</button>
            <button class="chip">전화 상담</button>
          </div>

          <input id="history-search" type="text" placeholder="상담 내용이나 상담 구분을 검색하세요" />

          <div class="history-table-wrap">
            <table class="history-table">
              <thead>
                <tr><th>일자</th><th>상담구분</th><th>상담내용</th><th>상담건수</th><th>결과</th></tr>
              </thead>
              <tbody id="history-table-body"></tbody>
            </table>
          </div>

          <div class="history-v2-foot">
            <span class="chip">1</span><span class="chip">2</span><span class="chip">3</span>
            <img src="${mungiMain}" alt="뭉이" class="mungi-img pose-history" />
          </div>
        </section>

        <section class="page-card stack">
          <div id="history-session-meta" class="status-banner">상담 세션을 선택하면 상세 대화가 표시됩니다.</div>
          <div id="history-message-list" class="message-list"></div>
        </section>
      `,
    });
  },
  async afterRender() {
    const tableBody = document.getElementById("history-table-body");
    const meta = document.getElementById("history-session-meta");
    const messageList = document.getElementById("history-message-list");
    const searchInput = document.getElementById("history-search");
    let allSessions = [];

    function bindRows() {
      tableBody.querySelectorAll("[data-history-session]").forEach((button) => {
        button.addEventListener("click", async () => {
          store.currentHistorySessionId = button.dataset.historySession;
          await loadDetail();
        });
      });
    }

    function applyFilter() {
      const q = searchInput.value.trim().toLowerCase();
      const filtered = !q
        ? allSessions
        : allSessions.filter((session) => {
            const title = String(session.title || "").toLowerCase();
            const category = String(session.category || "").toLowerCase();
            return title.includes(q) || category.includes(q);
          });

      tableBody.innerHTML = filtered.length
        ? filtered.map(historyRow).join("")
        : '<tr><td colspan="5"><div class="empty-state">검색 결과가 없습니다.</div></td></tr>';
      bindRows();
    }

    async function loadSessions() {
      const data = await fetchSessions();
      allSessions = data.sessions;
      applyFilter();
    }

    async function loadDetail() {
      if (!store.currentHistorySessionId) {
        messageList.innerHTML = '<div class="empty-state">선택된 상담이 없습니다.</div>';
        return;
      }
      const data = await fetchSessionDetail(store.currentHistorySessionId);
      meta.textContent = `${data.title || "상담"} · ${data.category || "상담"} · 위험도 ${data.risk_level || "-"}`;
      messageList.innerHTML = data.messages?.length
        ? data.messages
            .map((m) => `<div class="message-item ${m.role}"><strong>${m.role === "user" ? "나" : "뭉이"}</strong><div>${m.content}</div></div>`)
            .join("")
        : '<div class="empty-state">메시지가 없습니다.</div>';
    }

    searchInput.addEventListener("input", applyFilter);
    document.getElementById("refresh-history").addEventListener("click", loadSessions);

    await loadSessions();
    await loadDetail();
  },
};
