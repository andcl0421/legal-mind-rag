import { ArrowRight, Building2, Lock, Mail, MapPin, UserRound } from "lucide-react";
import { useState } from "react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";
import { signup } from "../services/authService.js";

const companyOptions = [
  { value: "UNDER_5", label: "5인 미만" },
  { value: "OVER_5", label: "5인 이상" },
  { value: "OVER_30", label: "30인 이상" },
  { value: "OVER_300", label: "300인 이상" },
];

export default function SignUp({ goTo, onAuthSuccess }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    nickname: "",
    emp_count_type: "OVER_5",
    region_code: "",
  });
  const [status, setStatus] = useState("사업장 규모를 입력하면 더 알맞은 상담 맥락을 만들 수 있어요.");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("회원가입 중입니다...");
    try {
      const data = await signup({
        ...form,
        nickname: form.nickname || null,
        region_code: form.region_code || null,
      });
      setStatus("회원가입이 완료되었습니다.");
      onAuthSuccess?.(data.user);
    } catch (error) {
      setStatus(`회원가입 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-5 lg:grid-cols-[480px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="nomu-card flex flex-col justify-center p-6 sm:p-8">
        <h1 className="text-2xl font-black">회원가입</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-[#6F806C]">{status}</p>

        <Field icon={Mail} label="이메일">
          <input type="email" required value={form.email} onChange={(event) => update("email", event.target.value)} className="w-full bg-transparent outline-none" placeholder="worker@example.com" />
        </Field>
        <Field icon={Lock} label="비밀번호">
          <input type="password" required minLength={8} value={form.password} onChange={(event) => update("password", event.target.value)} className="w-full bg-transparent outline-none" placeholder="8자 이상" />
        </Field>
        <Field icon={UserRound} label="닉네임">
          <input value={form.nickname} onChange={(event) => update("nickname", event.target.value)} className="w-full bg-transparent outline-none" placeholder="몽이님" />
        </Field>
        <Field icon={Building2} label="사업장 규모">
          <select value={form.emp_count_type} onChange={(event) => update("emp_count_type", event.target.value)} className="w-full bg-transparent outline-none">
            {companyOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field icon={MapPin} label="지역 코드">
          <input value={form.region_code} onChange={(event) => update("region_code", event.target.value)} className="w-full bg-transparent outline-none" placeholder="선택 입력 예: SEOUL" />
        </Field>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-nomu-main px-6 py-3.5 font-extrabold text-white shadow-lg shadow-green-100 disabled:opacity-60"
        >
          {isLoading ? "가입 중" : "회원가입"} <ArrowRight size={18} />
        </button>
        <button type="button" onClick={() => goTo("login")} className="mt-4 text-sm font-black text-nomu-dark">
          이미 계정이 있나요? 로그인
        </button>
      </form>

      <div className="nomu-card overflow-hidden bg-gradient-to-br from-[#F6FBED] via-white to-[#EEF7E5] p-7 sm:p-10">
        <span className="nomu-chip mb-5">처음 오셨나요?</span>
        <h2 className="text-3xl font-black leading-tight sm:text-5xl">
          일터 고민을
          <br />
          안전하게 기록해요.
        </h2>
        <p className="mt-5 max-w-2xl font-semibold leading-7 text-[#657464]">
          계정을 만들면 상담 내용, 근거 법령, 자동 알림을 한 곳에서 관리할 수 있습니다.
        </p>
        <img src={mungiTalkCard} alt="노무톡톡 캐릭터" className="mx-auto mt-8 max-h-[500px] w-full object-contain" />
      </div>
    </section>
  );

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
}

function Field({ icon: Icon, label, children }) {
  return (
    <label className="mt-4 grid gap-2 text-sm font-black text-[#52604F]">
      {label}
      <span className="flex items-center gap-2 rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3">
        <Icon size={18} className="text-nomu-dark" />
        {children}
      </span>
    </label>
  );
}
