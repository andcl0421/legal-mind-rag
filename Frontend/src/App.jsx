import { Bell, Clock3, Home, LogIn, MessageCircle, UserPlus, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Chat from "./pages/Chat.jsx";
import History from "./pages/History.jsx";
import HomePage from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import MyPage from "./pages/MyPage.jsx";
import SignUp from "./pages/SignUp.jsx";
import mungiProfile from "./assets/mungi/mungi-profile-chat.png";
import { fetchMe } from "./services/authService.js";
import { clearAuth, store } from "./store.js";

const pages = {
  home: { label: "홈", icon: Home, component: HomePage },
  chat: { label: "상담실", icon: MessageCircle, component: Chat },
  history: { label: "상담내역", icon: Clock3, component: History },
  mypage: { label: "마이페이지", icon: UserRound, component: MyPage },
  login: { label: "로그인", icon: LogIn, component: Login },
  signup: { label: "회원가입", icon: UserPlus, component: SignUp },
};

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [authUser, setAuthUser] = useState(store.user);
  const ActiveComponent = useMemo(() => pages[activePage].component, [activePage]);
  const authed = Boolean(store.token);

  useEffect(() => {
    if (!store.token) return;
    fetchMe()
      .then((user) => setAuthUser(user))
      .catch(() => setAuthUser(null));
  }, []);

  function handleAuthSuccess(user) {
    setAuthUser(user || store.user);
    setActivePage("chat");
  }

  function handleLogout() {
    clearAuth();
    setAuthUser(null);
    setActivePage("home");
  }

  return (
    <div className="min-h-screen bg-nomu-bg pb-24 text-nomu-ink">
      <header className="sticky top-0 z-20 border-b border-nomu-line/80 bg-[#FAFCF7]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setActivePage("home")}
            className="flex min-w-0 items-center gap-2 rounded-full text-left"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-nomu-soft ring-1 ring-nomu-line">
              <img src={mungiProfile} alt="" className="h-full w-full object-cover object-top" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-[0] text-nomu-dark sm:text-xl">노무톡톡</span>
              <span className="hidden text-xs font-semibold text-[#6F806C] sm:block">AI 노무 상담 서비스</span>
            </span>
          </button>

          <nav className="hidden items-center gap-8 text-sm font-bold text-[#657464] md:flex">
            {Object.entries(pages)
              .filter(([key]) => (authed ? key !== "login" && key !== "signup" : key !== "mypage"))
              .map(([key, page]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivePage(key)}
                className={`border-b-2 px-1 py-3 transition ${
                  activePage === key ? "border-nomu-main text-nomu-dark" : "border-transparent hover:text-nomu-dark"
                }`}
              >
                {page.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-nomu-dark">
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-nomu-line bg-white">
              <Bell size={18} />
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-nomu-line bg-white">
              <UserRound size={18} />
            </button>
            {authed ? (
              <>
                <span className="hidden max-w-40 truncate rounded-full border border-nomu-line bg-white px-3 py-2 text-xs font-bold text-[#657464] sm:inline">
                  {authUser?.nickname || authUser?.email || "로그인됨"}
                </span>
                <button type="button" onClick={handleLogout} className="rounded-full bg-nomu-dark px-4 py-2 text-xs font-extrabold text-white">
                  로그아웃
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setActivePage("login")} className="rounded-full bg-nomu-dark px-4 py-2 text-xs font-extrabold text-white">
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <ActiveComponent goTo={setActivePage} onAuthSuccess={handleAuthSuccess} />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-nomu-line bg-white/95 px-3 py-2 shadow-[0_-10px_28px_rgba(52,83,56,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {Object.entries(pages)
            .filter(([key]) => ["home", "chat", "history", authed ? "mypage" : "login"].includes(key))
            .map(([key, page]) => {
            const Icon = page.icon;
            const isActive = activePage === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActivePage(key)}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition ${
                  isActive ? "bg-nomu-soft text-nomu-dark" : "text-[#7B8878]"
                }`}
              >
                <Icon size={19} />
                {page.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
