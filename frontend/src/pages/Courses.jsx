import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Play, Lock, Clock } from "lucide-react";
import { FALLBACK_COURSES } from "@/constants/courses";

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(FALLBACK_COURSES);
  const [apiError, setApiError] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api
      .get("/courses")
      .then((r) => {
        setCourses(r.data);
        setApiError(false);
      })
      .catch(() => setApiError(true));
  }, []);

  const locked = !user?.plan && !user?.is_admin;
  const filtered = filter === "all" ? courses : courses.filter((c) => c.sport === filter);

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">BIBLIOTHÈQUE</div>
        <h1 className="font-display text-4xl md:text-6xl mb-6">COURS <span className="text-[#9AB8FF]">KITESURF EN LIGNE</span></h1>
        <p className="text-gray-400 max-w-2xl mb-10">
          Modules vidéo pour apprendre le kitesurf et progresser en freestyle : bases, sécurité, transitions
          et figures. Wakeboard et foil arrivent bientôt.
        </p>

        <div className="flex flex-wrap gap-2 mb-10">
          {[
            { id: "all", label: "TOUS", soon: false },
            { id: "kitesurf", label: "KITESURF", soon: false },
            { id: "wakeboard", label: "WAKEBOARD", soon: true },
            { id: "foil", label: "FOIL", soon: true },
          ].map((s) => (
            <button
              key={s.id}
              data-testid={`filter-${s.id}`}
              onClick={() => !s.soon && setFilter(s.id)}
              disabled={s.soon}
              className={`px-4 py-2 font-display tracking-wider text-sm transition flex items-center gap-2 ${
                filter === s.id ? "bg-[#9AB8FF] text-white" : "border border-[#262626] text-gray-300 hover:border-[#9AB8FF]"
              } ${s.soon ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {s.label}
              {s.soon && <span className="text-[9px] tracking-widest text-[#9AB8FF] border border-[#9AB8FF]/60 px-1.5">À VENIR</span>}
            </button>
          ))}
        </div>

        {apiError && (
          <div className="mb-6 p-4 border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
            Catalogue affiché en mode hors-ligne. Démarre le backend pour synchroniser les données live.
          </div>
        )}

        {!user && (
          <div className="mb-10 p-6 border border-[#262626] bg-[#0A0A0A] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="font-display text-xl">CONNECTE-TOI</div>
              <div className="text-sm text-gray-400">Le catalogue est visible, mais la progression nécessite un compte.</div>
            </div>
            <Link data-testid="courses-login" to="/pricing" className="border border-[#9AB8FF] text-[#9AB8FF] px-5 py-3 font-display tracking-wider">
              COMMENCER
            </Link>
          </div>
        )}
        {user && locked && (
          <div className="mb-10 p-6 border border-[#9AB8FF]/50 bg-[#9AB8FF]/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="font-display text-xl">ACCÈS RESTREINT</div>
              <div className="text-sm text-gray-400">Souscris un abonnement pour débloquer tous les cours.</div>
            </div>
            <Link data-testid="courses-upgrade" to="/pricing" className="bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-5 py-3 font-display tracking-wider">
              VOIR LES PLANS
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <div key={c.id} data-testid={`course-${c.id}`} className={`group relative border border-[#262626] bg-[#0A0A0A] hover:border-[#9AB8FF]/60 transition-all ${c.coming_soon ? "opacity-70" : ""}`}>
              <div className="relative overflow-hidden">
                <img src={c.thumbnail} alt={c.title} className="w-full h-56 object-cover group-hover:scale-105 transition duration-500" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  {c.coming_soon ? (
                    <div className="text-center">
                      <Lock className="h-10 w-10 text-white mx-auto mb-1" />
                      <div className="text-[10px] font-display tracking-[0.25em] text-[#9AB8FF] border border-[#9AB8FF] px-2 py-0.5 bg-black/70">À VENIR</div>
                    </div>
                  ) : locked ? (
                    <Lock className="h-12 w-12 text-white" />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-[#9AB8FF] flex items-center justify-center group-hover:scale-110 transition">
                      <Play className="h-7 w-7 text-white fill-white ml-1" />
                    </div>
                  )}
                </div>
                <div className="absolute top-3 left-3 text-[10px] font-display tracking-widest px-2 py-1 bg-black/80 text-white border border-white/20">
                  {c.sport.toUpperCase()}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span className="text-[#9AB8FF] font-display tracking-wider">{c.level.toUpperCase()}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {c.duration}</span>
                </div>
                <h3 className="font-display text-xl mb-2 leading-tight">{c.title}</h3>
                <p className="text-sm text-gray-400">{c.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
