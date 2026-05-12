import { Bell, BriefcaseBusiness, CheckCheck, FileArchive, Settings, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";
import { fetchAlerts, createAlert, markAlertRead } from "../services/alertService.js";
import { fetchMe, updateMe } from "../services/authService.js";
import { fetchSessions } from "../services/chatService.js";
import { setConsultSettings, store } from "../store.js";

const menu = [
  { icon: UserRound, label: "내 정보" },
  { icon: Settings, label: "상담 설정" },
  { icon: Bell, label: "알림 설정" },
  { icon: FileArchive, label: "증거 보관함" },
];

const badges = [
  { icon: "🌱", label: "첫 상담", unlocked: true },
  { icon: "📄", label: "계약서 확인", unlocked: true },
  { icon: "💰", label: "임금 지킴이", unlocked: true },
  { icon: "🛡️", label: "권리 보호", unlocked: true },
  { icon: "🗂️", label: "꼼꼼한 기록", unlocked: true },
  { icon: "📌", label: "직장 적응", unlocked: true },
  { icon: "✅", label: "해결 완료", unlocked: false },
  { icon: "📚", label: "증거 정리", unlocked: false },
];

const sourceFilters = [
  { label: "전체", value: "" },
  { label: "자동", value: "chat_auto" },
  { label: "미읽음", value: "unread" },
];

const menuDescriptions = {
  "내 정보": "닉네임, 사업장 규모, 지역 코드를 수정하면 기본 프로필에 반영됩니다.",
  "상담 설정": "업종, 고용형태, 재직상태를 저장해두면 다음 상담부터 자동으로 반영됩니다.",
  "알림 설정": "자동 생성된 요약 알림과 필요서류 알림을 확인합니다.",
  "증거 보관함": "계약서, 급여명세서처럼 나중에 필요한 자료를 정리할 수 있는 공간입니다.",
};

const empCountOptions = [
  { value: "UNDER_5", label: "5인 미만" },
  { value: "OVER_5", label: "5인 이상" },
  { value: "OVER_30", label: "30인 이상" },
  { value: "OVER_300", label: "300인 이상" },
];

const employmentTypeOptions = ["정규직", "계약직", "파견", "일용직", "아르바이트"];
const employmentStatusOptions = ["재직 중", "퇴사 예정", "퇴사", "휴직 중"];

export default function MyPage() {
  const [activeMenu, setActiveMenu] = useState("내 정보");
  const [profile, setProfile] = useState(store.user);
  const [sessions, setSessions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertFilter, setAlertFilter] = useState("");
  const [status, setStatus] = useState("마이페이지 정보를 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingConsult, setIsSavingConsult] = useState(false);
  const [isAlertSubmitting, setIsAlertSubmitting] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nickname: "",
    emp_count_type: "OVER_5",
    region_code: "",
  });
  const [consultForm, setConsultForm] = useState({
    industry: "",
    employment_type: "",
    employment_status: "",
  });
  const [alertForm, setAlertForm] = useState({ title: "", content: "" });

  const stats = useMemo(() => buildStats(sessions), [sessions]);
  const unreadCount = useMemo(() => alerts.filter((item) => !item.is_read).length, [alerts]);
  const autoAlertCount = useMemo(() => alerts.filter((item) => item.source === "chat_auto").length, [alerts]);

  useEffect(() => {
    if (!store.token) {
      setStatus("로그인 후 마이페이지를 사용할 수 있어요.");
      setIsLoading(false);
      return;
    }
    setConsultForm({
      industry: store.consultSettings?.industry || "",
      employment_type: store.consultSettings?.employment_type || "",
      employment_status: store.consultSettings?.employment_status || "",
    });
    loadPage();
  }, []);

  useEffect(() => {
    if (!store.token) return;
    loadAlerts(alertFilter);
  }, [alertFilter]);

  async function loadPage() {
    setIsLoading(true);
    try {
      const [me, sessionData] = await Promise.all([fetchMe(), fetchSessions()]);
      setProfile(me);
      setProfileForm({
        nickname: me.nickname || "",
        emp_count_type: me.emp_count_type || "OVER_5",
        region_code: me.region_code || "",
      });
      setSessions(sessionData.sessions || []);
      setStatus("마이페이지 정보를 불러왔습니다.");
      await loadAlerts(alertFilter);
    } catch (error) {
      setStatus(`마이페이지 조회 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAlerts(filterValue = "") {
    try {
      const unreadOnly = filterValue === "unread";
      const source = filterValue === "chat_auto" ? "chat_auto" : "";
      const data = await fetchAlerts(unreadOnly, source);
      setAlerts(data.items || []);
      setStatus(`알림 ${data.items?.length || 0}건을 불러왔습니다.`);
    } catch (error) {
      setStatus(`알림 조회 실패: ${error.message}`);
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setIsSavingProfile(true);
    try {
      const updated = await updateMe({
        nickname: profileForm.nickname.trim() || null,
        emp_count_type: profileForm.emp_count_type,
        region_code: profileForm.region_code.trim() || null,
      });
      setProfile(updated);
      setStatus("내 정보를 저장했습니다.");
    } catch (error) {
      setStatus(`내 정보 저장 실패: ${error.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleConsultSubmit(event) {
    event.preventDefault();
    setIsSavingConsult(true);
    try {
      setConsultSettings({
        industry: consultForm.industry.trim(),
        employment_type: consultForm.employment_type,
        employment_status: consultForm.employment_status,
      });
      setStatus("상담 기본 조건을 저장했습니다. 다음 상담부터 자동 반영됩니다.");
    } finally {
      setIsSavingConsult(false);
    }
  }

  async function handleAlertSubmit(event) {
    event.preventDefault();
    if (!alertForm.title.trim() || !alertForm.content.trim()) {
      setStatus("알림 제목과 내용을 입력해주세요.");
      return;
    }

    setIsAlertSubmitting(true);
    try {
      await createAlert({
        title: alertForm.title.trim(),
        content: alertForm.content.trim(),
      });
      setAlertForm({ title: "", content: "" });
      setStatus("알림을 생성했습니다.");
      await loadAlerts(alertFilter);
    } catch (error) {
      setStatus(`알림 생성 실패: ${error.message}`);
    } finally {
      setIsAlertSubmitting(false);
    }
  }

  async function handleReadAlert(alertId) {
    try {
      await markAlertRead(alertId);
      setStatus("알림을 읽음 처리했습니다.");
      await loadAlerts(alertFilter);
    } catch (error) {
      setStatus(`읽음 처리 실패: ${error.message}`);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-5 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
      <aside className="nomu-card p-5 text-center sm:p-6 xl:p-8">
        <div className="mx-auto mb-4 grid h-32 w-32 place-items-center overflow-hidden rounded-full border border-nomu-line bg-[#F5FBF0]">
          <img src={mungiTalkCard} alt="뭉이 프로필" className="h-full w-full object-cover object-[50%_38%]" />
        </div>
        <h1 className="text-2xl font-black text-nomu-dark">{profile?.nickname || "노무톡톡 사용자"}</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-nomu-dark">{profile?.email || "로그인 후 내 정보를 확인할 수 있어요."}</p>
        <div className="mt-5 rounded-3xl border border-nomu-line bg-[#F8FCF4] p-4 text-left">
          <p className="text-xs font-black text-[#6F806C]">사업장 기준</p>
          <p className="mt-1 flex items-center gap-2 font-extrabold text-nomu-dark">
            <BriefcaseBusiness size={17} className="text-nomu-dark" /> {formatEmpCount(profile?.emp_count_type)}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#7B8878]">
            최근 상담 {stats.total}건, 알림 {alerts.length}건, 미읽음 {unreadCount}건이 있어요.
          </p>
        </div>
        <div className="mt-5 grid gap-2 text-left">
          {menu.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveMenu(label)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-extrabold transition ${
                activeMenu === label
                  ? "border-nomu-line bg-nomu-soft text-nomu-dark"
                  : "border-transparent text-[#52604F] hover:border-nomu-line hover:bg-nomu-soft"
              }`}
            >
              <Icon size={18} className="text-nomu-dark" /> {label}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4 text-left">
          <p className="text-xs font-black text-[#6F806C]">{activeMenu}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#52604F]">{menuDescriptions[activeMenu]}</p>
        </div>
        <div className="mt-4 rounded-3xl border border-nomu-line bg-white p-4 text-left">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-[#6F806C]">상태</p>
            <button
              type="button"
              onClick={loadPage}
              disabled={isLoading}
              className="rounded-full border border-nomu-line px-3 py-1 text-[11px] font-black text-nomu-dark disabled:opacity-60"
            >
              새로고침
            </button>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#52604F]">{status}</p>
        </div>
      </aside>

      <div className="grid gap-5">
        <article className="nomu-card p-5 sm:p-6 xl:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-nomu-dark">나의 권리 통계</h2>
              <p className="mt-1 text-sm font-semibold text-[#6F806C]">실제 상담 카테고리를 바탕으로 최근 기록을 정리했어요.</p>
            </div>
            <span className="nomu-chip">최근 상담 {stats.total}건</span>
          </div>
          <div className="grid gap-5 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4 sm:grid-cols-[minmax(0,1fr)_170px]">
            <div className="flex h-64 items-end gap-3 border-b border-l border-[#DCEAD9] px-3 pt-5">
              {stats.bars.map((bar) => (
                <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-48 w-full items-end">
                    <div className={`w-full rounded-t-2xl ${bar.color} shadow-sm`} style={{ height: `${bar.height}%` }} />
                  </div>
                  <span className="text-center text-xs font-black text-[#647161]">{bar.label}</span>
                  <span className="text-[11px] font-bold text-[#89A186]">{bar.count}건</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <Stat label="총 상담" value={String(stats.total)} />
              <Stat label="자동 알림" value={String(autoAlertCount)} />
              <Stat label="미읽음" value={String(unreadCount)} />
              <Stat label="최근 카테고리" value={stats.topCategory} compact />
            </div>
          </div>
        </article>

        <div className="grid gap-5 xl:grid-cols-2">
          <article className="nomu-card p-5 sm:p-6 xl:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-nomu-dark">내 정보 수정</h2>
              <span className="text-xs font-black text-[#7B8878]">백엔드 프로필 저장</span>
            </div>
            <form onSubmit={handleProfileSubmit} className="grid gap-4">
              <Field label="닉네임">
                <input
                  value={profileForm.nickname}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, nickname: event.target.value }))}
                  className="w-full rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
                  placeholder="노무톡톡 사용자"
                />
              </Field>
              <Field label="사업장 규모">
                <select
                  value={profileForm.emp_count_type}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, emp_count_type: event.target.value }))}
                  className="w-full rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
                >
                  {empCountOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="지역 코드">
                <input
                  value={profileForm.region_code}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, region_code: event.target.value.toUpperCase() }))}
                  className="w-full rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
                  placeholder="예: SEOUL"
                  maxLength={10}
                />
              </Field>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="rounded-full bg-nomu-dark px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {isSavingProfile ? "저장 중" : "내 정보 저장"}
              </button>
            </form>
          </article>

          <article className="nomu-card p-5 sm:p-6 xl:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-nomu-dark">상담 기본 조건</h2>
              <span className="text-xs font-black text-[#7B8878]">다음 상담부터 자동 반영</span>
            </div>
            <form onSubmit={handleConsultSubmit} className="grid gap-4">
              <Field label="업종">
                <input
                  value={consultForm.industry}
                  onChange={(event) => setConsultForm((prev) => ({ ...prev, industry: event.target.value }))}
                  className="w-full rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
                  placeholder="예: 제조업, IT, 서비스업"
                />
              </Field>
              <Field label="고용형태">
                <select
                  value={consultForm.employment_type}
                  onChange={(event) => setConsultForm((prev) => ({ ...prev, employment_type: event.target.value }))}
                  className="w-full rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
                >
                  <option value="">선택 안 함</option>
                  {employmentTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="재직상태">
                <select
                  value={consultForm.employment_status}
                  onChange={(event) => setConsultForm((prev) => ({ ...prev, employment_status: event.target.value }))}
                  className="w-full rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
                >
                  <option value="">선택 안 함</option>
                  {employmentStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="submit"
                disabled={isSavingConsult}
                className="rounded-full bg-nomu-main px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {isSavingConsult ? "저장 중" : "상담 조건 저장"}
              </button>
            </form>
          </article>
        </div>

        <article className="nomu-card p-5 sm:p-6 xl:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black text-nomu-dark">알림 관리</h2>
            <div className="flex flex-wrap gap-2">
              {sourceFilters.map((filter) => (
                <button
                  key={filter.value || "all"}
                  type="button"
                  onClick={() => setAlertFilter(filter.value)}
                  className={`rounded-full px-3 py-2 text-xs font-black transition ${
                    alertFilter === filter.value
                      ? "bg-nomu-soft text-nomu-dark ring-1 ring-nomu-line"
                      : "bg-[#F5F8F1] text-[#6F806C]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleAlertSubmit} className="grid gap-3 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4">
            <input
              type="text"
              value={alertForm.title}
              onChange={(event) => setAlertForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="알림 제목"
              className="rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
            />
            <textarea
              value={alertForm.content}
              onChange={(event) => setAlertForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="알림 내용"
              rows={3}
              className="rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-nomu-main"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[#6F806C]">상담 후 생성된 자동 알림도 여기서 함께 확인할 수 있어요.</p>
              <button
                type="submit"
                disabled={isAlertSubmitting}
                className="rounded-full bg-nomu-dark px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {isAlertSubmitting ? "생성 중" : "수동 알림 생성"}
              </button>
            </div>
          </form>

          <div className="mt-4 grid gap-3">
            {alerts.length ? (
              alerts.map((alert) => (
                <article key={alert.user_notif_id} className="rounded-3xl border border-nomu-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-nomu-dark">{alert.title}</h3>
                        <span className="nomu-chip text-[11px]">{alert.source === "chat_auto" ? "자동 생성" : "수동 생성"}</span>
                        {!alert.is_read && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">미읽음</span>}
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#52604F]">{alert.content}</p>
                      <p className="mt-2 text-xs font-semibold text-[#7B8878]">
                        {formatDateTime(alert.created_at)}
                        {alert.chat_session_id ? ` · 상담 연결 ${String(alert.chat_session_id).slice(0, 8)}` : ""}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <button
                        type="button"
                        onClick={() => handleReadAlert(alert.user_notif_id)}
                        className="inline-flex items-center gap-2 rounded-full border border-nomu-line px-4 py-2 text-xs font-black text-nomu-dark"
                      >
                        <CheckCheck size={14} /> 읽음 처리
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-nomu-line bg-white p-8 text-center text-sm font-bold text-[#7B8878]">
                아직 표시할 알림이 없어요.
              </div>
            )}
          </div>
        </article>

        <article className="nomu-card p-5 sm:p-6 xl:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black text-nomu-dark">나의 뱃지</h2>
            <span className="text-sm font-black text-[#6F806C]">
              {badges.filter((badge) => badge.unlocked).length}/{badges.length}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className={`grid aspect-square place-items-center rounded-3xl border p-2 text-center ${
                  badge.unlocked ? "border-nomu-line bg-[#F8FCF4]" : "border-[#E7ECE3] bg-[#F4F4F2] opacity-60 grayscale"
                }`}
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className="mt-1 text-[11px] font-black leading-tight text-[#61715B]">{badge.label}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function buildStats(sessions) {
  const groups = [
    { label: "임금", key: "wage", color: "bg-[#81C784]" },
    { label: "해고", key: "dismissal", color: "bg-[#A5D6A7]" },
    { label: "휴가", key: "leave", color: "bg-[#FFD166]" },
    { label: "계약", key: "contract", color: "bg-[#8EC5FC]" },
    { label: "기타", key: "other", color: "bg-[#C7B9FF]" },
  ];

  const counts = { wage: 0, dismissal: 0, leave: 0, contract: 0, other: 0 };
  for (const session of sessions) {
    counts[categorizeSession(session.category)] += 1;
  }

  const max = Math.max(1, ...Object.values(counts));
  const bars = groups.map((group) => ({
    label: group.label,
    count: counts[group.key],
    color: group.color,
    height: Math.max(14, Math.round((counts[group.key] / max) * 100)),
  }));
  const top = [...bars].sort((a, b) => b.count - a.count)[0];

  return {
    total: sessions.length,
    topCategory: top?.count ? top.label : "-",
    bars,
  };
}

function categorizeSession(category) {
  const value = String(category || "");
  if (value.includes("임금") || value.includes("수당") || value.includes("퇴직")) return "wage";
  if (value.includes("해고") || value.includes("징계") || value.includes("권고")) return "dismissal";
  if (value.includes("육아") || value.includes("출산") || value.includes("휴가") || value.includes("연차")) return "leave";
  if (value.includes("계약")) return "contract";
  return "other";
}

function formatEmpCount(value) {
  switch (value) {
    case "UNDER_5":
      return "5인 미만 사업장";
    case "OVER_5":
      return "5인 이상 사업장";
    case "OVER_30":
      return "30인 이상 사업장";
    case "OVER_300":
      return "300인 이상 사업장";
    default:
      return "사업장 정보 미설정";
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-[#52604F]">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, compact = false }) {
  return (
    <div className="rounded-2xl border border-nomu-line bg-white p-4">
      <p className="text-xs font-black text-[#74806F]">{label}</p>
      <p className={`mt-1 font-black text-nomu-dark ${compact ? "text-base leading-6" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
