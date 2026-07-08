import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { api, LOGO_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        const r = await api.post("/auth/forgot-password", { email });
        setSuccess(r.data.message);
        setLoading(false);
        return;
      }
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email, password } : { email, password, name };
      const r = await api.post(path, payload);
      setUser(r.data);
      if (mode === "register" && r.data.verification_sent) {
        navigate("/dashboard");
        return;
      }
      navigate(redirect);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(" · "));
      } else {
        setError(detail || "Erreur de connexion. Vérifie que le serveur backend est démarré.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 pt-20 pb-12">
      <div className="w-full max-w-md border border-[#262626] bg-[#0A0A0A] p-8">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Ride'Up" className="h-14 mx-auto mb-4" />
          <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">COMPTE RIDE&apos;UP</div>
          <h1 className="font-display text-3xl">
            {mode === "login" && "CONNEXION"}
            {mode === "register" && "INSCRIPTION"}
            {mode === "forgot" && "MOT DE PASSE OUBLIÉ"}
          </h1>
          {mode === "register" && (
            <p className="text-sm text-gray-400 mt-3 leading-relaxed">
              Compte <strong className="text-gray-200">RIDE&apos;UP</strong> — email et mot de passe uniquement.
              Pas de Google, pas de connexion via un service tiers.
            </p>
          )}
        </div>

        {mode !== "forgot" && (
          <div className="flex gap-2 mb-6">
            <Tab active={mode === "login"} onClick={() => { setMode("login"); setError(null); setSuccess(null); }}>SE CONNECTER</Tab>
            <Tab active={mode === "register"} onClick={() => { setMode("register"); setError(null); setSuccess(null); }}>CRÉER UN COMPTE</Tab>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 border border-[#9AB8FF]/40 bg-[#9AB8FF]/10 text-[#9AB8FF] text-sm">{success}</div>
        )}

        <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
          {mode === "register" && (
            <Field label="PRÉNOM / NOM">
              <input
                data-testid="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="auth-input"
                placeholder="Alex Rider"
              />
            </Field>
          )}
          <Field label="EMAIL">
            <input
              data-testid="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              placeholder="ton@email.com"
            />
          </Field>
          {mode !== "forgot" && (
            <Field label="MOT DE PASSE">
              <input
                data-testid="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="auth-input"
                placeholder="8 caractères minimum"
              />
            </Field>
          )}

          {mode === "login" && (
            <button
              type="button"
              data-testid="auth-forgot-password"
              onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }}
              className="text-xs text-[#9AB8FF] hover:underline font-display tracking-wider"
            >
              Mot de passe oublié ?
            </button>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
              className="text-xs text-gray-400 hover:text-white font-display tracking-wider"
            >
              ← Retour à la connexion
            </button>
          )}

          {error && <div className="text-red-400 text-sm" data-testid="auth-error">{error}</div>}

          {mode === "register" && (
            <div className="p-3 border border-[#262626] bg-black/50 text-xs text-gray-400 leading-relaxed">
              Après inscription, un email de confirmation peut t&apos;être envoyé pour sécuriser ton compte.
              Tes données restent sur la plateforme RIDE&apos;UP.
            </div>
          )}

          <button
            type="submit"
            data-testid="auth-submit"
            disabled={loading}
            className="w-full bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white py-4 font-display tracking-wider disabled:opacity-50"
          >
            {loading ? "CHARGEMENT..." : mode === "login" ? "SE CONNECTER" : mode === "forgot" ? "ENVOYER LE LIEN" : "CRÉER MON COMPTE"}
          </button>
        </form>

        {mode === "register" && (
          <p className="text-xs text-gray-500 mt-4 text-center leading-relaxed">
            En créant un compte, tu acceptes nos{" "}
            <Link to="/cgu" className="text-[#9AB8FF] hover:underline">CGU</Link>
            {" "}et notre{" "}
            <Link to="/confidentialite" className="text-[#9AB8FF] hover:underline">politique de confidentialité</Link>.
          </p>
        )}

        {mode === "forgot" && (
          <p className="text-xs text-gray-500 mt-4 text-center">
            Un lien sécurisé sera envoyé à ton email. Personne ne peut changer ton mot de passe sans accès à ta boîte mail.
          </p>
        )}

        <p className="text-center text-xs text-gray-500 mt-6">
          Pas encore abonné ?{" "}
          <Link to="/pricing" className="text-[#9AB8FF] hover:underline">Voir les plans</Link>
        </p>
      </div>

      <style>{`.auth-input{width:100%;background:#000;border:1px solid #262626;padding:12px 14px;outline:none;color:#fff}.auth-input:focus{border-color:#9AB8FF}`}</style>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 font-display text-xs tracking-wider border transition ${
        active ? "border-[#9AB8FF] bg-[#9AB8FF]/15 text-white" : "border-[#262626] text-gray-400"
      }`}
    >
      {children}
    </button>
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
