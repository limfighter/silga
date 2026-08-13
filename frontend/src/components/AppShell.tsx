import { NavLink, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS: { path: string; label: string }[] = [
  { path: "/", label: "홈" },
  { path: "/search", label: "검색" },
  { path: "/build", label: "빌드" },
  { path: "/favorites", label: "즐겨찾기" },
  { path: "/history", label: "최근기록" },
  { path: "/stats", label: "통계" },
];

const TITLES: Record<string, string> = {
  "/": "홈",
  "/search": "검색",
  "/build": "빌드",
  "/favorites": "즐겨찾기",
  "/history": "최근기록",
  "/stats": "통계",
  "/settings": "설정",
};

// 탑바 현재 위치 — /build 하위는 목록/생성/상세가 전부 "빌드"로 뭉뚱그려져
// 있었는데, 상세에서 뒤로 갈 곳이 목록인지 생성인지 구분이 안 됐음
function titleFor(pathname: string): string {
  if (pathname === "/build/new") return "빌드 / 새 빌드";
  const detail = pathname.match(/^\/build\/(\d+)$/);
  if (detail) return `빌드 / #${detail[1]}`;
  if (pathname.startsWith("/build")) return "빌드";
  return TITLES[pathname] ?? "실가";
}

export default function AppShell() {
  const location = useLocation();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="side-top">
          <span className="brand-word">
            실<em>가</em>
          </span>
        </div>

        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <NavIcon path={item.path} />
              <span className="label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="side-bottom">
          <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <NavIcon path="/settings" />
            <span className="label">설정</span>
          </NavLink>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="tb-word">
            실<em>가</em>
          </span>
          <span className="tb-div" />
          <span className="tb-here">{titleFor(location.pathname)}</span>
        </div>
        <div className="page">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function NavIcon({ path }: { path: string }) {
  switch (path) {
    case "/":
      return (
        <svg viewBox="0 0 20 20" fill="none"><path d="M3 9.5 10 3l7 6.5M4.5 8.5V17h11V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      );
    case "/search":
      return (
        <svg viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="M16.5 16.5 13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      );
    case "/build":
      return (
        <svg viewBox="0 0 20 20" fill="none"><path d="M11.5 3.5 16.5 8.5 8 17H3v-5l8.5-8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M9.8 5.2 14.8 10.2" stroke="currentColor" strokeWidth="1.5" /></svg>
      );
    case "/favorites":
      return (
        <svg viewBox="0 0 20 20" fill="none"><path d="M10 3.6 12.2 8l4.9.7-3.5 3.4.8 4.8L10 14.6l-4.4 2.3.8-4.8L2.9 8.7l4.9-.7L10 3.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      );
    case "/history":
      return (
        <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M10 7v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M6.5 3.5 4 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      );
    case "/stats":
      return (
        <svg viewBox="0 0 20 20" fill="none"><path d="M3.5 16.5v-5M9 16.5V6M14.5 16.5v-8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M2.5 16.5h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      );
    case "/settings":
      return (
        <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" /><path d="M10 3.5v1.6M10 14.9v1.6M16.5 10h-1.6M5.1 10H3.5M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1M14.6 14.6l-1.1-1.1M6.5 6.5 5.4 5.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      );
    default:
      return null;
  }
}
