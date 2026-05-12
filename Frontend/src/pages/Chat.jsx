import { FileText, Heart, Scale, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";
import { getApiBase, resolveWorkingApiBase } from "../services/api.js";
import { deleteSession, fetchSessionDetail, fetchSessions, sendChat } from "../services/chatService.js";
import { store } from "../store.js";

const fallbackLawChips = ["근로기준법 제74조", "근로기준법 제60조", "고용평등법"];

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
  const threadRef = useRef(null);
  const inputRef = useRef(null);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );

  const lawChips = useMemo(() => {
    const fromMeta = latestMeta?.structured_answer?.cited_rules || latestMeta?.answer_traces?.map((trace) => trace.citation).filter(Boolean);
    const fromText = latestAssistant?.content?.match(/근로기준법\s*제?\s*\d+조|고용평등법\s*제?\s*\d+조/g);
    return [...new Set([...(fromMeta || []), ...(fromText || []), ...fallbackLawChips])].slice(0, 4);
  }, [latestAssistant, latestMeta]);

  const sourceItems = latestMeta?.structured_answer?.sources || latestMeta?.latest_sources || [];
  const selectedSource = sourceItems[selectedSourceIndex] || sourceItems[0] || null;
  const sourcePreviewUrl = selectedSource ? buildDocumentPreviewUrl(selectedSource) : "";

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadSessionDetail(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    setSelectedSourceIndex(0);
  }, [currentSessionId, latestMeta]);

  async function loadSessions() {
    try {
      await resolveWorkingApiBase();
      const data = await fetchSessions();
      setSessions(data.sessions || []);
      if (!currentSessionId && data.sessions?.[0]?.chat_session_id) {
        setCurrentSessionId(data.sessions[0].chat_session_id);
        store.currentSessionId = data.sessions[0].chat_session_id;
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

  async function handleSubmit(event) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    if (!store.token) {
      setStatus("상담 전송에는 로그인 상태가 필요합니다.");
      return;
    }

    const optimisticMessage = {
      message_id: `local-${Date.now()}`,
      role: "user",
      content,
    };

    setInput("");
    setMessages((prev) => [...prev, optimisticMessage]);
    setIsLoading(true);
    setStatus("뭉이가 법령과 문서를 확인하고 있어요...");

    try {
      const data = await sendChat({
        content,
        chat_session_id: currentSessionId || null,
        user_id: store.user?.user_id || null,
        company_size: mapEmpCountToCompanySize(store.user?.emp_count_type),
        industry: store.consultSettings?.industry || null,
        employment_type: store.consultSettings?.employment_type || null,
        employment_status: store.consultSettings?.employment_status || null,
      });
      store.currentSessionId = data.chat_session_id;
      setCurrentSessionId(data.chat_session_id);
      setLatestMeta(data);
      setMessages((prev) => [
        ...prev.filter((message) => message.message_id !== optimisticMessage.message_id),
        ...(data.messages || [data.latest_user_message, data.latest_assistant_message].filter(Boolean)),
      ]);
      setStatus(`${data.category || "AI 상담"} · 위험도 ${data.risk_level || "-"} · 답변 완료`);
      await loadSessions();
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.message_id !== optimisticMessage.message_id));
      setStatus(`상담 전송 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteSession(event, sessionId) {
    event.stopPropagation();
    if (!store.token) {
      setStatus("상담 삭제에는 로그인 상태가 필요합니다.");
      return;
    }

    try {
      await deleteSession(sessionId);
      const nextSessions = sessions.filter((session) => session.chat_session_id !== sessionId);
      setSessions(nextSessions);

      if (currentSessionId === sessionId) {
        const nextId = nextSessions[0]?.chat_session_id || "";
        store.currentSessionId = nextId;
        setCurrentSessionId(nextId);
        if (!nextId) {
          setMessages([]);
          setLatestMeta(null);
          setStatus("상담을 삭제했습니다.");
        }
      } else {
        setStatus("상담을 삭제했습니다.");
      }
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
    setStatus("새 상담을 시작해보세요.");
  }

  function applySuggestedQuestion(question) {
    setInput(question);
    inputRef.current?.focus();
    setStatus("예시 질문을 입력창에 넣었어요.");
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
              <MessageIcon /> 채팅
            </button>
            <button
              type="button"
              onClick={() => setActiveAsideTab("docs")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                activeAsideTab === "docs" ? "bg-white text-nomu-dark shadow-sm" : "text-[#657464]"
              }`}
            >
              <FileText size={17} /> 참조문서 뷰어
            </button>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3">
            <button type="button" onClick={startNewChat} className="rounded-2xl bg-nomu-dark px-4 py-3 text-sm font-extrabold text-white">
              새 상담
            </button>
            <div className="rounded-[1.4rem] border border-nomu-line bg-white/70 px-4 py-3">
              <p className="text-xs font-black text-[#6F806C]">최근 상담</p>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {sessions.length ? (
                sessions.map((session) => (
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
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            handleDeleteSession(event, session.chat_session_id);
                          }
                        }}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#91A08E] transition hover:bg-[#EEF4E9] hover:text-[#50624E]"
                        aria-label="상담 삭제"
                      >
                        <X size={12} />
                      </span>
                    </div>
                    <span className="mt-1 block truncate text-xs font-semibold">
                      {session.category || "AI 상담"} · {session.message_count || 0}건
                    </span>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-nomu-line bg-white p-3 text-center text-xs font-bold text-[#7B8878]">
                  저장된 상담이 없습니다.
                </p>
              )}
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
                  <p className="text-xs font-semibold text-[#6F806C]">법령 근거와 참조문서를 함께 확인할 수 있어요.</p>
                </div>
              </div>
              <span className="nomu-chip hidden sm:inline-flex">
                <ShieldCheck size={15} /> 법적 효력 없음
              </span>
            </div>

            <div ref={threadRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-[#F9FBF9] p-4 sm:p-6 xl:p-8">
              {messages.length === 0 && <IntroMessage onPickQuestion={applySuggestedQuestion} />}

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
                        <p className="mb-2 font-black text-nomu-dark">노무톡톡, 뭉이의 답변</p>
                        {message.content}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lawChips.map((chip) => (
                          <span key={chip} className="nomu-chip text-xs">
                            <Scale size={13} /> {chip}
                          </span>
                        ))}
                      </div>
                      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
                        {latestMeta?.answer_meta?.disclaimer ||
                          "이 답변은 일반적인 참고 정보이며 법적 효력이 없습니다. 구체적인 분쟁은 공인노무사 또는 관계 기관 상담을 권장합니다."}
                      </p>
                    </div>
                  </div>
                ),
              )}

              {isLoading && (
                <div className="flex gap-3">
                  <img src={mungiTalkCard} alt="뭉이" className="h-10 w-10 rounded-full bg-nomu-soft object-cover object-[50%_38%]" />
                  <div className="rounded-[1.5rem] rounded-tl-md border border-nomu-line bg-white px-5 py-4 text-sm font-bold text-[#6F806C] shadow-sm">
                    답변을 생성하고 있어요...
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-nomu-line bg-[#FBFDF8] px-4 py-2 text-xs font-bold text-[#6F806C]">{status}</div>
            <form onSubmit={handleSubmit} className="flex gap-2 border-t border-nomu-line bg-white p-4">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="메시지를 입력해주세요... 예: 출산휴가, 주휴수당, 해고"
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
          </div>

          <aside className="hidden min-h-0 border-l border-nomu-line bg-[#FBFDF8] xl:flex xl:flex-col">
            <div className="border-b border-nomu-line px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-black text-nomu-dark">
                <FileText size={16} />
                참조문서 뷰어
              </div>
              <p className="mt-1 text-xs font-semibold text-[#6F806C]">
                답변에 사용한 조문, 발췌문, 원문 미리보기를 확인할 수 있어요.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {sourceItems.length ? (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    {sourceItems.map((source, index) => (
                      <button
                        key={`${source.chunk_id}-${index}`}
                        type="button"
                        onClick={() => setSelectedSourceIndex(index)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selectedSourceIndex === index
                            ? "border-nomu-main bg-white text-nomu-dark shadow-sm"
                            : "border-[#E5ECDF] bg-white/70 text-[#5B6958]"
                        }`}
                      >
                        <p className="truncate text-sm font-black">{source.citation || source.title || "참조문서"}</p>
                        <p className="mt-1 truncate text-xs font-semibold">{source.source_file || source.source_label || "문서 출처"}</p>
                      </button>
                    ))}
                  </div>

                  {selectedSource && (
                    <div className="rounded-[1.6rem] border border-nomu-line bg-white p-4">
                      <p className="text-xs font-black text-[#7B8878]">선택한 근거</p>
                      <h3 className="mt-2 text-base font-black text-nomu-dark">
                        {selectedSource.citation || selectedSource.title || "참조문서"}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-[#6F806C]">
                        {selectedSource.source_file || selectedSource.source_label || "출처 정보"}
                      </p>
                      <div className="mt-4 rounded-2xl border border-[#E8EEDC] bg-[#F8FBF4] p-4 text-sm font-semibold leading-6 text-[#3E4B3E]">
                        {selectedSource.excerpt || "발췌문 정보가 아직 없습니다."}
                      </div>
                      {sourcePreviewUrl ? (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-[#DDE8D3] bg-[#F3F8EC]">
                          <iframe
                            title={selectedSource.citation || selectedSource.title || "참조문서 미리보기"}
                            src={sourcePreviewUrl}
                            className="h-72 w-full bg-white"
                          />
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-[#DDE8D3] bg-[#F8FBF4] px-4 py-5 text-xs font-bold leading-5 text-[#70806F]">
                          현재 근거는 PDF 원문 미리보기를 제공하지 않는 문서예요.
                        </div>
                      )}
                      <div className="mt-4 grid gap-2 text-xs font-semibold text-[#657464]">
                        <p>조문: {selectedSource.article_number || "-"}</p>
                        <p>페이지: {selectedSource.page_number || "-"}</p>
                        <p>관련도: {selectedSource.relevance_score ?? "-"}</p>
                        <p>주요 근거: {latestMeta?.latest_primary_citation || latestMeta?.structured_answer?.primary_citation || "-"}</p>
                      </div>
                      {sourcePreviewUrl ? (
                        <a
                          href={sourcePreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex rounded-full border border-nomu-line px-4 py-2 text-xs font-black text-nomu-dark"
                        >
                          원문 크게 열기
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-[1.6rem] border border-dashed border-nomu-line bg-white p-5 text-sm font-bold leading-6 text-[#7B8878]">
                  답변을 받으면 여기에서 근거 문서와 조문 발췌문을 볼 수 있어요.
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
  const pageFragment = source.page_number ? `#page=${source.page_number}` : "";
  return `${origin}${source.document_path}${pageFragment}`;
}

function MessageIcon() {
  return <Heart size={17} />;
}

function IntroMessage({ onPickQuestion }) {
  return (
    <div className="flex gap-3">
      <img src={mungiTalkCard} alt="뭉이" className="h-10 w-10 shrink-0 rounded-full bg-nomu-soft object-cover object-[50%_38%]" />
      <div className="max-w-[84%] space-y-2">
        <div className="rounded-[1.5rem] rounded-tl-md border border-nomu-line bg-white p-4 shadow-sm">
          <p className="mb-1 font-black text-nomu-dark">안녕하세요. 뭉이예요.</p>
          <p className="leading-7 text-[#374438]">
            임금, 주휴수당, 연차, 해고, 육아휴직처럼 회사에서 겪는 문제를 편하게 적어주세요. 필요한 사실관계를 먼저 정리하고 근거와 함께 답변할게요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPickQuestion("출산휴가 중 회사가 불이익을 주는데 어떻게 대응해야 하나요?")}
            className="nomu-chip text-xs"
          >
            출산휴가 대응
          </button>
          <button
            type="button"
            onClick={() => onPickQuestion("주휴수당을 받으려면 어떤 조건이 필요한가요?")}
            className="nomu-chip text-xs"
          >
            주휴수당 조건
          </button>
          <button
            type="button"
            onClick={() => onPickQuestion("필요한 서류가 뭐고 어떤 순서로 준비하면 되나요?")}
            className="nomu-chip text-xs"
          >
            필요한 서류
          </button>
        </div>
      </div>
    </div>
  );
}
