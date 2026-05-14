import { ArrowRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import mungiHome from "../assets/mungi/mungi-home.png";

const exampleCards = [
  {
    tag: "# 실업급여",
    question: "실업급여 신청 방법을 알려주세요",
    answer:
      "퇴사 후 거주지 관할 고용센터에 방문해 실업을 신고하고 수급자격 인정을 신청합니다. 가입기간과 이직 사유에 따라 지급 요건이 달라질 수 있어요.",
  },
  {
    tag: "# 근로시간",
    question: "법정 근로시간 한도에 대해 알려주세요",
    answer:
      "상시근로자 5인 이상 사업장은 휴게시간 제외 주 40시간, 1일 8시간이 원칙입니다. 합의된 연장근로는 법정 한도 내에서 운영됩니다.",
  },
  {
    tag: "# 휴게시간",
    question: "휴게시간은 반드시 줘야 하나요?",
    answer:
      "근로시간이 4시간이면 30분 이상, 8시간이면 1시간 이상의 휴게시간을 근로시간 도중에 부여해야 합니다. 휴게시간은 자유롭게 이용할 수 있어야 합니다.",
  },
  {
    tag: "# 퇴직금",
    question: "퇴직금과 평균임금은 어떻게 계산하나요?",
    answer:
      "평균임금은 산정사유 발생일 이전 3개월 임금총액을 그 기간의 총일수로 나눠 계산합니다. 퇴직금은 계속근로 1년에 대해 30일분 평균임금을 기준으로 산정합니다.",
  },
];

export default function Home({ goTo }) {
  const [activeCalc, setActiveCalc] = useState("severance");
  const [sevMonthly, setSevMonthly] = useState(3000000);
  const [sevYears, setSevYears] = useState(1);
  const [minHourly, setMinHourly] = useState(10030);
  const [minHours, setMinHours] = useState(209);
  const [leaveMonthly, setLeaveMonthly] = useState(12);
  const [leaveUsed, setLeaveUsed] = useState(0);
  const [uiMonths, setUiMonths] = useState(6);
  const [uiRate, setUiRate] = useState(60);

  const severance = useMemo(() => Math.max(0, sevMonthly) * Math.max(0, sevYears), [sevMonthly, sevYears]);
  const minimumPay = useMemo(() => Math.max(0, minHourly) * Math.max(0, minHours), [minHourly, minHours]);
  const annualLeave = useMemo(() => Math.max(0, leaveMonthly - leaveUsed), [leaveMonthly, leaveUsed]);
  const unemployment = useMemo(() => Math.max(0, sevMonthly) * (Math.max(0, uiRate) / 100) * Math.max(0, uiMonths), [sevMonthly, uiRate, uiMonths]);

  return (
    <div className="grid gap-5">
      <section className="nomu-card relative min-h-[46vh] overflow-hidden bg-gradient-to-br from-[#F6FBED] via-white to-[#EEF7E5] p-6 sm:p-8 lg:p-12">
        <div className="grid h-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_520px]">
          <div className="relative z-10">
            <span className="nomu-chip mb-5">
              <Sparkles size={16} /> 일반 근로자를 위한 AI 노무 상담
            </span>
            <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-[0] text-[#172618] sm:text-5xl xl:text-6xl">
              오늘도 일터에서 고군분투한
              <br />
              당신의 권리를 찾아요.
              <br />
              <span className="text-nomu-dark">노무톡톡.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[#637060] xl:text-lg xl:leading-8">
              법령, 가이드라인, 판례를 근거로 임금, 해고, 휴가, 근로계약 질문을 차분하게 정리해주는 AI 상담 도구입니다.
            </p>
            <button
              type="button"
              onClick={() => goTo("chat")}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-nomu-main px-7 py-3.5 text-base font-extrabold text-white shadow-lg shadow-green-200 transition hover:bg-[#6AB66F]"
            >
              상담 시작하기 <ArrowRight size={19} />
            </button>
          </div>

          <div className="relative mx-auto grid w-full max-w-[420px] place-items-center xl:max-w-[500px]">
            <div className="absolute inset-8 rounded-full bg-[#DDF2C7] blur-2xl" />
            <img src={mungiHome} alt="뭉이 캐릭터" className="relative z-10 w-full object-contain drop-shadow-xl" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {exampleCards.map((item) => (
          <article key={item.tag} className="nomu-card bg-[#F7FAF3] p-5 sm:p-6">
            <h3 className="text-3xl font-black tracking-[0] text-[#4A5FD1]">{item.tag}</h3>
            <div className="mt-4 rounded-3xl bg-[#EAF4E2] px-4 py-4 text-lg font-semibold leading-8 text-[#304132]">{item.question}</div>
            <p className="mt-4 text-sm font-bold text-[#5F725D]">뭉이 도우미</p>
            <div className="mt-3 rounded-3xl bg-white px-4 py-4 text-base font-semibold leading-7 text-[#2D3330] ring-1 ring-[#E3ECD9]">{item.answer}</div>
          </article>
        ))}
      </section>

      <section className="nomu-card p-5 sm:p-6 xl:p-8">
        <h2 className="text-2xl font-black text-nomu-dark">노동 계산기</h2>
        <p className="mt-2 text-sm font-semibold text-[#6F806C]">참고용 간편 계산입니다. 실제 지급/인정 조건은 상담에서 확인해 주세요.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <CalcTab label="퇴직금 계산기" value="severance" active={activeCalc} onClick={setActiveCalc} />
          <CalcTab label="최저임금 계산기" value="minimum" active={activeCalc} onClick={setActiveCalc} />
          <CalcTab label="연차휴가 계산기" value="leave" active={activeCalc} onClick={setActiveCalc} />
          <CalcTab label="실업급여 계산기" value="unemployment" active={activeCalc} onClick={setActiveCalc} />
        </div>

        <div className="mt-4 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4">
          {activeCalc === "severance" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <NumberField label="월 평균임금(원)" value={sevMonthly} onChange={setSevMonthly} />
              <NumberField label="근속연수(년)" value={sevYears} onChange={setSevYears} />
              <Result label="예상 퇴직금" value={`${formatNumber(severance)} 원`} />
            </div>
          ) : null}

          {activeCalc === "minimum" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <NumberField label="시급(원)" value={minHourly} onChange={setMinHourly} />
              <NumberField label="월 근로시간(시간)" value={minHours} onChange={setMinHours} />
              <Result label="월 환산 임금" value={`${formatNumber(minimumPay)} 원`} />
            </div>
          ) : null}

          {activeCalc === "leave" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <NumberField label="발생 연차(일)" value={leaveMonthly} onChange={setLeaveMonthly} />
              <NumberField label="사용 연차(일)" value={leaveUsed} onChange={setLeaveUsed} />
              <Result label="남은 연차" value={`${formatNumber(annualLeave)} 일`} />
            </div>
          ) : null}

          {activeCalc === "unemployment" ? (
            <div className="grid gap-3 md:grid-cols-4">
              <NumberField label="기준 월임금(원)" value={sevMonthly} onChange={setSevMonthly} />
              <NumberField label="지급개월(개월)" value={uiMonths} onChange={setUiMonths} />
              <NumberField label="지급률(%)" value={uiRate} onChange={setUiRate} />
              <Result label="예상 총액" value={`${formatNumber(unemployment)} 원`} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CalcTab({ label, value, active, onClick }) {
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-full px-4 py-2 text-sm font-extrabold ${isActive ? "bg-nomu-soft text-nomu-dark ring-1 ring-nomu-line" : "bg-[#F5F8F1] text-[#6F806C]"}`}
    >
      {label}
    </button>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="grid gap-1 rounded-2xl border border-nomu-line bg-white p-3">
      <span className="text-xs font-black text-[#6F806C]">{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="rounded-xl border border-nomu-line bg-[#F7FAF3] px-3 py-2 text-sm font-semibold outline-none focus:border-nomu-main"
      />
    </label>
  );
}

function Result({ label, value }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-nomu-line bg-[#EAF4E2] p-3">
      <span className="text-xs font-black text-[#5F725D]">{label}</span>
      <strong className="text-lg font-black text-[#2D3330]">{value}</strong>
    </div>
  );
}

function formatNumber(value) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString("ko-KR");
}
