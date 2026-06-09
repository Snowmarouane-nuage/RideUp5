import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Wind, MapPin, Shield, Crown, Lock, Sparkles } from "lucide-react";

export default function SpotRecommender() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    weight_kg: 75, kite_size: 10, board_size: 138, level: "intermediate", wind_kts: 20, sport: "kitesurf",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isPremium = user?.plan === "premium";

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center p-12 border-2 border-[#1E6BFF]/40 bg-[#0A0A0A]">
          <Crown className="h-16 w-16 text-[#1E6BFF] mx-auto mb-6" />
          <h1 className="font-display text-3xl md:text-5xl mb-4">SPOT FINDER · PREMIUM</h1>
          <p className="text-gray-400 mb-2">L'algo croise ton poids, ton matériel et le vent réel pour te proposer le spot idéal.</p>
          <p className="text-gray-400 mb-8">Disponible uniquement sur l'abonnement Premium (15.99€/mois).</p>
          <Link data-testid="spot-upgrade" to="/pricing" className="inline-block bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-8 py-4 font-display tracking-wider">
            PASSER PREMIUM
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.post("/spot-recommend", form);
      setResult(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-[#1E6BFF] font-display text-xs tracking-[0.3em] mb-2">PREMIUM · SPOT FINDER</div>
        <h1 className="font-display text-4xl md:text-6xl mb-3">LE BON SPOT, <span className="text-[#1E6BFF]">LE BON JOUR</span></h1>
        <p className="text-gray-400 max-w-3xl mb-10">Données vent en temps réel via Open-Meteo. L'IA score les spots selon ton matériel et ton niveau.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form onSubmit={submit} className="lg:col-span-1 p-8 border border-[#262626] bg-[#0A0A0A] space-y-4" data-testid="spot-form">
            <Field label="POIDS (KG)">
              <input data-testid="weight-input" type="number" step="0.5" value={form.weight_kg} onChange={(e) => setForm({...form, weight_kg: parseFloat(e.target.value)})} className="input" />
            </Field>
            <Field label="TAILLE KITE (M²)">
              <input data-testid="kite-input" type="number" step="0.5" value={form.kite_size} onChange={(e) => setForm({...form, kite_size: parseFloat(e.target.value)})} className="input" />
            </Field>
            <Field label="BOARD (CM)">
              <input data-testid="board-input" type="number" value={form.board_size} onChange={(e) => setForm({...form, board_size: parseFloat(e.target.value)})} className="input" />
            </Field>
            <Field label="NIVEAU">
              <select data-testid="level-input" value={form.level} onChange={(e) => setForm({...form, level: e.target.value})} className="input">
                <option value="beginner">Débutant</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="advanced">Avancé</option>
                <option value="pro">Pro</option>
              </select>
            </Field>
            <Field label="VENT ESTIMÉ (KTS)">
              <input data-testid="wind-input" type="number" value={form.wind_kts} onChange={(e) => setForm({...form, wind_kts: parseFloat(e.target.value)})} className="input" />
            </Field>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <button
              data-testid="spot-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E6BFF] hover:bg-[#1751C4] text-white py-4 font-display tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="h-5 w-5" /> {loading ? "RECHERCHE..." : "TROUVER MON SPOT"}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            {!result && !loading && (
              <div className="p-12 border border-dashed border-[#262626] bg-[#0A0A0A] text-center text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-[#1E6BFF]" />
                Renseigne ton profil pour découvrir les meilleurs spots adaptés.
              </div>
            )}
            {loading && <div className="text-gray-400 animate-pulse p-12 text-center">Récupération des vents en temps réel...</div>}
            {result && (
              <>
                <div className="p-6 border-2 border-[#1E6BFF] bg-[#1E6BFF]/5">
                  <div className="font-display text-xs tracking-widest text-[#1E6BFF] mb-2">CONSEIL IA</div>
                  <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">{result.ai_advice}</p>
                </div>
                {result.top_spots.map((s, i) => (
                  <div key={s.name} data-testid={`spot-result-${i}`} className={`p-6 border ${i === 0 ? "border-[#1E6BFF]" : "border-[#262626]"} bg-[#0A0A0A] flex flex-col md:flex-row md:items-center gap-4 justify-between`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-display text-2xl">#{i + 1} {s.name}</span>
                        {s.safety_ok ? (
                          <span className="text-xs px-2 py-0.5 border border-green-500 text-green-400 font-display tracking-wider flex items-center gap-1"><Shield className="h-3 w-3" /> SAFE</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 border border-red-500 text-red-400 font-display tracking-wider">⚠ NIVEAU</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mb-2">Type: {s.type} · Niveau spot: {s.level} · Vent idéal: {s.ideal_kts[0]}–{s.ideal_kts[1]} kts</div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1"><Wind className="h-4 w-4 text-[#1E6BFF]" /> <span className="font-display text-lg">{s.wind_kts_now?.toFixed(1)}</span> kts</div>
                        <div className="text-gray-400">Score: <span className="text-[#1E6BFF] font-display text-lg">{s.score}</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .input { width: 100%; background: #000; border: 1px solid #262626; padding: 10px 14px; outline: none; }
        .input:focus { border-color: #1E6BFF; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-display text-xs tracking-wider mb-1 text-gray-300">{label}</label>
      {children}
    </div>
  );
}
