import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, LOGO_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState(token ? "loading" : "invalid");
  const [message, setMessage] = useState("");
  const { refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    api.post("/auth/verify-email", { token })
      .then(async (r) => {
        setMessage(r.data.message);
        setStatus("ok");
        await refresh();
      })
      .catch((err) => {
        setMessage(err.response?.data?.detail || "Lien invalide ou expiré.");
        setStatus("error");
      });
  }, [token, refresh]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-[#262626] bg-[#0A0A0A] p-8 text-center">
        <img src={LOGO_URL} alt="Ride'Up" className="h-14 mx-auto mb-4" />
        <h1 className="font-display text-2xl mb-4">CONFIRMATION EMAIL</h1>

        {status === "loading" && (
          <p className="text-gray-400">Vérification en cours...</p>
        )}
        {status === "ok" && (
          <>
            <p className="text-[#9AB8FF] mb-6">{message}</p>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-3 font-display tracking-wider"
            >
              ACCÉDER AU DASHBOARD
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-400 mb-6">{message}</p>
            <Link to="/dashboard" className="text-[#9AB8FF] text-sm hover:underline">
              Renvoyer l&apos;email depuis le dashboard
            </Link>
          </>
        )}
        {status === "invalid" && (
          <>
            <p className="text-gray-400 mb-6">Ce lien de confirmation n&apos;est pas valide.</p>
            <Link to="/login" className="text-[#9AB8FF] text-sm hover:underline">Se connecter</Link>
          </>
        )}
      </div>
    </div>
  );
}
