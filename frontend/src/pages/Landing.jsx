import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Wind, Video, MapPin, Sparkles, Activity, Target } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { loginPath } from "@/lib/auth";

const HERO_IMAGES = [
  { urls: ["https://images.unsplash.com/photo-1627068477565-3a66d5f76d5e?fm=jpg&q=85&w=2000&auto=format&fit=crop"], label: "KITESURF", available: true },
  {
    urls: [
      "https://images.unsplash.com/photo-1666032234128-abc3e45bd1dc?fm=jpg&q=85&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1752170053218-5f05ccfbee4e?fm=jpg&q=85&w=1200&auto=format&fit=crop",
    ],
    label: "WAKE BOAT / CABLE",
    available: false,
  },
  { urls: ["https://images.unsplash.com/photo-1502680390469-be75c86b636f?fm=jpg&q=85&w=2000&auto=format&fit=crop"], label: "SURF", available: false },
];
const VIDEO_IMG = "https://images.unsplash.com/photo-1601900957092-ae3e67b47b03?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const COURSE_IMG = "https://images.unsplash.com/photo-1578060124065-41f863eb9ebe?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const SPOT_IMG = "https://images.unsplash.com/photo-1632990848833-2e7007adb204?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const FEEDBACK_IMG = "https://images.unsplash.com/photo-1502933691298-84fc14542831?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % HERO_IMAGES.length), 4500);
    return () => clearInterval(id);
  }, []);

  const handleStart = () => {
    if (user) {
      navigate("/dashboard");
      return;
    }
    navigate(loginPath("/dashboard"));
  };

  return (
    <main className="bg-black text-white">
      {/* HERO */}
      <section
        data-testid="hero-section"
        aria-label="Coaching kitesurf et sports de glisse"
        className="relative min-h-[95vh] flex items-center overflow-hidden bg-black"
      >
        {/* Slideshow layers with crossfade */}
        {HERO_IMAGES.map((img, i) => (
          <div
            key={img.label}
            className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out flex"
            style={{ opacity: slide === i ? 1 : 0 }}
          >
            {img.urls.map((u, idx) => (
              <div
                key={u}
                className="relative h-full"
                style={{
                  flex: 1,
                  backgroundImage: `url(${u})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {img.urls.length > 1 && (
                  <div className="absolute bottom-8 left-6 z-10 hidden md:block">
                    <span className="font-display text-xs tracking-[0.3em] text-white/80 bg-black/40 px-2 py-1 border border-white/20">
                      {idx === 0 ? "BOAT" : "CABLE PARK"}
                    </span>
                  </div>
                )}
                {img.urls.length > 1 && idx === 0 && (
                  <div className="absolute right-0 top-0 bottom-0 w-px bg-white/30" />
                )}
              </div>
            ))}
          </div>
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
              {!img.available && (
                <span className="text-[9px] tracking-widest text-[#9AB8FF] font-display border border-[#9AB8FF]/60 px-1.5 py-0.5">À VENIR</span>
              )}
              <span className="font-display text-xs tracking-[0.3em] text-white">{img.label}</span>
              <span className={`block h-0.5 transition-all ${slide === i ? "w-12 bg-[#9AB8FF]" : "w-6 bg-white/40"}`} />
            </button>
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-32 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#9AB8FF] text-[#9AB8FF] text-xs font-display tracking-wider mb-6">
              <Activity className="h-3 w-3" /> COACHING PREMIUM · KITE <span className="text-gray-500 normal-case tracking-normal">+ wake / foil / surf bientôt</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-6">
              COACHING KITESURF<br /><span className="text-[#9AB8FF]">PROGRESS YOUR RIDE.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-xl mb-10 leading-relaxed">
              Plateforme de coaching pour kitesurf, wakeboard, foil et surf : analyse vidéo de tes figures,
              coach personnel et Spot Finder selon le vent et ton matériel.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                data-testid="hero-cta-start"
                onClick={handleStart}
                className="group bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider flex items-center gap-3 transition-all hover:translate-x-1"
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
              <div><span className="text-[#9AB8FF] text-2xl block">15.99€</span>PREMIUM/MOIS</div>
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
            <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-3">CE QUE TU OBTIENS</div>
            <h2 className="font-display text-4xl md:text-6xl leading-none">UNE PLATEFORME,<br/><span className="text-[#9AB8FF]">TOUTE LA GLISSE.</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Big card: Video analysis */}
            <div className="md:col-span-7 group relative overflow-hidden border border-[#262626] hover:border-[#9AB8FF]/60 transition" data-testid="feature-video">
              <img src={VIDEO_IMG} alt="Analyse vidéo kitesurf — rider en session" className="w-full h-80 object-cover opacity-60 group-hover:opacity-80 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#9AB8FF] text-white text-xs font-display tracking-wider mb-4">
                  <Video className="h-3 w-3" /> ANALYSE IA
                </div>
                <h3 className="font-display text-3xl md:text-4xl mb-2">ANALYSE VIDÉO KITESURF</h3>
                <p className="text-gray-300 max-w-md">Envoie un clip de 20 secondes. Un coach expert lit ta figure et te donne diagnostic, corrections et drills pour progresser plus vite.</p>
              </div>
            </div>

            {/* Courses */}
            <div className="md:col-span-5 group relative overflow-hidden border border-[#262626] hover:border-[#9AB8FF]/60 transition" data-testid="feature-courses">
              <img src={COURSE_IMG} alt="Cours kitesurf en ligne pour débutants et avancés" className="w-full h-80 object-cover opacity-60 group-hover:opacity-80 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-black text-xs font-display tracking-wider mb-4">
                  <Sparkles className="h-3 w-3" /> COURS
                </div>
                <h3 className="font-display text-3xl mb-2">COURS KITESURF EN LIGNE</h3>
                <p className="text-gray-300">Modules structurés du débutant au rider avancé : bases, freestyle et progression trick par trick.</p>
              </div>
            </div>

            {/* AI Feedback / Points d'amélioration */}
            <div className="md:col-span-5 group relative overflow-hidden border border-[#262626] hover:border-[#9AB8FF]/60 transition" data-testid="feature-feedback">
              <img src={FEEDBACK_IMG} alt="Coaching personnalisé pour corriger une figure de kitesurf" className="w-full h-80 object-cover opacity-50 group-hover:opacity-75 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#9AB8FF] text-white text-xs font-display tracking-wider mb-4">
                  <Target className="h-3 w-3" /> POINTS D'AMÉLIORATION
                </div>
                <h3 className="font-display text-3xl mb-2">CORRIGE TES FIGURES</h3>
                <p className="text-gray-300">Backroll, raley, transition… Décris ce qui bloque : le coach identifie l&apos;erreur et te propose un plan d&apos;entraînement concret.</p>
              </div>
            </div>

            {/* Spot finder big */}
            <div className="md:col-span-7 group relative overflow-hidden border border-[#262626] hover:border-[#9AB8FF]/60 transition" data-testid="feature-spots">
              <img src={SPOT_IMG} alt="Spot Finder kitesurf — choix du spot selon le vent" className="w-full h-80 object-cover opacity-50 group-hover:opacity-70 transition" />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
              <div className="absolute inset-0 flex items-center">
                <div className="p-8 max-w-md">
                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#9AB8FF] text-[#9AB8FF] text-xs font-display tracking-wider mb-4">
                    <MapPin className="h-3 w-3" /> PREMIUM · SPOT FINDER
                  </div>
                  <h3 className="font-display text-3xl md:text-4xl mb-3">SPOT KITESURF IDÉAL</h3>
                  <p className="text-gray-300 mb-4">Spot Finder Premium : vent en temps réel, ton quiver et ton niveau pour trouver le spot le plus sûr et le plus fun.</p>
                  <Link to="/pricing" className="inline-flex items-center gap-2 text-[#9AB8FF] font-display tracking-wider hover:gap-4 transition-all">
                    DÉBLOQUER LE PREMIUM <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEO — contenu indexable */}
      <section className="py-20 px-6 border-t border-[#262626]" aria-labelledby="seo-why-rideup">
        <div className="max-w-7xl mx-auto">
          <h2 id="seo-why-rideup" className="font-display text-3xl md:text-5xl mb-4">
            POURQUOI CHOISIR <span className="text-[#9AB8FF]">RIDE&apos;UP</span> ?
          </h2>
          <p className="text-gray-400 max-w-3xl mb-12 leading-relaxed">
            RIDE&apos;UP est la plateforme de coaching dédiée aux sports de glisse. Que tu rides en kitesurf,
            wakeboard, foil ou surf, tu obtiens un retour technique personnalisé, une roadmap de progression
            et des recommandations de spots adaptées aux conditions du jour.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <article className="p-6 border border-[#262626] bg-[#0A0A0A]">
              <h3 className="font-display text-xl text-[#9AB8FF] mb-3">Analyse vidéo de figures</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Filme ta session, envoie un clip de 20 secondes et reçois une analyse détaillée :
                posture, timing du pop, position du kite et conseils pour débloquer ta prochaine figure.
              </p>
            </article>
            <article className="p-6 border border-[#262626] bg-[#0A0A0A]">
              <h3 className="font-display text-xl text-[#9AB8FF] mb-3">Coach personnel kitesurf</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Roadmap trick par trick, suivi de progression et chat coaching pour avancer
                du niveau débutant au freestyle avancé, à ton rythme.
              </p>
            </article>
            <article className="p-6 border border-[#262626] bg-[#0A0A0A]">
              <h3 className="font-display text-xl text-[#9AB8FF] mb-3">Spots &amp; conditions de vent</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Spot Finder et prévisions week-end : trouve où rider selon le vent, ton matériel
                et ton niveau, en France et en Europe.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-[#262626]">
        <div className="max-w-5xl mx-auto text-center">
          <Wind className="h-12 w-12 text-[#9AB8FF] mx-auto mb-6" />
          <h2 className="font-display text-4xl md:text-6xl mb-6">
            T'ES PRÊT À <span className="text-[#9AB8FF]">PROGRESSER</span> ?
          </h2>
          <p className="text-gray-400 mb-10 text-lg">
            Rejoins RIDE&apos;UP : coaching kitesurf en ligne, analyse vidéo et progression mesurable.
          </p>
          <button
            data-testid="bottom-cta"
            onClick={handleStart}
            className="bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-10 py-5 font-display text-lg tracking-wider transition"
          >
            JE COMMENCE
          </button>
        </div>
      </section>
    </main>
  );
}
