import { ArrowRight, Lock, Mail } from "lucide-react";
import { useState } from "react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";
import { login } from "../services/authService.js";

export default function Login({ goTo, onAuthSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("로그인하면 상담 저장과 이어서 질문하기를 사용할 수 있어요.");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("로그인 중입니다...");
    try {
      const data = await login(form);
      setStatus("로그인되었습니다.");
      onAuthSuccess?.(data.user);
    } catch (error) {
      setStatus(`로그인 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-5 lg:grid-cols-[minmax(0,1fr)_480px]">
      <div className="nomu-card overflow-hidden bg-gradient-to-br from-[#F6FBED] via-white to-[#EEF7E5] p-7 sm:p-10">
        <span className="nomu-chip mb-5">노무톡톡 계정</span>
        <h1 className="text-3xl font-black leading-tight sm:text-5xl">
          다시 오셨네요.
          <br />
          이어서 권리를 확인해요.
        </h1>
        <p className="mt-5 max-w-2xl font-semibold leading-7 text-[#657464]">
          로그인 후 AI 상담실에서 질문을 보내면 백엔드 상담 세션에 저장되고, 상담내역에서도 다시 확인할 수 있습니다.
        </p>
        <img src={mungiTalkCard} alt="노무톡톡 캐릭터" className="mx-auto mt-8 max-h-[440px] w-full object-contain" />
      </div>

      <form onSubmit={handleSubmit} className="nomu-card flex flex-col justify-center p-6 sm:p-8">
        <h2 className="text-2xl font-black">로그인</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-[#6F806C]">{status}</p>

        <label className="mt-7 grid gap-2 text-sm font-black text-[#52604F]">
          이메일
          <span className="flex items-center gap-2 rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3">
            <Mail size={18} className="text-nomu-dark" />
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full bg-transparent outline-none"
              placeholder="worker@example.com"
            />
          </span>
        </label>

        <label className="mt-4 grid gap-2 text-sm font-black text-[#52604F]">
          비밀번호
          <span className="flex items-center gap-2 rounded-2xl border border-nomu-line bg-[#F8FCF4] px-4 py-3">
            <Lock size={18} className="text-nomu-dark" />
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full bg-transparent outline-none"
              placeholder="8자 이상"
            />
          </span>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-nomu-main px-6 py-3.5 font-extrabold text-white shadow-lg shadow-green-100 disabled:opacity-60"
        >
          {isLoading ? "로그인 중" : "로그인"} <ArrowRight size={18} />
        </button>
        <button type="button" onClick={() => goTo("signup")} className="mt-4 text-sm font-black text-nomu-dark">
          계정이 없나요? 회원가입
        </button>
      </form>
    </section>
  );
}
