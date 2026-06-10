import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Wind, MapPin, Shield, Crown, Sparkles, Navigation, AlertCircle } from "lucide-react";

export default function SpotRecommender() {
  const { user } = useAuth();
  const [{ today, maxDate }] = useState(() => ({
    today: new Date().toISOString().slice(0, 10),
    maxDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  }));
  const [form, setForm] = useState(() => ({
    weight_kg: 75, quiver: [9, 12], board_size: 138, level: "intermediate", sport: "kitesurf",
    target_date: new Date().toISOString().slice(0, 10), target_hour: 14,
  }));
  const [newKite, setNewKite] = useState("");
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
        <div className="max-w-3xl mx-auto text-center p-12 border-2 border-[#9AB8FF]/40 bg-[#0A0A0A]">
          <Crown className="h-16 w-16 text-[#9AB8FF] mx-auto mb-6" />
          <h1 className="font-display text-3xl md:text-5xl mb-4">SPOT FINDER · PREMIUM</h1>
          <p className="text-gray-400 mb-2">L&apos;algo croise ton poids, ton matériel, ta localisation et le vent réel pour te proposer le spot idéal.</p>
          <p className="text-gray-400 mb-8">Disponible uniquement sur l&apos;abonnement Premium (15.99€/mois).</p>
          <Link data-testid="spot-upgrade" to="/pricing" className="inline-block bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider">
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
        } catch (_) { /* ignore reverse geocoding errors */ }
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
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">PREMIUM · SPOT FINDER</div>
        <h1 className="font-display text-4xl md:text-6xl mb-3">LE BON SPOT, <span className="text-[#9AB8FF]">LE BON JOUR</span></h1>
        <p className="text-gray-400 max-w-3xl mb-10">Données vent en temps réel via Open-Meteo. L&apos;IA score les spots selon ton matériel, ton niveau, et la distance que tu peux parcourir.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form onSubmit={submit} className="lg:col-span-1 p-8 border border-[#262626] bg-[#0A0A0A] space-y-4" data-testid="spot-form">

            {/* Location block */}
            <div className="p-4 border border-[#9AB8FF]/40 bg-[#9AB8FF]/5 space-y-3">
              <div className="font-display text-xs tracking-wider text-[#9AB8FF] flex items-center gap-2">
                <MapPin className="h-3 w-3" /> TA LOCALISATION
              </div>
              {useLocation && location.label ? (
                <div className="text-sm">
                  <div className="text-white">{location.label}</div>
                  <button type="button" onClick={() => { setUseLocation(false); setLocation({ lat: null, lon: null, label: "" }); }} className="text-xs text-[#9AB8FF] hover:underline mt-1">
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
                    className="w-full flex items-center justify-center gap-2 bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white py-2.5 font-display text-sm tracking-wider transition disabled:opacity-50"
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
                  className="w-full accent-[#9AB8FF]"
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

              <Field label={`QUIVER · ${form.quiver.length} kite${form.quiver.length > 1 ? "s" : ""}`}>
                <div className="flex flex-wrap gap-2 mb-2" data-testid="quiver-chips">
                  {form.quiver.length === 0 && <span className="text-xs text-gray-500">Aucun kite renseigné</span>}
                  {form.quiver.map((k, i) => (
                    <span key={`${k}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 bg-[#9AB8FF]/15 border border-[#9AB8FF]/50 text-sm">
                      <span className="font-display">{k}m</span>
                      <button
                        type="button"
                        data-testid={`remove-kite-${i}`}
                        onClick={() => setForm({...form, quiver: form.quiver.filter((_, idx) => idx !== i)})}
                        className="text-[#9AB8FF] hover:text-white text-base leading-none"
                        aria-label="Retirer"
                      >×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    data-testid="new-kite-input"
                    type="number"
                    step="0.5"
                    min="3"
                    max="22"
                    value={newKite}
                    onChange={(e) => setNewKite(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = parseFloat(newKite);
                        if (!isNaN(v) && v > 0) {
                          setForm({...form, quiver: [...form.quiver, v].sort((a, b) => a - b)});
                          setNewKite("");
                        }
                      }
                    }}
                    placeholder="ex: 7"
                    className="sr-input flex-1"
                  />
                  <button
                    type="button"
                    data-testid="add-kite-btn"
                    onClick={() => {
                      const v = parseFloat(newKite);
                      if (!isNaN(v) && v > 0) {
                        setForm({...form, quiver: [...form.quiver, v].sort((a, b) => a - b)});
                        setNewKite("");
                      }
                    }}
                    className="px-4 border border-[#262626] hover:border-[#9AB8FF] text-sm font-display tracking-wider"
                  >AJOUTER</button>
                </div>
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

            {/* Date / time picker */}
            <div className="border-t border-[#262626] pt-4 space-y-4">
              <div className="font-display text-xs tracking-wider text-[#9AB8FF]">QUAND ?</div>
              <Field label="DATE (JUSQU&apos;À +14 JOURS)">
                <input
                  data-testid="date-input"
                  type="date"
                  value={form.target_date}
                  min={today}
                  max={maxDate}
                  onChange={(e) => setForm({...form, target_date: e.target.value})}
                  className="sr-input"
                />
              </Field>
              <Field label={`HEURE LOCALE · ${form.target_hour}H`}>
                <input
                  data-testid="hour-input"
                  type="range"
                  min="6"
                  max="20"
                  step="1"
                  value={form.target_hour}
                  onChange={(e) => setForm({...form, target_hour: parseInt(e.target.value)})}
                  className="w-full accent-[#9AB8FF]"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-display tracking-wider">
                  <span>6h</span><span>12h</span><span>16h</span><span>20h</span>
                </div>
              </Field>
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}
            <button
              data-testid="spot-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white py-4 font-display tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="h-5 w-5" /> {loading ? "RECHERCHE..." : "TROUVER MON SPOT"}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            {!result && !loading && (
              <div className="p-12 border border-dashed border-[#262626] bg-[#0A0A0A] text-center text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-[#9AB8FF]" />
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
                <div className="p-6 border-2 border-[#9AB8FF] bg-[#9AB8FF]/5">
                  <div className="font-display text-xs tracking-widest text-[#9AB8FF] mb-2">CONSEIL IA</div>
                  <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">{result.ai_advice}</p>
                </div>
                {result.top_spots.map((s, i) => (
                  <div key={s.name} data-testid={`spot-result-${i}`} className={`p-6 border ${i === 0 ? "border-[#9AB8FF]" : "border-[#262626]"} bg-[#0A0A0A] flex flex-col md:flex-row md:items-center gap-4 justify-between`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-display text-2xl">#{i + 1} {s.name}</span>
                        {s.safety_ok ? (
                          <span className="text-xs px-2 py-0.5 border border-green-500 text-green-400 font-display tracking-wider flex items-center gap-1"><Shield className="h-3 w-3" /> SAFE</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 border border-red-500 text-red-400 font-display tracking-wider">⚠ NIVEAU</span>
                        )}
                        {"distance_km" in s && (
                          <span className="text-xs px-2 py-0.5 border border-[#9AB8FF] text-[#9AB8FF] font-display tracking-wider">{s.distance_km} KM</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mb-2">Type: {s.type} · Niveau spot: {s.level} · Vent idéal: {s.ideal_kts[0]}–{s.ideal_kts[1]} kts</div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-1"><Wind className="h-4 w-4 text-[#9AB8FF]" /> <span className="font-display text-lg">{s.wind_kts_now?.toFixed(1)}</span> kts</div>
                    {s.recommended_kite && (
                      <div className="text-gray-300 text-sm flex items-center gap-1">
                        Kite conseillé : <span className="font-display text-lg text-[#9AB8FF]">{s.recommended_kite}m</span>
                      </div>
                    )}
                    <div className="text-gray-400">Score: <span className="text-[#9AB8FF] font-display text-lg">{s.score}</span></div>
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
        .sr-input:focus { border-color: #9AB8FF; }
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
        className="flex-1 bg-black border border-[#262626] px-3 py-2 text-sm outline-none focus:border-[#9AB8FF]"
      />
      <button
        type="button"
        data-testid="city-search-btn"
        onClick={() => onSearch(q)}
        disabled={loading || !q.trim()}
        className="px-3 border border-[#262626] hover:border-[#9AB8FF] text-sm font-display tracking-wider disabled:opacity-50"
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
