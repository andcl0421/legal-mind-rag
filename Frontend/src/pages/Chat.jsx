import { FileText, Heart, Scale, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";
import { resolveWorkingApiBase } from "../services/api.js";
import { fetchSessionDetail, fetchSessions, sendChat } from "../services/chatService.js";
import { store } from "../store.js";

const fallbackLawChips = ["근로기준법 제17조", "근로기준법 제55조", "고용노동부 행정해석"];

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(store.currentSessionId || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("상담을 시작해보세요.");
  const [isLoading, setIsLoading] = useState(false);
  const [latestMeta, setLatestMeta] = useState(null);
  const threadRef = useRef(null);

  const latestAssistant = useMemo(() => [...messages].reverse().find((message) => message.role === "assistant"), [messages]);
  const lawChips = useMemo(() => {
    const fromMeta = latestMeta?.structured_answer?.cited_rules || latestMeta?.answer_traces?.map((trace) => trace.citation).filter(Boolean);
    const fromText = latestAssistant?.content?.match(/근로기준법\s*제?\d+조|남녀고용평등법\s*제?\d+조|고용보험법\s*제?\d+조/g);
    return [...new Set([...(fromMeta || []), ...(fromText || []), ...fallbackLawChips])].slice(0, 4);
  }, [latestAssistant, latestMeta]);

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
      setLatestMeta(null);
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
      setStatus("상담 전송에는 백엔드 인증 토큰이 필요합니다. 로그인 후 다시 시도해주세요.");
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
      });
      store.currentSessionId = data.chat_session_id;
      setCurrentSessionId(data.chat_session_id);
      setLatestMeta(data);
      setMessages((prev) => [
        ...prev.filter((message) => message.message_id !== optimisticMessage.message_id),
        ...(data.messages || [data.latest_user_message, data.latest_assistant_message].filter(Boolean)),
      ]);
      setStatus(`${data.category || "AI 상담"} · 위험도 ${data.risk_level || "-"} · 답변완료`);
      await loadSessions();
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.message_id !== optimisticMessage.message_id));
      setStatus(`상담 전송 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
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
            <button className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-nomu-dark shadow-sm">
              <MessageIcon /> 채팅
            </button>
            <button className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-[#657464]">
              <FileText size={17} /> 참조문서 뷰어
            </button>
          </div>
          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                store.currentSessionId = null;
                setCurrentSessionId("");
                setMessages([]);
                setLatestMeta(null);
                setStatus("새 상담을 시작해보세요.");
              }}
              className="rounded-2xl bg-nomu-dark px-4 py-3 text-sm font-extrabold text-white"
            >
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
                    <strong className="block truncate text-sm font-black">{session.title || "노무 상담"}</strong>
                    <span className="mt-1 block truncate text-xs font-semibold">{session.category || "AI 상담"} · {session.message_count || 0}건</span>
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

        <div className="flex min-h-0 h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-nomu-line bg-[#FBFDF8] px-5 py-4">
            <div className="flex items-center gap-3">
              <img src={mungiTalkCard} alt="뭉이" className="h-11 w-11 rounded-full bg-nomu-soft object-cover object-[50%_38%] ring-1 ring-nomu-line" />
              <div>
                <h1 className="font-black">노무톡톡 AI 상담실</h1>
                <p className="text-xs font-semibold text-[#6F806C]">법령 기반 답변과 근거를 함께 확인해요</p>
              </div>
            </div>
            <span className="nomu-chip hidden sm:inline-flex">
              <ShieldCheck size={15} /> 참고용 안내
            </span>
          </div>

          <div ref={threadRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-[#F9FBF9] p-4 sm:p-6 xl:p-8">
            {messages.length === 0 && <IntroMessage />}

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
                        "이 답변은 AI가 제공하는 참고용 정보이며 법적 효력이 없습니다. 구체적인 분쟁은 공인노무사 또는 관련 기관 상담을 권장합니다."}
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
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="메시지를 입력해주세요... 예: 주휴수당 기준, 육아휴직 급여"
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
      </div>
    </section>
  );
}

function MessageIcon() {
  return <Heart size={17} />;
}

function IntroMessage() {
  return (
    <div className="flex gap-3">
      <img src={mungiTalkCard} alt="뭉이" className="h-10 w-10 shrink-0 rounded-full bg-nomu-soft object-cover object-[50%_38%]" />
      <div className="max-w-[84%] space-y-2">
        <div className="rounded-[1.5rem] rounded-tl-md border border-nomu-line bg-white p-4 shadow-sm">
          <p className="mb-1 font-black text-nomu-dark">안녕하세요, 뭉이예요.</p>
          <p className="leading-7 text-[#374438]">
            임금, 주휴수당, 연차, 해고, 육아휴직처럼 일터에서 생기는 고민을 설명해주세요. 필요한 사실관계를 먼저 정리한 뒤 근거와 함께 답변할게요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="nomu-chip text-xs">요약 알림</button>
          <button className="nomu-chip text-xs">필요서류 알림</button>
          <button className="nomu-chip text-xs">action_items 추출</button>
        </div>
      </div>
    </div>
  );
}
