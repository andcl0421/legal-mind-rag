import { RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import mungiHistory from "../assets/mungi/mungi-history.png";
import { resolveWorkingApiBase } from "../services/api.js";
import { fetchAlerts } from "../services/alertService.js";
import { fetchSessions } from "../services/chatService.js";
import { fetchChecklistItems, saveChecklistItem } from "../services/checklistService.js";

const tabs = ["전체", "임금/수당", "해고/징계", "육아/휴가", "근로계약"];

export default function History() {
  const [activeTab, setActiveTab] = useState("전체");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionAlerts, setSessionAlerts] = useState([]);
  const [checkState, setCheckState] = useState({});
  const [status, setStatus] = useState("상담 기록을 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(false);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sessions.filter((session) => {
      const category = normalizeCategory(session.category || "AI 상담");
      const tabMatch = activeTab === "전체" || category === activeTab;
      const text = `${session.title || ""} ${session.category || ""} ${session.summary || ""} ${session.last_message_preview || ""} ${
        session.latest_primary_citation || ""
      } ${session.latest_source_label || ""}`.toLowerCase();
      const queryMatch = !normalizedQuery || text.includes(normalizedQuery);
      return tabMatch && queryMatch;
    });
  }, [activeTab, query, sessions]);

  const checklist = useMemo(() => buildChecklist(sessionAlerts), [sessionAlerts]);

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
    } catch (error) {
      setStatus(`상담 기록 조회 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectSession(item) {
    setSelectedSession(item);
    try {
      const [alertsRes, checklistRes] = await Promise.all([
        fetchAlerts(false, "chat_auto", item.chat_session_id),
        fetchChecklistItems(item.chat_session_id),
      ]);
      setSessionAlerts(alertsRes.items || []);
      const nextState = {};
      for (const row of checklistRes.items || []) {
        nextState[makeKey(row.item_type, row.item_text)] = !!row.is_done;
      }
      setCheckState(nextState);
    } catch {
      setSessionAlerts([]);
      setCheckState({});
    }
  }

  async function handleToggle(itemType, itemText, checked) {
    if (!selectedSession?.chat_session_id) return;
    const key = makeKey(itemType, itemText);
    setCheckState((prev) => ({ ...prev, [key]: checked }));
    try {
      await saveChecklistItem({
        chat_session_id: selectedSession.chat_session_id,
        item_type: itemType,
        item_text: itemText,
        is_done: checked,
      });
    } catch (error) {
      setCheckState((prev) => ({ ...prev, [key]: !checked }));
      setStatus(`체크 저장 실패: ${error.message}`);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="nomu-card relative min-h-[calc(100vh-18rem)] overflow-hidden p-5 sm:p-7 xl:p-9">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-black text-nomu-dark sm:text-3xl">상담내역</h1>
            <p className="mt-2 font-semibold text-[#6F806C]">상담별 준비할 서류와 먼저 할 일을 저장하며 관리하세요.</p>
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
          {tabs.map((tab) => (
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
            placeholder="상담 내용, 제목, 근거 법령 검색"
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
                    onClick={() => handleSelectSession(item)}
                    className={`cursor-pointer transition hover:bg-[#FBFDF8] ${
                      selectedSession?.chat_session_id === item.chat_session_id ? "bg-[#F9FBF5]" : ""
                    }`}
                  >
                    <td className="px-5 py-5 font-bold text-[#5D6B5A]">{formatDate(item.updated_at || item.created_at)}</td>
                    <td className="px-5 py-5">
                      <span className="nomu-chip text-xs">{normalizeCategory(item.category || "AI 상담")}</span>
                    </td>
                    <td className="px-5 py-5">
                      <p className="font-extrabold text-[#273329]">{item.title || item.last_message_preview || "상담 세션"}</p>
                      <p className="mt-1 max-w-md truncate text-xs font-semibold text-[#7B8878]">
                        {item.last_message_preview || item.summary || "상담 내용을 선택해 체크리스트를 확인하세요."}
                      </p>
                    </td>
                    <td className="px-5 py-5 font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4">
                      {item.latest_primary_citation || "-"}
                    </td>
                    <td className="px-5 py-5 font-semibold text-[#5D6B5A]">{item.latest_source_label || "출처 정보 없음"}</td>
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

        <img src={mungiHistory} alt="뭉이" className="pointer-events-none absolute -bottom-7 right-4 hidden w-36 object-contain md:block" />
      </div>

      <aside className="nomu-card min-h-[calc(100vh-18rem)] p-5 sm:p-6">
        <h2 className="text-xl font-black text-nomu-dark">준비 체크리스트</h2>
        <p className="mt-1 text-sm font-semibold text-[#6F806C]">
          {selectedSession ? `${formatDate(selectedSession.updated_at || selectedSession.created_at)} · ${selectedSession.title || "상담"}` : "상담내역에서 한 건을 선택하세요."}
        </p>

        {selectedSession ? (
          <div className="mt-4 space-y-4">
            <ChecklistPanel
              title="먼저 할 일"
              itemType="next_action"
              items={checklist.nextActions}
              checkState={checkState}
              onToggle={handleToggle}
            />
            <ChecklistPanel
              title="준비할 서류"
              itemType="required_doc"
              items={checklist.requiredDocs}
              checkState={checkState}
              onToggle={handleToggle}
            />
            <PlainPanel title="알림 누적 내역" items={sessionAlerts.map((item) => `${formatDateTime(item.created_at)} · ${item.title}`)} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-nomu-line bg-[#FBFDF8] p-4 text-sm font-semibold text-[#6F806C]">
            예: 2026.05.14 출산 부당해고 상담을 선택하면 관련 준비서류/할 일/알림이 이곳에 쌓입니다.
          </div>
        )}
      </aside>
    </section>
  );
}

function ChecklistPanel({ title, itemType, items, checkState, onToggle }) {
  return (
    <div className="rounded-2xl border border-nomu-line bg-[#FBFDF8] p-4">
      <h3 className="text-sm font-black text-nomu-dark">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.length ? (
          items.map((item, index) => {
            const key = makeKey(itemType, item);
            const checked = !!checkState[key];
            return (
              <li key={`${title}-${index}`} className="flex items-start gap-2 text-sm font-semibold text-[#4F5E4C]">
                <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onToggle(itemType, item, e.target.checked)} />
                <span className={checked ? "line-through opacity-60" : ""}>{item}</span>
              </li>
            );
          })
        ) : (
          <li className="text-sm font-semibold text-[#7B8878]">항목이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}

function PlainPanel({ title, items }) {
  return (
    <div className="rounded-2xl border border-nomu-line bg-[#FBFDF8] p-4">
      <h3 className="text-sm font-black text-nomu-dark">{title}</h3>
      <ul className="mt-2 space-y-1">
        {items.length ? (
          items.map((item, index) => (
            <li key={`${title}-${index}`} className="text-sm font-semibold text-[#4F5E4C]">
              - {item}
            </li>
          ))
        ) : (
          <li className="text-sm font-semibold text-[#7B8878]">항목이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}

function buildChecklist(alerts) {
  const nextActions = [];
  const requiredDocs = [];
  for (const alert of alerts) {
    const lines = String(alert.content || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("-")) {
        const text = line.replace(/^-+\s*/, "");
        if (alert.alert_type === "document") requiredDocs.push(text);
        else nextActions.push(text);
      } else if (line.includes("우선순위 1:")) {
        nextActions.push(line.split("우선순위 1:")[1].trim());
      }
    }
  }
  return {
    nextActions: unique(nextActions).slice(0, 8),
    requiredDocs: unique(requiredDocs).slice(0, 12),
  };
}

function makeKey(itemType, itemText) {
  return `${itemType}::${itemText}`;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeCategory(category) {
  const value = String(category || "");
  if (value.includes("임금") || value.includes("수당") || value.includes("퇴직금")) return "임금/수당";
  if (value.includes("해고") || value.includes("징계") || value.includes("권고")) return "해고/징계";
  if (value.includes("육아") || value.includes("출산") || value.includes("휴가") || value.includes("연차")) return "육아/휴가";
  if (value.includes("계약")) return "근로계약";
  return value || "AI 상담";
}
