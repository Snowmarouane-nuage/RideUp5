import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { api, LOGO_URL } from "@/lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Lien invalide. Redemande un email depuis la page de connexion.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Lien expiré ou invalide.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center p-8 border border-[#262626] bg-[#0A0A0A]">
          <h1 className="font-display text-2xl mb-4">LIEN INVALIDE</h1>
          <p className="text-gray-400 mb-6">Ce lien de réinitialisation n&apos;est pas valide.</p>
          <Link to="/login" className="text-[#9AB8FF] font-display text-sm tracking-wider">RETOUR À LA CONNEXION</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 pt-20 pb-12">
      <div className="w-full max-w-md border border-[#262626] bg-[#0A0A0A] p-8">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Ride'Up" className="h-14 mx-auto mb-4" />
          <h1 className="font-display text-3xl">NOUVEAU MOT DE PASSE</h1>
        </div>

        {success ? (
          <div className="text-center">
            <p className="text-[#9AB8FF] mb-4">Mot de passe mis à jour. Redirection...</p>
            <Link to="/login" className="text-sm text-gray-400 hover:text-white">Se connecter</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="NOUVEAU MOT DE PASSE">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="auth-input"
              />
            </Field>
            <Field label="CONFIRMER">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="auth-input"
              />
            </Field>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white py-4 font-display tracking-wider disabled:opacity-50"
            >
              {loading ? "..." : "ENREGISTRER"}
            </button>
          </form>
        )}
      </div>
      <style>{`.auth-input{width:100%;background:#000;border:1px solid #262626;padding:12px 14px;outline:none;color:#fff}.auth-input:focus{border-color:#9AB8FF}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-display text-xs tracking-wider mb-2 text-gray-300">{label}</label>
      {children}
    </div>
  );
}
