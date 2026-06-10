import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wind, MapPin, Calendar, TrendingUp, ArrowRight, Sparkles, Flame, Shield } from "lucide-react";
import { api } from "@/lib/api";

const HERO_BG = "https://images.unsplash.com/photo-1627068477565-3a66d5f76d5e?fm=jpg&q=85&w=2000&auto=format&fit=crop";

export default function WeekendSpots() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // SEO meta tags (basic — for production use react-helmet-async)
    document.title = "Meilleurs spots de kitesurf ce week-end · RIDE’UP";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = "Découvre les meilleurs spots de kitesurf en France et en Europe pour ce week-end : vent en temps réel, conditions idéales et recommandations IA. Mis à jour quotidiennement.";

    api.get("/spots/weekend-forecast")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Hero */}
      <section
        className="relative pt-32 pb-16 px-6 overflow-hidden"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#1E6BFF] text-[#1E6BFF] text-xs font-display tracking-wider mb-6">
            <Calendar className="h-3 w-3" /> MIS À JOUR · {new Date().toLocaleDateString("fr-FR")}
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl leading-[0.95] mb-4">
            MEILLEURS SPOTS DE KITESURF<br/>
            <span className="text-[#1E6BFF]">CE WEEK-END</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl">
            On a scanné le vent prévu pour <strong className="capitalize">{data ? formatDate(data.saturday) : "..."}</strong> et <strong className="capitalize">{data ? formatDate(data.sunday) : "..."}</strong> sur les meilleurs spots de France et d'Europe. Voici notre classement live.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 py-12">
        <div className="max-w-6xl mx-auto">

          {loading && (
            <div className="text-center py-20">
              <div className="h-12 w-12 mx-auto rounded-full border-4 border-[#1E6BFF] border-t-transparent animate-spin mb-4" />
              <div className="text-gray-400 font-display tracking-wider">CHARGEMENT DES PRÉVISIONS...</div>
            </div>
          )}

          {error && <div className="text-red-400 text-center py-12">{error}</div>}

          {data && data.spots.length === 0 && (
            <div className="text-center py-20 text-gray-400">Aucune donnée vent disponible pour ce week-end.</div>
          )}

          {data && data.spots.length > 0 && (
            <>
              {/* Top podium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                {data.spots.slice(0, 3).map((s, i) => (
                  <PodiumCard key={s.name} spot={s} rank={i + 1} />
                ))}
              </div>

              {/* Full ranking */}
              <div className="font-display text-2xl mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#1E6BFF]" /> CLASSEMENT COMPLET
              </div>
              <div className="space-y-3">
                {data.spots.slice(3).map((s, i) => (
                  <RankRow key={s.name} spot={s} rank={i + 4} />
                ))}
              </div>

              {/* CTA */}
              <div className="mt-16 p-10 border-2 border-[#1E6BFF] bg-gradient-to-br from-[#1E6BFF]/20 to-transparent text-center">
                <Sparkles className="h-12 w-12 text-[#1E6BFF] mx-auto mb-4" />
                <h2 className="font-display text-3xl md:text-5xl mb-4">VEUX-TU TON SPOT <span className="text-[#1E6BFF]">SUR-MESURE</span> ?</h2>
                <p className="text-gray-300 max-w-2xl mx-auto mb-8">
                  Avec RIDE’UP Premium, l'IA croise <strong>ta localisation</strong>, ton <strong>poids</strong>, ton <strong>matériel</strong> et ton <strong>niveau</strong> pour te recommander le spot le plus safe et adapté chaque jour de l'année.
                </p>
                <Link
                  to="/pricing"
                  data-testid="weekend-cta-premium"
                  className="inline-flex items-center gap-3 bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-8 py-4 font-display tracking-wider transition"
                >
                  ESSAYER LE SPOT FINDER PREMIUM · 15.99€/MOIS <ArrowRight className="h-5 w-5" />
                </Link>
                <div className="mt-4 text-xs text-gray-500">Sans engagement · Annule à tout moment</div>
              </div>

              {/* SEO content footer */}
              <div className="mt-20 prose prose-invert max-w-3xl mx-auto text-gray-400 text-sm">
                <h3 className="font-display text-xl text-white mb-3">Comment lire ce classement ?</h3>
                <p>
                  Chaque spot est noté selon le nombre d'heures "rideables" durant le week-end (vent compris dans la plage idéale du spot) et la qualité moyenne du vent prévu. Les données viennent en temps réel de Open-Meteo et sont actualisées plusieurs fois par jour.
                </p>
                <h3 className="font-display text-xl text-white mt-6 mb-3">Pourquoi le bon spot, c'est important ?</h3>
                <p>
                  Un kitesurfeur débutant en Tramontane à 30 kts à Leucate, ce n'est pas la même session qu'un Cumbuco à 18 kts. Choisir un spot adapté à son niveau et son matériel, c'est la base d'une session safe et progressive. RIDE’UP t'aide à ne plus te tromper.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function PodiumCard({ spot, rank }) {
  const medal = { 1: "🥇", 2: "🥈", 3: "🥉" }[rank];
  const isTop = rank === 1;
  return (
    <div
      data-testid={`podium-${rank}`}
      className={`relative p-6 border-2 ${isTop ? "border-[#1E6BFF] bg-gradient-to-br from-[#1E6BFF]/20 to-transparent md:scale-105" : "border-[#262626] bg-[#0A0A0A]"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-3xl mb-1">{medal}</div>
          <div className="font-display text-2xl">{spot.name}</div>
        </div>
        {isTop && <Flame className="h-6 w-6 text-[#1E6BFF]" />}
      </div>
      <div className="text-xs text-gray-400 mb-4">
        Type: {spot.type} · Niveau: {spot.level}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] font-display tracking-widest text-gray-500">SAMEDI</div>
          <div className="font-display text-2xl flex items-center gap-1"><Wind className="h-4 w-4 text-[#1E6BFF]" />{spot.sat_avg_kts ?? "—"}<span className="text-xs text-gray-400">kts</span></div>
        </div>
        <div>
          <div className="text-[10px] font-display tracking-widest text-gray-500">DIMANCHE</div>
          <div className="font-display text-2xl flex items-center gap-1"><Wind className="h-4 w-4 text-[#1E6BFF]" />{spot.sun_avg_kts ?? "—"}<span className="text-xs text-gray-400">kts</span></div>
        </div>
      </div>
      <div className="pt-3 border-t border-[#262626] flex items-center justify-between text-xs">
        <span className="text-gray-400"><strong className="text-[#1E6BFF]">{spot.rideable_hours}h</strong> rideables</span>
        <span className="text-gray-400">Vent idéal: {spot.ideal_kts[0]}–{spot.ideal_kts[1]} kts</span>
      </div>
    </div>
  );
}

function RankRow({ spot, rank }) {
  return (
    <div
      data-testid={`rank-${rank}`}
      className="p-4 border border-[#262626] bg-[#0A0A0A] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#1E6BFF]/50 transition"
    >
      <div className="flex items-center gap-4">
        <span className="font-display text-2xl text-gray-500 w-10">#{rank}</span>
        <div>
          <div className="font-display text-lg">{spot.name}</div>
          <div className="text-xs text-gray-400">{spot.type} · {spot.level}</div>
        </div>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div className="text-gray-400">
          <span className="text-[10px] font-display tracking-widest block">SAM</span>
          <span className="font-display text-lg text-white">{spot.sat_avg_kts ?? "—"}</span>
          <span className="text-xs"> kts</span>
        </div>
        <div className="text-gray-400">
          <span className="text-[10px] font-display tracking-widest block">DIM</span>
          <span className="font-display text-lg text-white">{spot.sun_avg_kts ?? "—"}</span>
          <span className="text-xs"> kts</span>
        </div>
        <div className="text-[#1E6BFF] font-display text-lg">{spot.rideable_hours}h</div>
      </div>
    </div>
  );
}
