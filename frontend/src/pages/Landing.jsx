import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Wind, Video, MapPin, Sparkles, Activity, Target } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const HERO_IMAGES = [
  { url: "https://images.unsplash.com/photo-1627068477565-3a66d5f76d5e?fm=jpg&q=85&w=2000&auto=format&fit=crop", label: "KITESURF" },
  { url: "https://images.unsplash.com/photo-1666032234128-abc3e45bd1dc?fm=jpg&q=85&w=2000&auto=format&fit=crop", label: "WAKEBOARD" },
  { url: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?fm=jpg&q=85&w=2000&auto=format&fit=crop", label: "SURF" },
  { url: "https://images.unsplash.com/photo-1669173733012-9288d98b48c5?fm=jpg&q=85&w=2000&auto=format&fit=crop", label: "WAKE CABLE" },
  { url: "https://images.unsplash.com/photo-1672699303810-0b55ddad76b5?fm=jpg&q=85&w=2000&auto=format&fit=crop", label: "FOIL" },
];
const VIDEO_IMG = "https://images.unsplash.com/photo-1601900957092-ae3e67b47b03?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const COURSE_IMG = "https://images.unsplash.com/photo-1578060124065-41f863eb9ebe?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const SPOT_IMG = "https://images.unsplash.com/photo-1632990848833-2e7007adb204?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const FEEDBACK_IMG = "https://images.unsplash.com/photo-1502933691298-84fc14542831?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Landing() {
  const { user } = useAuth();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % HERO_IMAGES.length), 4500);
    return () => clearInterval(id);
  }, []);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleStart = () => {
    if (user) {
      window.location.href = "/dashboard";
      return;
    }
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="bg-black text-white">
      {/* HERO */}
      <section
        data-testid="hero-section"
        className="relative min-h-[95vh] flex items-center overflow-hidden bg-black"
      >
        {/* Slideshow layers with crossfade */}
        {HERO_IMAGES.map((img, i) => (
          <div
            key={img.url}
            className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
            style={{
              backgroundImage: `url(${img.url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: slide === i ? 1 : 0,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 diagonal-stripe opacity-40" />

        {/* Discipline indicator */}
        <div className="absolute top-32 right-8 z-10 hidden md:flex flex-col gap-3" data-testid="hero-disciplines">
          {HERO_IMAGES.map((img, i) => (
            <button
              key={img.label}
              onClick={() => setSlide(i)}
              className={`group flex items-center gap-3 transition-all ${slide === i ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
            >
              <span className="font-display text-xs tracking-[0.3em] text-white">{img.label}</span>
              <span className={`block h-0.5 transition-all ${slide === i ? "w-12 bg-[#1E6BFF]" : "w-6 bg-white/40"}`} />
            </button>
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-32 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#1E6BFF] text-[#1E6BFF] text-xs font-display tracking-wider mb-6">
              <Activity className="h-3 w-3" /> COACHING PREMIUM · KITE / WAKE / FOIL / SURF
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-6">
              PROGRESS<br /><span className="text-[#1E6BFF]">YOUR RIDE.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-xl mb-10 leading-relaxed">
              Analyse vidéo IA, bibliothèque de cours pour tous niveaux et un recommandeur de spots qui calcule le meilleur endroit pour ton matériel et les conditions du jour.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                data-testid="hero-cta-start"
                onClick={handleStart}
                className="group bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-8 py-4 font-display tracking-wider flex items-center gap-3 transition-all hover:translate-x-1"
              >
                COMMENCER MAINTENANT
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition" />
              </button>
              <Link
                to="/pricing"
                data-testid="hero-cta-pricing"
                className="border-2 border-white text-white px-8 py-4 font-display tracking-wider hover:bg-white hover:text-black transition"
              >
                VOIR LES ABONNEMENTS
              </Link>
            </div>
            <div className="mt-12 flex items-center gap-8 text-xs font-display tracking-wider text-gray-400">
              <div><span className="text-white text-2xl block">9.99€</span>STANDARD/MOIS</div>
              <div className="h-8 w-px bg-[#262626]" />
              <div><span className="text-[#1E6BFF] text-2xl block">15.99€</span>PREMIUM/MOIS</div>
              <div className="h-8 w-px bg-[#262626] hidden sm:block" />
              <div className="hidden sm:block"><span className="text-white text-2xl block">∞</span>SESSIONS</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section data-testid="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="text-[#1E6BFF] font-display text-xs tracking-[0.3em] mb-3">CE QUE TU OBTIENS</div>
            <h2 className="font-display text-4xl md:text-6xl leading-none">UNE PLATEFORME,<br/><span className="text-[#1E6BFF]">TOUTE LA GLISSE.</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Big card: Video analysis */}
            <div className="md:col-span-7 group relative overflow-hidden border border-[#262626] hover:border-[#1E6BFF]/60 transition" data-testid="feature-video">
              <img src={VIDEO_IMG} alt="" className="w-full h-80 object-cover opacity-60 group-hover:opacity-80 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1E6BFF] text-white text-xs font-display tracking-wider mb-4">
                  <Video className="h-3 w-3" /> ANALYSE IA
                </div>
                <h3 className="font-display text-3xl md:text-4xl mb-2">DÉCRYPTE TES SESSIONS</h3>
                <p className="text-gray-300 max-w-md">Upload ta vidéo, décris ta question. Claude AI te donne un retour technique structuré: diagnostic, corrections, drills.</p>
              </div>
            </div>

            {/* Courses */}
            <div className="md:col-span-5 group relative overflow-hidden border border-[#262626] hover:border-[#1E6BFF]/60 transition" data-testid="feature-courses">
              <img src={COURSE_IMG} alt="" className="w-full h-80 object-cover opacity-60 group-hover:opacity-80 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-black text-xs font-display tracking-wider mb-4">
                  <Sparkles className="h-3 w-3" /> COURS
                </div>
                <h3 className="font-display text-3xl mb-2">DÉBUTANT À AVANCÉ</h3>
                <p className="text-gray-300">Bibliothèque structurée pour progresser à ton rythme.</p>
              </div>
            </div>

            {/* AI Feedback / Points d'amélioration */}
            <div className="md:col-span-5 group relative overflow-hidden border border-[#262626] hover:border-[#1E6BFF]/60 transition" data-testid="feature-feedback">
              <img src={FEEDBACK_IMG} alt="" className="w-full h-80 object-cover opacity-50 group-hover:opacity-75 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1E6BFF] text-white text-xs font-display tracking-wider mb-4">
                  <Target className="h-3 w-3" /> POINTS D'AMÉLIORATION
                </div>
                <h3 className="font-display text-3xl mb-2">UN TRUC QUI<br/>NE PASSE PAS ?</h3>
                <p className="text-gray-300">Décris ta figure ratée — l'IA identifie tes erreurs et te livre des drills concrets pour la corriger.</p>
              </div>
            </div>

            {/* Spot finder big */}
            <div className="md:col-span-7 group relative overflow-hidden border border-[#262626] hover:border-[#1E6BFF]/60 transition" data-testid="feature-spots">
              <img src={SPOT_IMG} alt="" className="w-full h-80 object-cover opacity-50 group-hover:opacity-70 transition" />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
              <div className="absolute inset-0 flex items-center">
                <div className="p-8 max-w-md">
                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#1E6BFF] text-[#1E6BFF] text-xs font-display tracking-wider mb-4">
                    <MapPin className="h-3 w-3" /> PREMIUM · SPOT FINDER
                  </div>
                  <h3 className="font-display text-3xl md:text-4xl mb-3">LE BON SPOT,<br/>LE BON JOUR.</h3>
                  <p className="text-gray-300 mb-4">L'IA croise ton poids, ton matériel et le vent réel pour te proposer le spot le plus safe pour ton niveau.</p>
                  <Link to="/pricing" className="inline-flex items-center gap-2 text-[#1E6BFF] font-display tracking-wider hover:gap-4 transition-all">
                    DÉBLOQUER LE PREMIUM <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-[#262626]">
        <div className="max-w-5xl mx-auto text-center">
          <Wind className="h-12 w-12 text-[#1E6BFF] mx-auto mb-6" />
          <h2 className="font-display text-4xl md:text-6xl mb-6">
            T'ES PRÊT À <span className="text-[#1E6BFF]">PROGRESSER</span> ?
          </h2>
          <p className="text-gray-400 mb-10 text-lg">Rejoins RIDEMIND. Coaching personnel. Résultats mesurables.</p>
          <button
            data-testid="bottom-cta"
            onClick={handleStart}
            className="bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-10 py-5 font-display text-lg tracking-wider transition"
          >
            JE COMMENCE
          </button>
        </div>
      </section>
    </div>
  );
}
