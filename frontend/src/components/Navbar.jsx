import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";
import { loginPath } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin";
import { LogOut, User, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { to: "/", label: "ACCUEIL", testId: "nav-home" },
  { to: "/pricing", label: "ABONNEMENTS", testId: "nav-pricing" },
  { to: "/coach", label: "COACH", testId: "nav-coach" },
  { to: "/courses", label: "COURS", testId: "nav-courses" },
  { to: "/video-analysis", label: "ANALYSE", testId: "nav-analysis" },
  { to: "/spot-recommender", label: "SPOTS", testId: "nav-spots" },
  { to: "/spots-kitesurf", label: "CATALOGUE", testId: "nav-catalog" },
  { to: "/meilleurs-spots-kitesurf-weekend", label: "WEEK-END", testId: "nav-weekend", badge: "LIVE" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close menu when route changes
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleLogin = () => navigate(loginPath("/dashboard"));

  const isLanding = location.pathname === "/";

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl ${isLanding ? "bg-black/40" : "bg-black/80"} border-b border-white/10`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center">
          <img src={LOGO_URL} alt="Ride’Up" className="h-12 md:h-16 object-contain" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 font-display text-sm tracking-wider">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} data-testid={l.testId} className="hover:text-[#9AB8FF] transition relative">
              {l.label}
              {l.badge && (
                <span className="absolute -top-1.5 -right-3 text-[7px] tracking-widest bg-[#9AB8FF] text-white px-1 py-0.5">{l.badge}</span>
              )}
            </Link>
          ))}
          {user && (
            <Link to="/dashboard" data-testid="nav-dashboard" className="hover:text-[#9AB8FF] transition">DASHBOARD</Link>
          )}
          {isSiteAdmin(user) && (
            <Link to="/admin" data-testid="nav-admin" className="hover:text-[#9AB8FF] transition text-[#9AB8FF]/80">ADMIN</Link>
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0A0A0A] border border-[#262626]">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="h-6 w-6 rounded-full" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="text-xs">{user.name}</span>
                {user.plan && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AB8FF] px-2 py-0.5 border border-[#9AB8FF]/50">
                    {user.plan}
                  </span>
                )}
              </div>
              <button
                data-testid="logout-btn"
                onClick={async () => { await logout(); navigate("/"); }}
                className="p-2 hover:bg-[#9AB8FF]/10 transition"
                aria-label="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <button
              data-testid="login-btn"
              onClick={handleLogin}
              className="hidden sm:block bg-[#9AB8FF] text-white px-4 md:px-5 py-2.5 font-display text-sm tracking-wider hover:bg-[#7A9CE8] transition"
            >
              CONNEXION
            </button>
          )}

          {/* Hamburger (mobile only) */}
          <button
            data-testid="nav-toggle"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 hover:bg-[#9AB8FF]/10 transition border border-[#262626]"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu (slide-down) */}
      <div
        data-testid="nav-mobile-menu"
        className={`md:hidden bg-black border-t border-[#262626] overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
          open ? "max-h-[calc(100vh-80px)] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="px-6 py-4 flex flex-col font-display tracking-wider">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`mobile-${l.testId}`}
              className="py-3 border-b border-[#1a1a1a] text-lg hover:text-[#9AB8FF] transition flex items-center justify-between"
            >
              <span>{l.label}</span>
              {l.badge && (
                <span className="text-[9px] tracking-widest bg-[#9AB8FF] text-white px-1.5 py-0.5">{l.badge}</span>
              )}
            </Link>
          ))}
          {user && (
            <Link to="/dashboard" data-testid="mobile-nav-dashboard" className="py-3 border-b border-[#1a1a1a] text-lg hover:text-[#9AB8FF] transition">
              DASHBOARD
            </Link>
          )}
          {isSiteAdmin(user) && (
            <Link to="/admin" data-testid="mobile-nav-admin" className="py-3 border-b border-[#1a1a1a] text-lg text-[#9AB8FF] hover:text-white transition">
              ADMIN SITE
            </Link>
          )}
          {!user && (
            <button
              data-testid="mobile-login-btn"
              onClick={handleLogin}
              className="mt-4 bg-[#9AB8FF] text-white px-5 py-3 font-display tracking-wider hover:bg-[#7A9CE8] transition"
            >
              CONNEXION
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
