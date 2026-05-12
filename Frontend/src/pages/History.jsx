import { FileText, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import mungiHistory from "../assets/mungi/mungi-history.png";
import { getApiBase, resolveWorkingApiBase } from "../services/api.js";
import { downloadSessionReport, fetchSessionDetail, fetchSessions } from "../services/chatService.js";
import { store } from "../store.js";

const tabs = ["전체", "임금/수당", "해고/징계", "육아/휴가", "근로계약"];

export default function History() {
  const [activeTab, setActiveTab] = useState("전체");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [status, setStatus] = useState("상담 기록을 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const detailSources = selectedSession?.latest_sources || [];
  const selectedSource = detailSources[selectedSourceIndex] || detailSources[0] || null;
  const previewUrl = selectedSource ? buildDocumentPreviewUrl(selectedSource) : "";

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    setSelectedSourceIndex(0);
  }, [selectedSession?.chat_session_id]);

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

  async function handleDownloadReport() {
    if (!selectedSession?.chat_session_id) return;
    setIsDownloading(true);
    try {
      await downloadSessionReport(selectedSession.chat_session_id);
      setStatus("PDF 리포트를 내려받았습니다.");
    } catch (error) {
      setStatus(`리포트 다운로드 실패: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="nomu-card relative min-h-[calc(100vh-18rem)] overflow-hidden p-5 sm:p-7 xl:p-9">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-black text-nomu-dark sm:text-3xl">상담내역</h1>
            <p className="mt-2 font-semibold text-[#6F806C]">이전 상담과 실제 근거 출처를 함께 다시 확인할 수 있어요.</p>
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
                      <p className="mt-1 max-w-md truncate text-xs font-semibold text-[#7B8878]">
                        {item.last_message_preview || item.summary || "상세 내용을 확인해보세요."}
                      </p>
                    </td>
                    <td className="px-5 py-5 font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4">
                      {item.latest_primary_citation || "-"}
                    </td>
                    <td className="px-5 py-5 font-semibold text-[#5D6B5A]">{item.latest_source_label || "출처 정보 확인 가능"}</td>
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

        <img src={mungiHistory} alt="책을 든 뭉이" className="pointer-events-none absolute -bottom-7 right-4 hidden w-36 object-contain md:block" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="nomu-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-black text-nomu-dark">상담 상세</h2>
            <p className="mt-1 text-sm font-semibold text-[#6F806C]">
              {selectedSession ? `${selectedSession.title || "상담"} · ${selectedSession.category || "AI 상담"}` : "상담 기록을 선택하면 상세를 보여드릴게요."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedSession && <span className="nomu-chip">{formatDate(selectedSession.updated_at || selectedSession.created_at)}</span>}
            {selectedSession ? (
              <button
                type="button"
                onClick={handleDownloadReport}
                disabled={isDownloading}
                className="rounded-full bg-nomu-dark px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              >
                {isDownloading ? "리포트 생성 중" : "PDF 리포트 다운로드"}
              </button>
            ) : null}
          </div>
        </div>

          {detailSources.length ? (
            <div className="mb-4 grid gap-3 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4">
              <div className="flex flex-wrap gap-2">
                {detailSources.map((source, index) => (
                  <button
                    key={`${source.chunk_id}-${index}`}
                    type="button"
                    onClick={() => setSelectedSourceIndex(index)}
                    className={`rounded-full px-3 py-2 text-xs font-black transition ${
                      selectedSourceIndex === index
                        ? "bg-nomu-soft text-nomu-dark ring-1 ring-nomu-line"
                        : "bg-white text-[#5C6A58] ring-1 ring-[#E6EDDF]"
                    }`}
                  >
                    {source.citation || source.title || "참조문서"}
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold leading-6 text-[#5C6A58]">주요 근거: {selectedSession.latest_primary_citation || "-"}</p>
            </div>
          ) : null}

          <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-3xl border border-nomu-line bg-[#F9FBF9] p-4">
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

        <aside className="nomu-card min-h-[520px] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-nomu-dark">
            <FileText size={16} />
            참조문서 뷰어
          </div>

          {selectedSource ? (
            <div className="grid gap-4">
              <div className="rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4">
                <p className="text-xs font-black text-[#7B8878]">선택한 근거</p>
                <h3 className="mt-2 text-base font-black text-nomu-dark">
                  {selectedSource.citation || selectedSource.title || "참조문서"}
                </h3>
                <p className="mt-1 text-xs font-semibold text-[#6F806C]">
                  {selectedSource.source_file || selectedSource.source_label || "출처 정보"}
                </p>
                <div className="mt-4 rounded-2xl border border-[#E8EEDC] bg-white p-4 text-sm font-semibold leading-6 text-[#3E4B3E]">
                  {selectedSource.excerpt || "발췌문 정보가 아직 없습니다."}
                </div>
                <div className="mt-4 grid gap-2 text-xs font-semibold text-[#657464]">
                  <p>조문: {selectedSource.article_number || "-"}</p>
                  <p>페이지: {selectedSource.page_number || "-"}</p>
                  <p>관련도: {selectedSource.relevance_score ?? "-"}</p>
                </div>
              </div>

              {previewUrl ? (
                <div className="overflow-hidden rounded-3xl border border-nomu-line bg-[#F3F8EC]">
                  <iframe
                    title={selectedSource.citation || selectedSource.title || "상담내역 문서 미리보기"}
                    src={previewUrl}
                    className="h-[420px] w-full bg-white"
                  />
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-nomu-line bg-[#FBFDF8] p-5 text-sm font-bold leading-6 text-[#7B8878]">
                  현재 근거는 PDF 원문 미리보기를 제공하지 않는 문서예요.
                </div>
              )}

              {previewUrl ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit rounded-full border border-nomu-line px-4 py-2 text-xs font-black text-nomu-dark"
                >
                  원문 크게 열기
                </a>
              ) : null}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-nomu-line bg-[#FBFDF8] p-5 text-sm font-bold leading-6 text-[#7B8878]">
              상담 기록을 선택하면 여기에서 참조문서와 PDF 미리보기를 확인할 수 있어요.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function buildDocumentPreviewUrl(source) {
  if (!source?.document_path) return "";
  const apiBase = getApiBase();
  const origin = apiBase.replace(/\/api\/v1$/, "");
  const pageFragment = source.page_number ? `#page=${source.page_number}` : "";
  return `${origin}${source.document_path}${pageFragment}`;
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
  if (value.includes("육아") || value.includes("출산") || value.includes("휴가") || value.includes("연차")) return "육아/휴가";
  if (value.includes("계약")) return "근로계약";
  return value || "AI 상담";
}
