import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const subscribe = async (plan) => {
    if (!user) {
      const redirectUrl = window.location.origin + "/auth/callback";
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      return;
    }
    setLoading(plan);
    try {
      const r = await api.post("/checkout/session", {
        plan,
        origin_url: window.location.origin,
      });
      window.location.href = r.data.url;
    } catch (e) {
      alert("Erreur lors de la création du paiement");
      setLoading(null);
    }
  };

  const plans = [
    {
      id: "standard",
      name: "STANDARD",
      price: "9.99",
      tagline: "Progresse avec les outils essentiels",
      features: [
        "Analyse vidéo IA illimitée",
        "Accès à tous les cours de kite",
        "Tous niveaux (débutant → avancé)",
        "Historique de tes analyses",
        "Support communauté",
      ],
      cta: "DÉMARRER STANDARD",
      highlight: false,
    },
    {
      id: "premium",
      name: "PREMIUM",
      price: "15.99",
      tagline: "L'arsenal complet du rideur sérieux",
      features: [
        "Tout du plan Standard",
        "🎯 Spot Finder IA (poids + matériel + vent réel)",
        "Recommandations sécurité personnalisées",
        "Données vent en temps réel (Open-Meteo)",
        "Analyses prioritaires",
        "Conseils matériel personnalisés par IA",
      ],
      cta: "PASSER PREMIUM",
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white pt-32 pb-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-[#1E6BFF] font-display text-xs tracking-[0.3em] mb-3">ABONNEMENTS</div>
          <h1 className="font-display text-5xl md:text-7xl leading-none mb-4">CHOISIS TON <span className="text-[#1E6BFF]">PLAN</span></h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Sans engagement. Annule à tout moment. Tous les plans incluent l'analyse vidéo IA.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.id}
              data-testid={`pricing-card-${p.id}`}
              className={`relative p-8 md:p-10 border-2 transition-all hover:-translate-y-1 ${
                p.highlight
                  ? "border-[#1E6BFF] bg-[#0A0A0A] ring-4 ring-[#1E6BFF]/20"
                  : "border-[#262626] bg-[#0A0A0A] hover:border-[#1E6BFF]/50"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-8 bg-[#1E6BFF] text-white text-xs font-display tracking-widest px-3 py-1">
                  RECOMMANDÉ
                </div>
              )}
              <div className="font-display text-3xl mb-1">{p.name}</div>
              <div className="text-sm text-gray-400 mb-6">{p.tagline}</div>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="font-display text-6xl">{p.price}€</span>
                <span className="text-gray-400 text-sm">/mois</span>
              </div>
              <ul className="space-y-3 mb-10 min-h-[260px]">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className={`h-5 w-5 shrink-0 mt-0.5 ${p.highlight ? "text-[#1E6BFF]" : "text-white"}`} />
                    <span className="text-gray-200">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                data-testid={`pricing-subscribe-${p.id}`}
                onClick={() => subscribe(p.id)}
                disabled={loading === p.id}
                className={`w-full py-4 font-display tracking-wider transition ${
                  p.highlight
                    ? "bg-[#1E6BFF] hover:bg-[#1751C4] text-white"
                    : "border-2 border-white text-white hover:bg-white hover:text-black"
                } disabled:opacity-50`}
              >
                {loading === p.id ? "Chargement..." : p.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <Lock className="h-3 w-3" /> Paiement sécurisé via Stripe · Activation immédiate
        </div>
      </div>
    </div>
  );
}
