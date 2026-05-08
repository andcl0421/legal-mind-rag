import { RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import mungiHistory from "../assets/mungi/mungi-history.png";
import { resolveWorkingApiBase } from "../services/api.js";
import { fetchSessionDetail, fetchSessions } from "../services/chatService.js";
import { store } from "../store.js";

const tabs = ["전체", "임금/수당", "해고/징계", "육아/휴가", "근로계약"];

export default function History() {
  const [activeTab, setActiveTab] = useState("전체");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [status, setStatus] = useState("상담 기록을 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(false);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sessions.filter((session) => {
      const category = normalizeCategory(session.category || "AI 상담");
      const tabMatch = activeTab === "전체" || category === activeTab;
      const text = `${session.title || ""} ${session.category || ""} ${session.summary || ""} ${session.last_message_preview || ""}`.toLowerCase();
      const queryMatch = !normalizedQuery || text.includes(normalizedQuery);
      return tabMatch && queryMatch;
    });
  }, [activeTab, query, sessions]);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setIsLoading(true);
    try {
      await resolveWorkingApiBase();
      const data = await fetchSessions();
      const nextSessions = data.sessions || [];
      setSessions(nextSessions);
      setStatus(`상담 기록 ${nextSessions.length}건을 불러왔습니다.`);
      const selectedId = store.currentHistorySessionId || nextSessions[0]?.chat_session_id;
      if (selectedId) {
        await loadDetail(selectedId);
      } else {
        setSelectedSession(null);
        setSelectedMessages([]);
      }
    } catch (error) {
      setStatus(`상담 기록 조회 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(sessionId) {
    try {
      store.currentHistorySessionId = sessionId;
      const data = await fetchSessionDetail(sessionId);
      setSelectedSession(data);
      setSelectedMessages(data.messages || []);
      setStatus(`${data.title || "상담"} 상세를 불러왔습니다.`);
    } catch (error) {
      setStatus(`상담 상세 조회 실패: ${error.message}`);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="nomu-card relative min-h-[calc(100vh-18rem)] overflow-hidden p-5 sm:p-7 xl:p-9">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">상담내역</h1>
          <p className="mt-2 font-semibold text-[#6F806C]">지식베이스 원문, 법령, 가이드라인, 판례별 근거를 확인해보세요.</p>
        </div>
        <button
          type="button"
          onClick={loadSessions}
          disabled={isLoading}
          className="inline-flex w-fit items-center gap-2 rounded-2xl bg-nomu-dark px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          <RefreshCw size={16} /> {isLoading ? "조회 중" : "상담 기록 조회"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${
              activeTab === tab ? "bg-nomu-soft text-nomu-dark ring-1 ring-nomu-line" : "bg-[#F5F8F1] text-[#6F806C] hover:bg-nomu-soft"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <label className="mb-5 flex items-center gap-2 rounded-2xl border border-nomu-line bg-[#F7FAF4] px-4 py-3">
        <Search size={18} className="text-[#7B8878]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-transparent text-sm font-semibold outline-none"
          placeholder="상담 내용, 참조문서, 답변 출처 검색"
        />
      </label>

      <div className="mb-3 rounded-2xl border border-nomu-line bg-[#FBFDF8] px-4 py-3 text-sm font-bold text-[#6F806C]">{status}</div>

      <div className="overflow-x-auto rounded-3xl border border-nomu-line bg-white">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead className="bg-[#F3FAED] text-sm text-nomu-dark">
            <tr>
              <th className="px-5 py-4 font-black">상담일</th>
              <th className="px-5 py-4 font-black">구분</th>
              <th className="px-5 py-4 font-black">상담내용</th>
              <th className="px-5 py-4 font-black">참조문서</th>
              <th className="px-5 py-4 font-black">답변출처</th>
              <th className="px-5 py-4 font-black">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3E9] text-sm">
            {filteredSessions.length ? (
              filteredSessions.map((item) => (
              <tr
                key={item.chat_session_id}
                onClick={() => loadDetail(item.chat_session_id)}
                className="cursor-pointer transition hover:bg-[#FBFDF8]"
              >
                <td className="px-5 py-5 font-bold text-[#5D6B5A]">{formatDate(item.updated_at || item.created_at)}</td>
                <td className="px-5 py-5">
                  <span className="nomu-chip text-xs">{normalizeCategory(item.category || "AI 상담")}</span>
                </td>
                <td className="px-5 py-5">
                  <p className="font-extrabold text-[#273329]">{item.title || item.last_message_preview || "상담 세션"}</p>
                  <p className="mt-1 max-w-md truncate text-xs font-semibold text-[#7B8878]">{item.last_message_preview || item.summary || "상세 대화를 확인해보세요."}</p>
                </td>
                <td className="px-5 py-5 font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4">{pickReference(item)}</td>
                <td className="px-5 py-5 font-semibold text-[#5D6B5A]">{item.risk_level ? `위험도 ${item.risk_level}` : "AI 답변 근거"}</td>
                <td className="px-5 py-5">
                  <span className="rounded-full bg-nomu-soft px-3 py-1.5 text-xs font-black text-nomu-dark">답변완료</span>
                </td>
              </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-5 py-12 text-center font-bold text-[#7B8878]">
                  조회된 상담내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <img src={mungiHistory} alt="책을 읽는 뭉이" className="pointer-events-none absolute -bottom-7 right-4 hidden w-36 object-contain md:block" />
      </div>

      <div className="nomu-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-black">상담 상세</h2>
            <p className="mt-1 text-sm font-semibold text-[#6F806C]">
              {selectedSession ? `${selectedSession.title || "상담"} · ${selectedSession.category || "AI 상담"}` : "상담 행을 선택하면 대화가 표시됩니다."}
            </p>
          </div>
          {selectedSession && <span className="nomu-chip">{formatDate(selectedSession.updated_at || selectedSession.created_at)}</span>}
        </div>
        <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-3xl border border-nomu-line bg-[#F9FBF9] p-4">
          {selectedMessages.length ? (
            selectedMessages.map((message) => (
              <div key={message.message_id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-[1.35rem] px-4 py-3 text-sm font-semibold leading-6 ${
                    message.role === "user"
                      ? "rounded-tr-md bg-nomu-main text-white"
                      : "rounded-tl-md border border-nomu-line bg-white text-[#374438]"
                  }`}
                >
                  {message.role !== "user" && <strong className="mb-1 block text-nomu-dark">뭉이</strong>}
                  {message.content}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-nomu-line bg-white p-8 text-center font-bold text-[#7B8878]">
              표시할 대화가 없습니다.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeCategory(category) {
  const value = String(category || "");
  if (value.includes("임금") || value.includes("수당") || value.includes("퇴직금")) return "임금/수당";
  if (value.includes("해고") || value.includes("징계") || value.includes("권고")) return "해고/징계";
  if (value.includes("육아") || value.includes("휴가") || value.includes("연차")) return "육아/휴가";
  if (value.includes("계약")) return "근로계약";
  return value || "AI 상담";
}

function pickReference(session) {
  const text = `${session.title || ""} ${session.category || ""} ${session.last_message_preview || ""}`;
  if (text.includes("해고") || text.includes("징계")) return "근로기준법 제23조";
  if (text.includes("육아")) return "남녀고용평등법 제19조";
  if (text.includes("계약")) return "근로기준법 제17조";
  if (text.includes("연차") || text.includes("휴가")) return "근로기준법 제60조";
  return "근로기준법 제55조";
}
