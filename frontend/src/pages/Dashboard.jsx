import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Video, BookOpen, MapPin, Crown, ArrowRight, Lock } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  const isPremium = user.plan === "premium";
  const hasPlan = !!user.plan;

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <div className="text-[#1E6BFF] font-display text-xs tracking-[0.3em] mb-2">DASHBOARD</div>
            <h1 className="font-display text-4xl md:text-6xl">SALUT <span className="text-[#1E6BFF]">{user.name.split(" ")[0].toUpperCase()}</span></h1>
            <p className="text-gray-400 mt-2">Prêt pour ta prochaine session ?</p>
          </div>
          <div className="flex items-center gap-3">
            {hasPlan ? (
              <div className="px-4 py-2 border border-[#1E6BFF] text-[#1E6BFF] font-display text-sm tracking-wider flex items-center gap-2">
                <Crown className="h-4 w-4" /> {user.plan.toUpperCase()} ACTIF
              </div>
            ) : (
              <Link
                data-testid="dash-upgrade"
                to="/pricing"
                className="bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-5 py-3 font-display tracking-wider transition"
              >
                ACTIVER UN ABONNEMENT
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card to="/video-analysis" icon={<Video className="h-7 w-7" />} title="ANALYSE VIDÉO" desc="Décrypte tes sessions avec Claude AI." locked={!hasPlan} testId="card-video" />
          <Card to="/courses" icon={<BookOpen className="h-7 w-7" />} title="COURS" desc="Progresse avec nos modules structurés." locked={!hasPlan} testId="card-courses" />
          <Card
            to="/spot-recommender"
            icon={<MapPin className="h-7 w-7" />}
            title="SPOT FINDER"
            desc="L'IA trouve ton spot idéal selon les conditions."
            locked={!isPremium}
            premium
            testId="card-spots"
          />
        </div>

        <div className="mt-12 p-8 border border-[#262626] bg-[#0A0A0A]">
          <div className="font-display text-2xl mb-2">ASTUCE DU JOUR</div>
          <p className="text-gray-300">Avant ta session : vérifie la fenêtre de vent, fais tes pre-flight checks (lignes, barre, leash) et identifie ta sortie de secours côté plage. La sécurité avant la perf.</p>
        </div>
      </div>
    </div>
  );
}

function Card({ to, icon, title, desc, locked, premium, testId }) {
  return (
    <Link
      to={locked ? "/pricing" : to}
      data-testid={testId}
      className={`group relative block p-8 border transition-all hover:-translate-y-1 ${
        locked ? "border-[#262626] bg-[#0A0A0A] opacity-80" : "border-[#262626] bg-[#0A0A0A] hover:border-[#1E6BFF]/60"
      }`}
    >
      {premium && (
        <div className="absolute top-3 right-3 text-[10px] font-display tracking-widest px-2 py-1 bg-[#1E6BFF] text-white">PREMIUM</div>
      )}
      <div className="text-[#1E6BFF] mb-4">{locked ? <Lock className="h-7 w-7" /> : icon}</div>
      <div className="font-display text-2xl mb-2">{title}</div>
      <p className="text-gray-400 text-sm mb-6">{desc}</p>
      <div className="inline-flex items-center gap-2 text-sm font-display tracking-wider text-[#1E6BFF] group-hover:gap-3 transition-all">
        {locked ? "DÉBLOQUER" : "OUVRIR"} <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
