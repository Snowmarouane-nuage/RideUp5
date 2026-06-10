import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Video, BookOpen, MapPin, Crown, ArrowRight, Lock, Award, TrendingUp, Calendar, Sparkles, MessageCircle } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  const isPremium = user.plan === "premium";
  const hasPlan = !!user.plan;

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-[#1E6BFF] font-display text-xs tracking-[0.3em] mb-2">DASHBOARD</div>
            <h1 className="font-display text-4xl md:text-6xl">SALUT <span className="text-[#1E6BFF]">{user.name.split(" ")[0].toUpperCase()}</span></h1>
            <p className="text-gray-400 mt-2">Voici l&apos;état de ta progression.</p>
          </div>
          <div className="flex items-center gap-3">
            {hasPlan ? (
              <div className="px-4 py-2 border border-[#1E6BFF] text-[#1E6BFF] font-display text-sm tracking-wider flex items-center gap-2">
                <Crown className="h-4 w-4" /> {user.plan.toUpperCase()} ACTIF
              </div>
            ) : (
              <Link data-testid="dash-upgrade" to="/pricing" className="bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-5 py-3 font-display tracking-wider transition">
                ACTIVER UN ABONNEMENT
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        {hasPlan && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<Video className="h-5 w-5" />} label="ANALYSES" value={stats.total_analyses} />
              <StatCard icon={<Award className="h-5 w-5" />} label="TRICKS VALIDÉS" value={`${stats.tricks_done}/${stats.tricks_total}`} />
              <StatCard icon={<Calendar className="h-5 w-5" />} label="JOURS ACTIF" value={stats.days_active} />
              <StatCard icon={<TrendingUp className="h-5 w-5" />} label="STREAK 8 SEM" value={stats.weekly_chart.reduce((s, w) => s + w.count, 0)} />
            </div>

            {/* Coach encouragement + chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              <div className="lg:col-span-2 p-6 border border-[#262626] bg-[#0A0A0A]">
                <div className="font-display text-xs tracking-widest text-[#1E6BFF] mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> ACTIVITÉ — 8 DERNIÈRES SEMAINES
                </div>
                <ProgressChart data={stats.weekly_chart} />
              </div>
              <div className="p-6 border-2 border-[#1E6BFF] bg-gradient-to-br from-[#1E6BFF]/15 to-transparent">
                <div className="font-display text-xs tracking-widest text-[#1E6BFF] mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> MOT DU COACH
                </div>
                <p className="text-gray-100 leading-relaxed whitespace-pre-wrap text-sm">{stats.encouragement}</p>
                <Link to="/coach" className="mt-4 inline-flex items-center gap-2 text-[#1E6BFF] text-xs font-display tracking-wider hover:gap-3 transition-all">
                  OUVRIR LE COACH <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Onboarding hint */}
            {!stats.has_coach_profile && (
              <div className="p-6 border-2 border-dashed border-[#1E6BFF]/50 bg-[#1E6BFF]/5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-display text-xl mb-1">Pas encore de coach personnel ?</div>
                  <p className="text-sm text-gray-300">Configure ton coach IA en 1 minute pour générer une roadmap trick-par-trick personnalisée.</p>
                </div>
                <Link data-testid="cta-coach-onboarding" to="/coach" className="bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-5 py-3 font-display tracking-wider whitespace-nowrap">
                  CONFIGURER MON COACH
                </Link>
              </div>
            )}

            {/* Recent analyses */}
            {stats.recent_analyses && stats.recent_analyses.length > 0 && (
              <div className="mb-8">
                <div className="font-display text-2xl mb-4">DERNIÈRES ANALYSES</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.recent_analyses.map((a, i) => (
                    <Link key={i} to="/video-analysis" className="p-4 border border-[#262626] bg-[#0A0A0A] hover:border-[#1E6BFF]/50 transition">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span className="font-display text-[#1E6BFF] tracking-wider">{a.sport.toUpperCase()} · {a.level.toUpperCase()}</span>
                        <span>{new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <p className="text-sm text-gray-200 line-clamp-3">{a.headline}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {hasPlan && loading && (
          <div className="text-gray-400 py-12 text-center animate-pulse">Chargement de tes stats...</div>
        )}

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card to="/coach" icon={<MessageCircle className="h-7 w-7" />} title="COACH IA" desc="Roadmap perso + chat trick-par-trick." locked={!hasPlan} testId="card-coach" />
          <Card to="/video-analysis" icon={<Video className="h-7 w-7" />} title="ANALYSE VIDÉO" desc="Décrypte tes sessions avec l'agent RIDE’UP." locked={!hasPlan} testId="card-video" />
          <Card to="/courses" icon={<BookOpen className="h-7 w-7" />} title="COURS" desc="Progresse avec nos modules structurés." locked={!hasPlan} testId="card-courses" />
          <Card to="/spot-recommender" icon={<MapPin className="h-7 w-7" />} title="SPOT FINDER" desc="L'IA trouve ton spot idéal selon les conditions." locked={!isPremium} premium testId="card-spots" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="p-4 border border-[#262626] bg-[#0A0A0A]">
      <div className="flex items-center gap-2 text-[#1E6BFF] mb-2">{icon}<span className="font-display text-[10px] tracking-widest text-gray-400">{label}</span></div>
      <div className="font-display text-3xl">{value}</div>
    </div>
  );
}

function ProgressChart({ data = [] }) {
  // data: array of {week_offset, count} where 7 = oldest, 0 = current week
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end justify-between gap-1 h-32" data-testid="progress-chart">
      {data.map((d, i) => {
        const h = (d.count / max) * 100;
        const isCurrent = d.week_offset === 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2">
            <div className="text-[10px] font-display tracking-wider text-gray-500 h-3">{d.count > 0 ? d.count : ""}</div>
            <div
              className={`w-full transition-all duration-500 ${isCurrent ? "bg-[#1E6BFF]" : "bg-[#1E6BFF]/40"}`}
              style={{ height: `${Math.max(2, h)}%`, minHeight: d.count > 0 ? "8px" : "2px" }}
            />
            <div className="text-[9px] font-display tracking-wider text-gray-500">{isCurrent ? "AUJ" : `-${d.week_offset}S`}</div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ to, icon, title, desc, locked, premium, testId }) {
  return (
    <Link
      to={locked ? "/pricing" : to}
      data-testid={testId}
      className={`group relative block p-6 border transition-all hover:-translate-y-1 ${
        locked ? "border-[#262626] bg-[#0A0A0A] opacity-80" : "border-[#262626] bg-[#0A0A0A] hover:border-[#1E6BFF]/60"
      }`}
    >
      {premium && (
        <div className="absolute top-3 right-3 text-[10px] font-display tracking-widest px-2 py-1 bg-[#1E6BFF] text-white">PREMIUM</div>
      )}
      <div className="text-[#1E6BFF] mb-3">{locked ? <Lock className="h-6 w-6" /> : icon}</div>
      <div className="font-display text-xl mb-1">{title}</div>
      <p className="text-gray-400 text-sm mb-4">{desc}</p>
      <div className="inline-flex items-center gap-2 text-xs font-display tracking-wider text-[#1E6BFF] group-hover:gap-3 transition-all">
        {locked ? "DÉBLOQUER" : "OUVRIR"} <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
