import { ArrowRight, ClipboardCheck, MessageCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import mungiHome from "../assets/mungi/mungi-home.png";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";

const moodItems = [
  { emoji: "😊", label: "좋음" },
  { emoji: "😐", label: "보통" },
  { emoji: "😟", label: "고민중" },
  { emoji: "😥", label: "힘들어요" },
  { emoji: "😡", label: "너무 불편해요" },
];

export default function Home({ goTo }) {
  const [selectedMood, setSelectedMood] = useState("보통");
  return (
    <div className="grid gap-5">
      <section className="nomu-card relative min-h-[46vh] overflow-hidden bg-gradient-to-br from-[#F6FBED] via-white to-[#EEF7E5] p-6 sm:p-8 lg:p-12">
        <div className="grid h-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_520px]">
          <div className="relative z-10">
            <span className="nomu-chip mb-5">
              <Sparkles size={16} /> 일반 근로자를 위한 AI 노무 상담
            </span>
            <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-[0] text-[#172618] sm:text-5xl xl:text-6xl">
              오늘도 일터에서 고민분투한
              <br />
              당신의 권리를 찾아요.
              <br />
              <span className="text-nomu-dark">노무톡톡.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[#637060] xl:text-lg xl:leading-8">
              법령, 가이드라인, 판례를 근거로 임금, 해고, 휴가, 근로계약 질문을 차분하게 정리해주는 AI 상담 도구예요.
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

      <section className="grid gap-4 md:grid-cols-[1.08fr_0.92fr] xl:gap-6">
        <article className="nomu-card p-5 sm:p-6 xl:p-8">
          <div className="mb-5 flex items-center gap-2">
            <ClipboardCheck className="text-nomu-dark" size={21} />
            <h2 className="text-xl font-black">오늘의 노동 체크</h2>
          </div>
          <p className="mb-5 text-sm font-semibold text-[#6F806C]">오늘의 감정을 선택해 일터 상태를 기록해보세요.</p>
          <div className="grid grid-cols-5 gap-2">
            {moodItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setSelectedMood(item.label)}
                className={`grid min-h-24 place-items-center rounded-3xl border p-2 transition ${
                  selectedMood === item.label
                    ? "border-nomu-main bg-nomu-soft"
                    : "border-nomu-line bg-[#FBFDF8] hover:border-nomu-main hover:bg-nomu-soft"
                }`}
              >
                <span className="text-3xl">{item.emoji}</span>
                <span className="mt-2 text-center text-xs font-bold text-[#566453]">{item.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold text-[#6F806C]">선택됨: {selectedMood}</p>
        </article>

        <article className="nomu-card relative overflow-hidden p-5 sm:p-6 xl:p-8">
          <div className="relative z-10 max-w-[68%]">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-nomu-soft text-nomu-dark">
              <MessageCircle size={22} />
            </div>
            <h2 className="text-xl font-black">노무톡톡과 대화하기</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6F806C]">
              지금 겪는 상황을 그대로 적어보세요. 질문을 정리하고 근거 법령까지 함께 확인해드려요.
            </p>
            <button
              type="button"
              onClick={() => goTo("chat")}
              className="mt-5 rounded-full bg-nomu-dark px-5 py-3 text-sm font-extrabold text-white"
            >
              상담하러 가기
            </button>
          </div>
          <img
            src={mungiTalkCard}
            alt="서류를 든 뭉이"
            className="absolute bottom-0 right-0 h-full w-[42%] object-contain object-bottom sm:w-[46%] xl:w-[44%]"
          />
        </article>
      </section>
    </div>
  );
}
