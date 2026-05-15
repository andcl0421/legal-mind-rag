import { FileText, Heart, Paperclip, Scale, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";
import { getApiBase, resolveWorkingApiBase } from "../services/api.js";
import { deleteSession, fetchSessionDetail, fetchSessions, sendChat } from "../services/chatService.js";
import { fetchEvidenceFilesByFilter } from "../services/evidenceService.js";
import { store } from "../store.js";

const fallbackLawChips = ["근로기준법 제43조", "근로기준법 제60조", "남녀고용평등법"];

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(store.currentSessionId || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("상담을 시작해보세요.");
  const [isLoading, setIsLoading] = useState(false);
  const [latestMeta, setLatestMeta] = useState(null);
  const [activeAsideTab, setActiveAsideTab] = useState("chat");
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState([]);
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [evidenceCategoryFilter, setEvidenceCategoryFilter] = useState("전체");
  const threadRef = useRef(null);
  const inputRef = useRef(null);

  const lawChips = useMemo(() => {
    const fromMeta = latestMeta?.structured_answer?.cited_rules || latestMeta?.answer_traces?.map((trace) => trace.citation).filter(Boolean);
    return [...new Set([...(fromMeta || []), ...fallbackLawChips])].slice(0, 4);
  }, [latestMeta]);

  const sourceItems = latestMeta?.structured_answer?.sources || latestMeta?.latest_sources || [];
  const selectedSource = sourceItems[selectedSourceIndex] || sourceItems[0] || null;
  const sourcePreviewUrl = useMemo(() => buildDocumentPreviewUrl(selectedSource), [selectedSource]);

  const evidenceCategories = useMemo(() => {
    const set = new Set(["전체"]);
    for (const item of evidenceFiles) set.add(item.category || "미분류");
    return [...set];
  }, [evidenceFiles]);

  const visibleEvidenceFiles = useMemo(() => {
    const q = evidenceSearch.trim().toLowerCase();
    return evidenceFiles.filter((file) => {
      const category = file.category || "미분류";
      const categoryMatch = evidenceCategoryFilter === "전체" || category === evidenceCategoryFilter;
      const nameMatch = !q || String(file.original_filename || "").toLowerCase().includes(q);
      return categoryMatch && nameMatch;
    });
  }, [evidenceFiles, evidenceSearch, evidenceCategoryFilter]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) loadSessionDetail(currentSessionId);
    loadEvidenceFiles();
  }, [currentSessionId]);

  useEffect(() => {
    if (activeAsideTab === "chat") {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading, activeAsideTab]);

  useEffect(() => {
    setSelectedSourceIndex(0);
  }, [currentSessionId, latestMeta]);

  async function loadSessions() {
    try {
      await resolveWorkingApiBase();
      const data = await fetchSessions();
      const next = data.sessions || [];
      setSessions(next);
      if (!currentSessionId && next[0]?.chat_session_id) {
        setCurrentSessionId(next[0].chat_session_id);
        store.currentSessionId = next[0].chat_session_id;
      }
      setStatus("상담 기록을 불러왔습니다.");
    } catch (error) {
      setStatus(`상담 기록 조회 실패: ${error.message}`);
    }
  }

  async function loadSessionDetail(sessionId) {
    try {
      const data = await fetchSessionDetail(sessionId);
      setMessages(data.messages || []);
      setLatestMeta(data);
      setStatus(`${data.category || "AI 상담"} · 위험도 ${data.risk_level || "-"}`);
    } catch (error) {
      setStatus(`상담 상세 조회 실패: ${error.message}`);
    }
  }

  async function loadEvidenceFiles() {
    try {
      const data = await fetchEvidenceFilesByFilter({ chatSessionId: currentSessionId || "" });
      setEvidenceFiles(data.items || []);
    } catch {
      setEvidenceFiles([]);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    if (!store.token) {
      setStatus("로그인 후 상담 전송이 가능합니다.");
      return;
    }

    const optimistic = { message_id: `local-${Date.now()}`, role: "user", content };
    setInput("");
    setMessages((prev) => [...prev, optimistic]);
    setIsLoading(true);
    setStatus("답변을 생성 중입니다...");

    try {
      const data = await sendChat({
        content,
        chat_session_id: currentSessionId || null,
        user_id: store.user?.user_id || null,
        company_size: mapEmpCountToCompanySize(store.user?.emp_count_type),
        industry: store.consultSettings?.industry || null,
        employment_type: store.consultSettings?.employment_type || null,
        employment_status: store.consultSettings?.employment_status || null,
        evidence_file_ids: selectedEvidenceIds,
      });
      store.currentSessionId = data.chat_session_id;
      setCurrentSessionId(data.chat_session_id);
      setLatestMeta(data);
      setMessages((prev) => [
        ...prev.filter((message) => message.message_id !== optimistic.message_id),
        ...(data.messages || [data.latest_user_message, data.latest_assistant_message].filter(Boolean)),
      ]);
      setStatus(`${data.category || "AI 상담"} · 위험도 ${data.risk_level || "-"} · 응답 완료`);
      setSelectedEvidenceIds([]);
      setShowEvidencePicker(false);
      setEvidenceSearch("");
      setEvidenceCategoryFilter("전체");
      await loadSessions();
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.message_id !== optimistic.message_id));
      setStatus(`상담 전송 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteSession(event, sessionId) {
    event.stopPropagation();
    if (!store.token) {
      setStatus("로그인 후 상담 삭제가 가능합니다.");
      return;
    }
    try {
      await deleteSession(sessionId);
      const next = sessions.filter((session) => session.chat_session_id !== sessionId);
      setSessions(next);
      if (currentSessionId === sessionId) {
        const nextId = next[0]?.chat_session_id || "";
        store.currentSessionId = nextId;
        setCurrentSessionId(nextId);
        if (!nextId) {
          setMessages([]);
          setLatestMeta(null);
        }
      }
      setStatus("상담을 삭제했습니다.");
    } catch (error) {
      setStatus(`상담 삭제 실패: ${error.message}`);
    }
  }

  function startNewChat() {
    store.currentSessionId = null;
    setCurrentSessionId("");
    setMessages([]);
    setLatestMeta(null);
    setSelectedSourceIndex(0);
    setSelectedEvidenceIds([]);
    setShowEvidencePicker(false);
    setEvidenceSearch("");
    setEvidenceCategoryFilter("전체");
    setStatus("새 상담을 시작해보세요.");
    setActiveAsideTab("chat");
  }

  function toggleEvidenceSelection(fileId) {
    setSelectedEvidenceIds((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]));
  }

  return (
    <section className="nomu-card h-[calc(100vh-8.5rem)] overflow-hidden">
      <div className="grid h-full min-h-0 bg-white lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-hidden border-r border-nomu-line bg-[#F4FAEC] p-5 lg:flex lg:flex-col">
          <div className="mb-5 flex items-center gap-2 font-black text-nomu-dark">
            <img src={mungiTalkCard} alt="" className="h-9 w-9 rounded-full object-cover object-[50%_38%]" />
            AI 상담실
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setActiveAsideTab("chat")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold ${
                activeAsideTab === "chat" ? "bg-white text-nomu-dark shadow-sm" : "text-[#657464]"
              }`}
            >
              <Heart size={17} /> 채팅
            </button>
            <button
              type="button"
              onClick={() => setActiveAsideTab("docs")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                activeAsideTab === "docs" ? "bg-white text-nomu-dark shadow-sm" : "text-[#657464]"
              }`}
            >
              <FileText size={17} /> 참고문서 뷰어
            </button>
          </div>
          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3">
            <button type="button" onClick={startNewChat} className="rounded-2xl bg-nomu-dark px-4 py-3 text-sm font-extrabold text-white">
              새 상담
            </button>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {sessions.map((session) => (
                <button
                  key={session.chat_session_id}
                  type="button"
                  onClick={() => {
                    store.currentSessionId = session.chat_session_id;
                    setCurrentSessionId(session.chat_session_id);
                  }}
                  className={`w-full rounded-[1.4rem] border px-4 py-3 text-left transition ${
                    currentSessionId === session.chat_session_id
                      ? "border-nomu-main bg-white text-nomu-dark shadow-sm"
                      : "border-[#E5ECDF] bg-[#FBFDF8] text-[#657464]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="block min-w-0 truncate text-sm font-black">{session.title || "노무 상담"}</strong>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => handleDeleteSession(event, session.chat_session_id)}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#91A08E] transition hover:bg-[#EEF4E9] hover:text-[#50624E]"
                    >
                      <X size={12} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-nomu-line bg-[#FBFDF8] px-5 py-4">
              <div className="flex items-center gap-3">
                <img src={mungiTalkCard} alt="뭉이" className="h-11 w-11 rounded-full bg-nomu-soft object-cover object-[50%_38%] ring-1 ring-nomu-line" />
                <div>
                  <h1 className="font-black text-nomu-dark">노무톡톡 AI 상담실</h1>
                  <p className="text-xs font-semibold text-[#6F806C]">근거 법령과 참고문서를 함께 확인합니다.</p>
                </div>
              </div>
              <span className="nomu-chip hidden sm:inline-flex">
                <ShieldCheck size={15} /> 법적 효력 없음
              </span>
            </div>

            {activeAsideTab === "chat" ? (
              <>
                <div ref={threadRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-[#F9FBF9] p-4 sm:p-6 xl:p-8">
                  {messages.map((message) =>
                    message.role === "user" ? (
                      <div key={message.message_id} className="flex justify-end">
                        <div className="max-w-[78%] whitespace-pre-wrap rounded-[1.5rem] rounded-tr-md bg-nomu-main px-5 py-4 font-semibold leading-7 text-white shadow-sm">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div key={message.message_id} className="flex gap-3">
                        <img src={mungiTalkCard} alt="뭉이" className="h-10 w-10 shrink-0 rounded-full bg-nomu-soft object-cover object-[50%_38%]" />
                        <div className="max-w-[88%] space-y-3">
                          <div className="whitespace-pre-wrap rounded-[1.5rem] rounded-tl-md border border-nomu-line bg-white p-4 leading-7 text-[#374438] shadow-sm">
                            {message.content}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(lawChips.length ? lawChips : fallbackLawChips).map((chip) => (
                              <span key={chip} className="nomu-chip text-xs">
                                <Scale size={13} /> {chip}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                  {isLoading && <div className="text-sm font-bold text-[#6F806C]">답변 생성 중...</div>}
                </div>

                <div className="border-t border-nomu-line bg-[#FBFDF8] px-4 py-2 text-xs font-bold text-[#6F806C]">{status}</div>

                {selectedEvidenceIds.length > 0 ? (
                  <div className="border-t border-nomu-line bg-[#F7FAF3] px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedEvidenceIds.map((id) => {
                        const file = evidenceFiles.find((item) => item.user_file_id === id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleEvidenceSelection(id)}
                            className="inline-flex items-center gap-1 rounded-full border border-nomu-line bg-white px-3 py-1 text-xs font-bold text-[#4B5C49]"
                          >
                            <Paperclip size={12} />
                            {(file?.original_filename || `file-${id}`).slice(0, 24)}
                            <X size={12} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {showEvidencePicker ? (
                  <div className="border-t border-nomu-line bg-white px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-black text-[#52604F]">첨부할 증거 파일 선택</p>
                      <button
                        type="button"
                        onClick={() => setShowEvidencePicker(false)}
                        className="rounded-full border border-nomu-line px-2 py-1 text-xs font-bold text-[#667564]"
                      >
                        닫기
                      </button>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {evidenceCategories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setEvidenceCategoryFilter(category)}
                          className={`rounded-full px-3 py-1 text-[11px] font-black ${
                            evidenceCategoryFilter === category
                              ? "bg-nomu-soft text-nomu-dark ring-1 ring-nomu-line"
                              : "bg-[#F5F8F1] text-[#6F806C]"
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={evidenceSearch}
                      onChange={(event) => setEvidenceSearch(event.target.value)}
                      placeholder="파일명 검색"
                      className="mb-2 w-full rounded-xl border border-nomu-line bg-[#F8FBF5] px-3 py-2 text-xs font-semibold outline-none focus:border-nomu-main"
                    />
                    <div className="max-h-28 space-y-2 overflow-y-auto pr-1">
                      {visibleEvidenceFiles.length ? (
                        visibleEvidenceFiles.map((file) => (
                          <label
                            key={file.user_file_id}
                            className="flex items-center gap-2 rounded-xl border border-[#E5ECDF] px-3 py-2 text-xs font-semibold text-[#4B5C49]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEvidenceIds.includes(file.user_file_id)}
                              onChange={() => toggleEvidenceSelection(file.user_file_id)}
                            />
                            <span className="truncate">{file.original_filename}</span>
                            <span className="ml-auto rounded-full bg-[#F3F8EC] px-2 py-0.5 text-[10px] font-black text-[#5A6A57]">
                              {file.category || "미분류"}
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="text-xs font-semibold text-[#7B8878]">조건에 맞는 파일이 없습니다.</p>
                      )}
                    </div>
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="flex gap-2 border-t border-nomu-line bg-white p-4">
                  <button
                    type="button"
                    onClick={() => setShowEvidencePicker((prev) => !prev)}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-nomu-line bg-[#F6F8F4] text-[#51614F]"
                    title="증거 첨부"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="메시지를 입력해주세요..."
                    className="min-w-0 flex-1 rounded-full border border-nomu-line bg-[#F6F8F4] px-5 py-3 text-sm outline-none focus:border-nomu-main focus:ring-4 focus:ring-nomu-soft"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-nomu-main text-white shadow-lg shadow-green-100 disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </>
            ) : (
              <div className="min-h-0 flex-1 bg-[#F4FAEC] p-4 sm:p-6 xl:p-8">
                {sourcePreviewUrl ? (
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#D7E9CE] bg-white shadow-[0_14px_30px_rgba(130,168,127,0.15)]">
                    <div className="flex items-center gap-2 border-b border-[#E2EFDA] bg-[#F8FDF4] px-4 py-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#F6C56B]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#9FD79A]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#8FC2F4]" />
                      <p className="ml-2 text-xs font-black text-[#5F725D]">뭉이 참고문서 뷰어</p>
                    </div>
                    <iframe
                      key={`${selectedSource?.chunk_id || "doc"}-${selectedSource?.page_number || "p"}-${selectedSource?.article_number || "a"}`}
                      title="참고문서 미리보기"
                      src={sourcePreviewUrl}
                      className="min-h-0 flex-1 w-full bg-white"
                    />
                  </div>
                ) : (
                  <div className="grid h-full place-items-center rounded-[2rem] border border-dashed border-[#CFE3C4] bg-white/90 text-center text-sm font-semibold text-[#6F806C]">
                    <div>
                      <p>표시할 참고문서가 없습니다.</p>
                      <p className="mt-2">상담 답변을 받으면 참고문서를 확인할 수 있어요.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="hidden min-h-0 border-l border-nomu-line bg-[#FBFDF8] xl:flex xl:flex-col">
            <div className="border-b border-nomu-line px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-black text-nomu-dark">
                <FileText size={16} />
                참고문서 목록
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {sourceItems.length ? (
                <div className="grid gap-2">
                  {sourceItems.map((source, index) => (
                    <button
                      key={`${source.chunk_id || "source"}-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedSourceIndex(index);
                        setActiveAsideTab("docs");
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        selectedSourceIndex === index ? "border-nomu-main bg-white text-nomu-dark shadow-sm" : "border-[#E5ECDF] bg-white/70 text-[#5B6958]"
                      }`}
                    >
                      <p className="truncate text-sm font-black">{source.citation || source.title || "참고문서"}</p>
                      <p className="mt-1 truncate text-xs font-semibold">{source.source_file || source.source_label || "문서 출처"}</p>
                      <p className="mt-2 line-clamp-2 text-left text-[11px] font-semibold leading-5 text-[#6F806C]">
                        {source.excerpt || "요약 정보가 없습니다."}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.6rem] border border-dashed border-nomu-line bg-white p-5 text-sm font-bold leading-6 text-[#7B8878]">
                  아직 참고문서가 없습니다.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function mapEmpCountToCompanySize(empCountType) {
  switch (empCountType) {
    case "UNDER_5":
      return "5인 미만";
    case "OVER_5":
      return "5인 이상";
    case "OVER_30":
      return "30인 이상";
    case "OVER_300":
      return "300인 이상";
    default:
      return null;
  }
}

function buildDocumentPreviewUrl(source) {
  if (!source?.document_path) return "";
  const apiBase = getApiBase();
  const origin = apiBase.replace(/\/api\/v1$/, "");
  const page = source.page_number ? Number(source.page_number) : null;
  const article = String(source.article_number || "")
    .replace(/\s+/g, "")
    .trim();
  const params = new URLSearchParams();
  if (page && Number.isFinite(page)) params.set("page", String(page));
  if (article) params.set("search", article);
  const hash = params.toString();
  return `${origin}${source.document_path}${hash ? `#${hash}` : ""}`;
}
