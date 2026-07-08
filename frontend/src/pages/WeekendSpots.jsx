import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Wind, Calendar, TrendingUp, ArrowRight, Sparkles, Flame } from "lucide-react";
import { api } from "@/lib/api";
import DangerBadge from "@/components/DangerBadge";

const HERO_BG = "https://images.unsplash.com/photo-1627068477565-3a66d5f76d5e?fm=jpg&q=85&w=2000&auto=format&fit=crop";
const FORECAST_TIMEOUT_MS = 20000;

export default function WeekendSpots() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(() => searchParams.get("country") || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const fetchSeq = useRef(0);

  useEffect(() => {
    const fromUrl = searchParams.get("country") || null;
    if (fromUrl !== country) setCountry(fromUrl);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    setData(null);

    const params = { limit: 12 };
    if (country) params.country = country;

    api
      .get("/spots/weekend-page", {
        params,
        timeout: FORECAST_TIMEOUT_MS,
      })
      .then((r) => {
        if (seq !== fetchSeq.current) return;
        const forecast = r.data.forecast;
        const responseCountry = forecast.country ?? null;
        const expected = country || null;
        if (responseCountry !== expected) return;
        setCountries(r.data.countries || []);
        setData(forecast);
      })
      .catch((e) => {
        if (seq !== fetchSeq.current) return;
        const msg =
          e.code === "ECONNABORTED"
            ? "Le chargement a pris trop de temps. Réessaie dans un instant."
            : "Impossible de charger les prévisions pour le moment.";
        setError(msg);
      })
      .finally(() => {
        if (seq === fetchSeq.current) setLoading(false);
      });
  }, [country, retryKey]);

  const selectCountry = (name) => {
    setCountry(name);
    const next = new URLSearchParams(searchParams);
    if (name) next.set("country", name);
    else next.delete("country");
    setSearchParams(next, { replace: true });
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  const showResults = !loading && data && data.spots?.length > 0;

  return (
    <div className="bg-black text-white min-h-screen">
      <section
        className="relative pt-32 pb-16 px-6 overflow-hidden"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#9AB8FF] text-[#9AB8FF] text-xs font-display tracking-wider mb-6">
            <Calendar className="h-3 w-3" /> MIS À JOUR · {new Date().toLocaleDateString("fr-FR")}
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl leading-[0.95] mb-4">
            MEILLEURS SPOTS DE KITESURF<br/>
            <span className="text-[#9AB8FF]">CE WEEK-END</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl">
            {country ? (
              <>
                Vent le plus fort prévu pour{" "}
                <strong className="capitalize">{data ? formatDate(data.saturday) : "..."}</strong> et{" "}
                <strong className="capitalize">{data ? formatDate(data.sunday) : "..."}</strong> en{" "}
                <strong className="text-white">{country}</strong> — classement par puissance du vent.
              </>
            ) : (
              <>
                Vent le plus fort prévu pour{" "}
                <strong className="capitalize">{data ? formatDate(data.saturday) : "..."}</strong> et{" "}
                <strong className="capitalize">{data ? formatDate(data.sunday) : "..."}</strong> en Europe et dans le monde — classement par puissance du vent.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="sticky top-[72px] z-40 bg-black/95 backdrop-blur border-b border-[#262626] px-6 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="text-[10px] font-display tracking-widest text-gray-500 mb-2">CHOISIR UN PAYS</div>
          <div data-testid="country-bar" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
            <CountryChip label="Tous les pays" active={!country} onClick={() => selectCountry(null)} testId="country-all" />
            {countries.map((c) => (
              <CountryChip
                key={c.name}
                label={c.name}
                count={c.count}
                active={country === c.name}
                onClick={() => selectCountry(c.name)}
                testId={`country-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="max-w-6xl mx-auto">

          {loading && (
            <div className="text-center py-20">
              <div className="h-12 w-12 mx-auto rounded-full border-4 border-[#9AB8FF] border-t-transparent animate-spin mb-4" />
              <div className="text-gray-400 font-display tracking-wider">
                {country ? `ANALYSE DU VENT · ${country.toUpperCase()}` : "ANALYSE DU VENT · MONDE"}
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="text-sm text-[#9AB8FF] hover:underline font-display tracking-wider">
                RÉESSAYER
              </button>
            </div>
          )}

          {!loading && !error && data && data.spots?.length === 0 && (
            <div className="text-center py-20 text-gray-400">Aucune donnée vent disponible pour ce week-end.</div>
          )}

          {showResults && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                {data.spots.slice(0, 3).map((s, i) => (
                  <PodiumCard key={`${s.name}-${i}`} spot={s} rank={i + 1} />
                ))}
              </div>

              <div className="font-display text-2xl mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#9AB8FF]" />
                CLASSEMENT · VENT LE PLUS FORT
                {country && <span className="text-sm text-gray-500 ml-2">({country})</span>}
              </div>
              <div className="space-y-3">
                {data.spots.slice(3).map((s, i) => (
                  <RankRow key={`${s.name}-${i}`} spot={s} rank={i + 4} />
                ))}
              </div>

              <div className="mt-16 p-10 border-2 border-[#9AB8FF] bg-gradient-to-br from-[#9AB8FF]/20 to-transparent text-center">
                <Sparkles className="h-12 w-12 text-[#9AB8FF] mx-auto mb-4" />
                <h2 className="font-display text-3xl md:text-5xl mb-4">VEUX-TU TON SPOT <span className="text-[#9AB8FF]">SUR-MESURE</span> ?</h2>
                <p className="text-gray-300 max-w-2xl mx-auto mb-8">
                  Avec RIDE&apos;UP Premium, le Spot Finder croise <strong>ta localisation</strong>, ton <strong>poids</strong>, ton <strong>matériel</strong> et ton <strong>niveau</strong> pour te recommander le spot le plus sûr et adapté chaque jour de l&apos;année.
                </p>
                <Link to="/pricing" data-testid="weekend-cta-premium" className="inline-flex items-center gap-3 bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider transition">
                  ESSAYER LE SPOT FINDER PREMIUM · 15.99€/MOIS <ArrowRight className="h-5 w-5" />
                </Link>
                <div className="mt-4 text-xs text-gray-500">Sans engagement · Annule à tout moment</div>
              </div>

              <div className="mt-20 prose prose-invert max-w-3xl mx-auto text-gray-400 text-sm">
                <h3 className="font-display text-xl text-white mb-3">Comment lire ce classement ?</h3>
                <p>
                  Les spots sont classés par vent maximum prévu sur le week-end (pic samedi ou dimanche), puis par moyenne. Plus le vent est fort, plus le spot monte dans le classement.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function CountryChip({ label, count, active, onClick, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 text-xs font-display tracking-wider border transition whitespace-nowrap ${
        active ? "bg-[#9AB8FF] border-[#9AB8FF] text-white" : "bg-[#0A0A0A] border-[#262626] text-gray-300 hover:border-[#9AB8FF]/60"
      }`}
    >
      {label}
      {count != null && <span className="ml-1 opacity-60">({count})</span>}
    </button>
  );
}

function PodiumCard({ spot, rank }) {
  const medal = { 1: "🥇", 2: "🥈", 3: "🥉" }[rank];
  const isTop = rank === 1;
  const peak = spot.weekend_peak_kts ?? spot.max_wind_kts;
  return (
    <div data-testid={`podium-${rank}`} className={`relative p-6 border-2 ${isTop ? "border-[#9AB8FF] bg-gradient-to-br from-[#9AB8FF]/20 to-transparent md:scale-105" : "border-[#262626] bg-[#0A0A0A]"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-3xl mb-1">{medal}</div>
          <div className="font-display text-2xl">{spot.name}</div>
        </div>
        {isTop && <Flame className="h-6 w-6 text-[#9AB8FF]" />}
      </div>
      <div className="text-xs text-gray-400 mb-4 flex flex-wrap items-center gap-2">
        <span>Type: {spot.type} · Min. {spot.min_level || spot.level}</span>
        <DangerBadge label={spot.danger_label} danger={spot.danger} />
      </div>
      <div className="mb-3 p-3 bg-[#9AB8FF]/10 border border-[#9AB8FF]/30">
        <div className="text-[10px] font-display tracking-widest text-[#9AB8FF]">PIC VENT WEEK-END</div>
        <div className="font-display text-3xl flex items-center gap-1"><Wind className="h-5 w-5" />{peak ?? "—"}<span className="text-sm text-gray-400">kts</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] font-display tracking-widest text-gray-500">SAMEDI</div>
          <div className="font-display text-xl">{spot.sat_avg_kts ?? "—"}<span className="text-xs text-gray-400"> kts moy.</span></div>
        </div>
        <div>
          <div className="text-[10px] font-display tracking-widest text-gray-500">DIMANCHE</div>
          <div className="font-display text-xl">{spot.sun_avg_kts ?? "—"}<span className="text-xs text-gray-400"> kts moy.</span></div>
        </div>
      </div>
    </div>
  );
}

function RankRow({ spot, rank }) {
  const peak = spot.weekend_peak_kts ?? spot.max_wind_kts;
  return (
    <div data-testid={`rank-${rank}`} className="p-4 border border-[#262626] bg-[#0A0A0A] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#9AB8FF]/50 transition">
      <div className="flex items-center gap-4">
        <span className="font-display text-2xl text-gray-500 w-10">#{rank}</span>
        <div>
          <div className="font-display text-lg">{spot.name}</div>
          <div className="text-xs text-gray-400">{spot.type} · {spot.level}</div>
        </div>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div className="text-[#9AB8FF]">
          <span className="text-[10px] font-display tracking-widest block">PIC</span>
          <span className="font-display text-xl">{peak ?? "—"}</span>
          <span className="text-xs"> kts</span>
        </div>
        <div className="text-gray-400">
          <span className="text-[10px] font-display tracking-widest block">SAM</span>
          <span className="font-display text-lg text-white">{spot.sat_avg_kts ?? "—"}</span>
        </div>
        <div className="text-gray-400">
          <span className="text-[10px] font-display tracking-widest block">DIM</span>
          <span className="font-display text-lg text-white">{spot.sun_avg_kts ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
