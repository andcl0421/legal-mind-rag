import { Bell, BriefcaseBusiness, FileArchive, Settings, UserRound } from "lucide-react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";

const menu = [
  { icon: UserRound, label: "내 정보" },
  { icon: Settings, label: "상담 설정" },
  { icon: Bell, label: "알림 설정" },
  { icon: FileArchive, label: "증거 보관함" },
];

const bars = [
  { label: "임금", value: 66, color: "bg-[#81C784]" },
  { label: "해고", value: 42, color: "bg-[#A5D6A7]" },
  { label: "휴가", value: 78, color: "bg-[#FFD166]" },
  { label: "계약", value: 55, color: "bg-[#8EC5FC]" },
  { label: "육아", value: 36, color: "bg-[#C7B9FF]" },
];

const badges = [
  { icon: "😊", label: "첫 상담" },
  { icon: "📄", label: "계약서 확인" },
  { icon: "💰", label: "임금 지킴이" },
  { icon: "🛡️", label: "권리 보호" },
  { icon: "💜", label: "꾸준한 기록" },
  { icon: "🌱", label: "성장 중" },
  { icon: "🏆", label: "해결 완료" },
  { icon: "🧾", label: "증거 정리" },
];

export default function MyPage() {
  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-5 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
      <aside className="nomu-card p-5 text-center sm:p-6 xl:p-8">
        <div className="mx-auto mb-4 grid h-32 w-32 place-items-center overflow-hidden rounded-full border border-nomu-line bg-[#F5FBF0]">
          <img src={mungiTalkCard} alt="뭉이 프로필" className="h-full w-full object-cover object-[50%_38%]" />
        </div>
        <h1 className="text-2xl font-black">몽이님</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-nomu-dark">당신의 권리를 지키는 중이에요</p>
        <div className="mt-5 rounded-3xl border border-nomu-line bg-[#F8FCF4] p-4 text-left">
          <p className="text-xs font-black text-[#6F806C]">사업장 기준</p>
          <p className="mt-1 flex items-center gap-2 font-extrabold">
            <BriefcaseBusiness size={17} className="text-nomu-dark" /> 5인 이상 사업장
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#7B8878]">최근 상담 18건, 알림 4건이 저장되어 있어요.</p>
        </div>
        <div className="mt-5 grid gap-2 text-left">
          {menu.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-extrabold text-[#52604F] transition hover:border-nomu-line hover:bg-nomu-soft"
            >
              <Icon size={18} className="text-nomu-dark" /> {label}
            </button>
          ))}
        </div>
      </aside>

      <div className="grid gap-5">
        <article className="nomu-card p-5 sm:p-6 xl:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">나의 권리 통계</h2>
              <p className="mt-1 text-sm font-semibold text-[#6F806C]">상담 근거와 키워드를 바탕으로 본 최근 관심 권리예요.</p>
            </div>
            <span className="nomu-chip">최근 30일</span>
          </div>
          <div className="grid gap-5 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4 sm:grid-cols-[minmax(0,1fr)_150px]">
            <div className="flex h-64 items-end gap-3 border-b border-l border-[#DCEAD9] px-3 pt-5">
              {bars.map((bar) => (
                <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-48 w-full items-end">
                    <div
                      className={`w-full rounded-t-2xl ${bar.color} shadow-sm transition hover:brightness-95`}
                      style={{ height: `${bar.value}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-[#647161]">{bar.label}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <Stat label="총 상담" value="18" />
              <Stat label="임금 관련" value="7" />
              <Stat label="휴가/육아" value="5" />
              <Stat label="해고/징계" value="3" />
            </div>
          </div>
        </article>

        <article className="nomu-card p-5 sm:p-6 xl:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black">나의 뱃지</h2>
            <button type="button" className="text-sm font-black text-nomu-dark">더보기</button>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {badges.map((badge, index) => (
              <div
                key={badge.label}
                className={`grid aspect-square place-items-center rounded-3xl border p-2 text-center ${
                  index < 6 ? "border-nomu-line bg-[#F8FCF4]" : "border-[#E7ECE3] bg-[#F4F4F2] opacity-60 grayscale"
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

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-nomu-line bg-white p-4">
      <p className="text-xs font-black text-[#74806F]">{label}</p>
      <p className="mt-1 text-2xl font-black text-nomu-dark">{value}</p>
    </div>
  );
}
