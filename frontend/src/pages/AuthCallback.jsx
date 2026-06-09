import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const session_id = match ? decodeURIComponent(match[1]) : null;
    if (!session_id) {
      navigate("/");
      return;
    }
    (async () => {
      try {
        const r = await api.post("/auth/session", { session_id });
        setUser(r.data);
        // Clean hash
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard");
      } catch (e) {
        navigate("/");
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <img src={LOGO_URL} alt="RIDEMIND" className="h-20 mx-auto animate-pulse" />
        <div className="font-display text-2xl mt-6">CONNEXION EN COURS...</div>
        <div className="text-gray-400 text-sm mt-2">Préparation de ta session</div>
      </div>
    </div>
  );
}
