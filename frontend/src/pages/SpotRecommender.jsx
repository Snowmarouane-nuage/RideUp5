import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Wind, MapPin, Shield, Crown, Sparkles, Navigation, AlertCircle } from "lucide-react";

export default function SpotRecommender() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    weight_kg: 75, kite_size: 10, board_size: 138, level: "intermediate", wind_kts: 20, sport: "kitesurf",
  });
  const [location, setLocation] = useState({ lat: null, lon: null, label: "" });
  const [maxDistance, setMaxDistance] = useState(500); // km
  const [useLocation, setUseLocation] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
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
          <p className="text-gray-400 mb-2">L'algo croise ton poids, ton matériel, ta localisation et le vent réel pour te proposer le spot idéal.</p>
          <p className="text-gray-400 mb-8">Disponible uniquement sur l'abonnement Premium (15.99€/mois).</p>
          <Link data-testid="spot-upgrade" to="/pricing" className="inline-block bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-8 py-4 font-display tracking-wider">
            PASSER PREMIUM
          </Link>
        </div>
      </div>
    );
  }

  const detectLocation = () => {
    setGeoError(null);
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoError("Géolocalisation non supportée par ton navigateur.");
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // Reverse geocode via Open-Meteo
        let label = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=fr`);
          const d = await r.json();
          if (d.results?.[0]) {
            const x = d.results[0];
            label = [x.name, x.admin1, x.country].filter(Boolean).join(", ");
          }
        } catch {}
        setLocation({ lat, lon, label });
        setUseLocation(true);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError("Impossible de récupérer ta position. Autorise la géolocalisation dans ton navigateur.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const searchCity = async (query) => {
    if (!query.trim()) return;
    setGeoError(null);
    setGeoLoading(true);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=fr`);
      const d = await r.json();
      if (d.results?.[0]) {
        const x = d.results[0];
        const label = [x.name, x.admin1, x.country].filter(Boolean).join(", ");
        setLocation({ lat: x.latitude, lon: x.longitude, label });
        setUseLocation(true);
      } else {
        setGeoError("Ville introuvable.");
      }
    } catch {
      setGeoError("Erreur de géocodage.");
    } finally {
      setGeoLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const payload = { ...form };
      if (useLocation && location.lat !== null) {
        payload.user_lat = location.lat;
        payload.user_lon = location.lon;
        payload.max_distance_km = maxDistance;
      }
      const r = await api.post("/spot-recommend", payload);
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
        <p className="text-gray-400 max-w-3xl mb-10">Données vent en temps réel via Open-Meteo. L'IA score les spots selon ton matériel, ton niveau, et la distance que tu peux parcourir.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form onSubmit={submit} className="lg:col-span-1 p-8 border border-[#262626] bg-[#0A0A0A] space-y-4" data-testid="spot-form">

            {/* Location block */}
            <div className="p-4 border border-[#1E6BFF]/40 bg-[#1E6BFF]/5 space-y-3">
              <div className="font-display text-xs tracking-wider text-[#1E6BFF] flex items-center gap-2">
                <MapPin className="h-3 w-3" /> TA LOCALISATION
              </div>
              {useLocation && location.label ? (
                <div className="text-sm">
                  <div className="text-white">{location.label}</div>
                  <button type="button" onClick={() => { setUseLocation(false); setLocation({ lat: null, lon: null, label: "" }); }} className="text-xs text-[#1E6BFF] hover:underline mt-1">
                    Modifier
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={geoLoading}
                    data-testid="detect-location"
                    className="w-full flex items-center justify-center gap-2 bg-[#1E6BFF] hover:bg-[#1751C4] text-white py-2.5 font-display text-sm tracking-wider transition disabled:opacity-50"
                  >
                    <Navigation className="h-4 w-4" /> {geoLoading ? "DÉTECTION..." : "DÉTECTER MA POSITION"}
                  </button>
                  <div className="text-xs text-gray-400 text-center">ou tape une ville</div>
                  <CitySearchInput onSearch={searchCity} loading={geoLoading} />
                </>
              )}
              {geoError && (
                <div className="text-xs text-amber-400 flex items-start gap-2"><AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{geoError}</div>
              )}
            </div>

            {useLocation && location.lat !== null && (
              <Field label={`RAYON DE RECHERCHE · ${maxDistance} KM`}>
                <input
                  data-testid="distance-slider"
                  type="range"
                  min="20"
                  max="3000"
                  step="10"
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                  className="w-full accent-[#1E6BFF]"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-display tracking-wider">
                  <span>20 km</span><span>500</span><span>1500</span><span>3000 km</span>
                </div>
              </Field>
            )}

            <div className="border-t border-[#262626] pt-4 space-y-4">
              <Field label="POIDS (KG)">
                <input data-testid="weight-input" type="number" step="0.5" value={form.weight_kg} onChange={(e) => setForm({...form, weight_kg: parseFloat(e.target.value)})} className="sr-input" />
              </Field>
              <Field label="TAILLE KITE (M²)">
                <input data-testid="kite-input" type="number" step="0.5" value={form.kite_size} onChange={(e) => setForm({...form, kite_size: parseFloat(e.target.value)})} className="sr-input" />
              </Field>
              <Field label="BOARD (CM)">
                <input data-testid="board-input" type="number" value={form.board_size} onChange={(e) => setForm({...form, board_size: parseFloat(e.target.value)})} className="sr-input" />
              </Field>
              <Field label="NIVEAU">
                <select data-testid="level-input" value={form.level} onChange={(e) => setForm({...form, level: e.target.value})} className="sr-input">
                  <option value="beginner">Débutant</option>
                  <option value="intermediate">Intermédiaire</option>
                  <option value="advanced">Avancé</option>
                  <option value="pro">Pro</option>
                </select>
              </Field>
            </div>

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
                Renseigne ton profil pour découvrir les meilleurs spots adaptés{useLocation ? ` dans un rayon de ${maxDistance} km autour de ta position.` : "."}
              </div>
            )}
            {loading && <div className="text-gray-400 animate-pulse p-12 text-center">Récupération des vents en temps réel...</div>}
            {result && result.top_spots.length === 0 && (
              <div className="p-8 border border-amber-500/40 bg-amber-500/5 text-center">
                <div className="font-display text-xl mb-2">AUCUN SPOT TROUVÉ</div>
                <p className="text-sm text-gray-400">{result.ai_advice}</p>
              </div>
            )}
            {result && result.top_spots.length > 0 && (
              <>
                <div className="p-6 border-2 border-[#1E6BFF] bg-[#1E6BFF]/5">
                  <div className="font-display text-xs tracking-widest text-[#1E6BFF] mb-2">CONSEIL IA</div>
                  <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">{result.ai_advice}</p>
                </div>
                {result.top_spots.map((s, i) => (
                  <div key={s.name} data-testid={`spot-result-${i}`} className={`p-6 border ${i === 0 ? "border-[#1E6BFF]" : "border-[#262626]"} bg-[#0A0A0A] flex flex-col md:flex-row md:items-center gap-4 justify-between`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-display text-2xl">#{i + 1} {s.name}</span>
                        {s.safety_ok ? (
                          <span className="text-xs px-2 py-0.5 border border-green-500 text-green-400 font-display tracking-wider flex items-center gap-1"><Shield className="h-3 w-3" /> SAFE</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 border border-red-500 text-red-400 font-display tracking-wider">⚠ NIVEAU</span>
                        )}
                        {"distance_km" in s && (
                          <span className="text-xs px-2 py-0.5 border border-[#1E6BFF] text-[#1E6BFF] font-display tracking-wider">{s.distance_km} KM</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mb-2">Type: {s.type} · Niveau spot: {s.level} · Vent idéal: {s.ideal_kts[0]}–{s.ideal_kts[1]} kts</div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1"><Wind className="h-4 w-4 text-[#1E6BFF]" /> <span className="font-display text-lg">{s.wind_kts_now?.toFixed(1)}</span> kts maintenant</div>
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
        .sr-input { width: 100%; background: #000; border: 1px solid #262626; padding: 10px 14px; outline: none; color: white; }
        .sr-input:focus { border-color: #1E6BFF; }
      `}</style>
    </div>
  );
}

function CitySearchInput({ onSearch, loading }) {
  const [q, setQ] = useState("");
  return (
    <div className="flex gap-2">
      <input
        data-testid="city-search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSearch(q); } }}
        placeholder="ex: Hyères, Lille..."
        className="flex-1 bg-black border border-[#262626] px-3 py-2 text-sm outline-none focus:border-[#1E6BFF]"
      />
      <button
        type="button"
        data-testid="city-search-btn"
        onClick={() => onSearch(q)}
        disabled={loading || !q.trim()}
        className="px-3 border border-[#262626] hover:border-[#1E6BFF] text-sm font-display tracking-wider disabled:opacity-50"
      >
        OK
      </button>
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
