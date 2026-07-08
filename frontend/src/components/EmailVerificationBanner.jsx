import { useState } from "react";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function EmailVerificationBanner() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!user || user.email_verified !== false) return null;

  const resend = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post("/auth/resend-verification");
      setMsg(r.data.message);
      await refresh();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Erreur lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#9AB8FF]/10 border-b border-[#9AB8FF]/30 px-4 py-3 text-sm text-center">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <Mail className="h-4 w-4 text-[#9AB8FF] shrink-0" />
        <span className="text-gray-200">
          Confirme ton email pour activer l&apos;analyse vidéo et les abonnements.
        </span>
        <button
          type="button"
          onClick={resend}
          disabled={loading}
          className="text-[#9AB8FF] font-display text-xs tracking-wider hover:underline disabled:opacity-50"
        >
          {loading ? "ENVOI..." : "RENVOYER L'EMAIL"}
        </button>
      </div>
      {msg && <p className="text-xs text-gray-400 mt-2">{msg}</p>}
    </div>
  );
}
