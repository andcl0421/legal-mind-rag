import { shellTemplate } from "../components/shell.js";
import { setButtonLoading, setStatus, toast } from "../components/feedback.js";
import { fetchSessionDetail, fetchSessions, sendChat } from "../services/chatService.js";
import { store } from "../store.js";

const mungiMain = "/src/assets/mungi/mungi-profile-chat.png";

function escapeHtml(raw) {
  return String(raw || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSessionButton(session, activeId) {
  return `
    <li class="session-item${activeId === session.chat_session_id ? " active" : ""}">
      <button data-session-id="${session.chat_session_id}">
        <strong>${escapeHtml(session.title || "뭉이 AI 노무상담")}</strong>
        <div>${escapeHtml(session.category || "노동법 · 근로기준법 기반 안내")}</div>
      </button>
    </li>
  `;
}

function renderMessage(message) {
  return `
    <article class="message-item ${message.role}">
      <strong>${message.role === "user" ? "나" : "뭉이"}</strong>
      <div>${escapeHtml(message.content).replaceAll("\n", "<br/>")}</div>
    </article>
  `;
}

function pickAssistantMessage(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "assistant") return messages[i];
  }
  return null;
}

function extractReferencesFromText(text) {
  const lines = String(text || "").split("\n");
  const refs = lines.filter((line) => line.includes("근거:") || line.includes("주요 근거"));
  return refs.length ? refs.slice(0, 3).map((line) => line.replace("근거:", "").trim()) : ["근로기준법 제70조", "근로기준법 시행령 제95조", "고용노동부 고시 제2024-15호"];
}

export const chatPage = {
  title: "상담",
  requiresAuth: true,
  render() {
    return shellTemplate({
      title: "상담실",
      description: "대화와 참조 문서를 함께 보는 상담 화면",
      body: `
        <section class="page-card chat-v2">
          <div class="chat-v2-layout">
            <aside class="chat-v2-side">
              <h3>상담 세션</h3>
              <button id="new-chat-session" class="button-ghost">새 상담</button>
              <ul id="chat-session-list" class="session-list"></ul>
            </aside>

            <main class="chat-v2-main">
              <div id="chat-intro-panel" class="chat-v2-intro">
                <img src="${mungiMain}" alt="뭉이" class="mungi-img pose-chat" />
                <div class="chat-intro-bubble">
                  <p>안녕하세요, AI 노무상담 도우미 뭉이예요.
근로계약, 연차, 퇴직금, 부당해고 등
궁금한 노동법 내용을 편하게 질문해주세요.</p>
                  <small>본 상담은 법률 자문이 아닌 AI 기반 참고용 안내입니다.</small>
                </div>
                <div class="chip-list">
                  <button class="chip">주휴수당 조건이 궁금해요</button>
                  <button class="chip">퇴직금을 받을 수 있나요?</button>
                  <button class="chip">부당해고인지 알고 싶어요</button>
                  <button class="chip">연차 계산이 궁금해요</button>
                </div>
              </div>

              <div id="chat-workspace" class="chat-v2-workspace hidden">
                <div class="chat-thread-wrap"><div id="chat-message-list" class="message-list"></div></div>
                <aside class="law-panel ref-panel">
                  <div class="ref-tabs"><button class="ref-tab active" type="button">법령 근거</button><button class="ref-tab" type="button">상담 요약</button></div>
                  <h4 class="ref-title">관련 근로기준법 조항</h4>
                  <select id="ref-select" class="ref-select">
                    <option>조문 보기</option>
                    <option>시행령 보기</option>
                    <option>고시 보기</option>
                  </select>
                  <div id="law-reference-box" class="law-reference-box doc-view">상담 답변 생성 후 표시됩니다.</div>
                  <div class="ref-pagination"><button type="button" class="button-ghost">〈</button><span>1 / 3</span><button type="button" class="button-ghost">〉</button></div>
                  <h4>관련 조항</h4>
                  <ul id="related-clauses" class="related-clauses"></ul>
                </aside>
              </div>

              <form id="chat-form" class="chat-v2-input">
                <input id="chat-question" placeholder="궁금한 노동법 내용을 입력해주세요..." required />
                <button type="submit">전송</button>
              </form>

              <div id="chat-status" class="status-banner">상담을 시작해보세요.</div>
            </main>
          </div>
        </section>
      `,
    });
  },
  async afterRender() {
    const sessionList = document.getElementById("chat-session-list");
    const messageList = document.getElementById("chat-message-list");
    const status = document.getElementById("chat-status");
    const introPanel = document.getElementById("chat-intro-panel");
    const workspace = document.getElementById("chat-workspace");
    const lawReferenceBox = document.getElementById("law-reference-box");
    const relatedClauses = document.getElementById("related-clauses");
    const form = document.getElementById("chat-form");
    const submitButton = form.querySelector("button[type='submit']");
    const mainInput = document.getElementById("chat-question");

    function toggleMode(hasSession) {
      introPanel.classList.toggle("hidden", hasSession);
      workspace.classList.toggle("hidden", !hasSession);
    }

    async function loadSessions() {
      const data = await fetchSessions();
      sessionList.innerHTML = data.sessions.length
        ? data.sessions.map((session) => renderSessionButton(session, store.currentSessionId)).join("")
        : '<li class="empty-state">세션이 없습니다.</li>';

      sessionList.querySelectorAll("[data-session-id]").forEach((button) => {
        button.addEventListener("click", async () => {
          store.currentSessionId = button.dataset.sessionId;
          await loadSessionDetail();
          await loadSessions();
        });
      });
    }

    async function loadSessionDetail() {
      if (!store.currentSessionId) {
        toggleMode(false);
        return;
      }

      const data = await fetchSessionDetail(store.currentSessionId);
      messageList.innerHTML = data.messages?.length
        ? data.messages.map(renderMessage).join("")
        : '<div class="empty-state">메시지가 없습니다.</div>';

      const assistant = pickAssistantMessage(data.messages || []);
      if (assistant) {
        lawReferenceBox.innerHTML = escapeHtml(assistant.content).replaceAll("\n", "<br/>");
        relatedClauses.innerHTML = extractReferencesFromText(assistant.content).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
      }

      setStatus(status, `${data.category || "상담"} / 위험도 ${data.risk_level || "-"}`, "success");
      toggleMode(true);
    }

    document.getElementById("new-chat-session").addEventListener("click", async () => {
      store.currentSessionId = null;
      messageList.innerHTML = "";
      lawReferenceBox.textContent = "상담 답변 생성 후 표시됩니다.";
      relatedClauses.innerHTML = "";
      toggleMode(false);
      await loadSessions();
    });

    document.querySelectorAll("#chat-intro-panel .chip").forEach((button) => {
      button.addEventListener("click", () => {
        mainInput.value = button.textContent.trim();
        mainInput.focus();
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        content: document.getElementById("chat-question").value.trim(),
        chat_session_id: store.currentSessionId,
        user_id: store.user?.user_id || null,
      };
      if (!payload.content) {
        setStatus(status, "질문을 입력해주세요.", "error");
        return;
      }

      try {
        setButtonLoading(submitButton, "전송 중...", true);
        const data = await sendChat(payload);
        store.currentSessionId = data.chat_session_id;
        document.getElementById("chat-question").value = "";
        toast("답변을 받았습니다.", "success");
        await loadSessionDetail();
        await loadSessions();
      } catch (error) {
        setStatus(status, `상담 전송 실패: ${error.message}`, "error");
      } finally {
        setButtonLoading(submitButton, "전송 중...", false);
      }
    });

    await loadSessions();
    await loadSessionDetail();
  },
};
