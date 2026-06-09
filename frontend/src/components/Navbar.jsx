import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";
import { LogOut, User } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const isLanding = location.pathname === "/";

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl ${isLanding ? "bg-black/40" : "bg-black/80"} border-b border-white/10`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center -my-2">
          <img src={LOGO_URL} alt="RIDEMIND" className="h-24 w-24 md:h-32 md:w-32 object-contain" style={{ mixBlendMode: "screen" }} />
        </Link>

        <nav className="hidden md:flex items-center gap-8 font-display text-sm tracking-wider">
          <Link to="/" data-testid="nav-home" className="hover:text-[#1E6BFF] transition">ACCUEIL</Link>
          <Link to="/pricing" data-testid="nav-pricing" className="hover:text-[#1E6BFF] transition">ABONNEMENTS</Link>
          {user && (
            <>
              <Link to="/dashboard" data-testid="nav-dashboard" className="hover:text-[#1E6BFF] transition">DASHBOARD</Link>
              <Link to="/courses" data-testid="nav-courses" className="hover:text-[#1E6BFF] transition">COURS</Link>
              <Link to="/video-analysis" data-testid="nav-analysis" className="hover:text-[#1E6BFF] transition">ANALYSE</Link>
              <Link to="/spot-recommender" data-testid="nav-spots" className="hover:text-[#1E6BFF] transition">SPOTS</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0A0A0A] border border-[#262626]">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="h-6 w-6 rounded-full" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="text-xs">{user.name}</span>
                {user.plan && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E6BFF] px-2 py-0.5 border border-[#1E6BFF]/50">
                    {user.plan}
                  </span>
                )}
              </div>
              <button
                data-testid="logout-btn"
                onClick={async () => { await logout(); navigate("/"); }}
                className="p-2 hover:bg-[#1E6BFF]/10 transition"
                aria-label="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              data-testid="login-btn"
              onClick={handleLogin}
              className="bg-[#1E6BFF] text-white px-5 py-2.5 font-display tracking-wider hover:bg-[#1751C4] transition"
            >
              CONNEXION
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
