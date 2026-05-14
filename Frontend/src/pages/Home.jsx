import { ArrowRight, Sparkles } from "lucide-react";
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
    </div>
  );
}
