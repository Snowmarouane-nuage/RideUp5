import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Users,
  Video,
  Crown,
  Euro,
  MessageCircle,
  Database,
  TrendingUp,
  CreditCard,
  Shield,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { loginPath } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!isSiteAdmin(user)) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    api
      .get("/admin/access")
      .then(() => api.get("/admin/overview"))
      .then((r) => setData(r.data))
      .catch((e) => {
        if (e.response?.status === 403) {
          setAccessDenied(true);
        } else {
          setError(e.response?.data?.detail || "Impossible de charger les stats");
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-[#9AB8FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginPath("/admin")} replace />;
  }

  if (accessDenied || !isSiteAdmin(user)) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
        <div className="max-w-lg mx-auto text-center p-12 border border-[#262626] bg-[#0A0A0A]">
          <Shield className="h-12 w-12 text-[#9AB8FF] mx-auto mb-4" />
          <h1 className="font-display text-3xl mb-3">ACCÈS REFUSÉ</h1>
          <p className="text-gray-400 mb-6">
            Cette page est réservée aux administrateurs du site. Ajoute ton email dans{" "}
            <code className="text-[#9AB8FF]">ADMIN_EMAILS</code> du backend.
          </p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-[#9AB8FF] font-display text-sm tracking-wider hover:gap-3 transition-all">
            MON DASHBOARD <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const totals = data?.totals || {};

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2 flex items-center gap-2">
              <Shield className="h-3 w-3" /> ADMINISTRATION
            </div>
            <h1 className="font-display text-4xl md:text-6xl">
              TABLEAU DE BORD <span className="text-[#9AB8FF]">SITE</span>
            </h1>
            <p className="text-gray-400 mt-2">Vue d&apos;ensemble de RIDE&apos;UP — utilisateurs, abonnements et activité.</p>
          </div>
          {data?.db_backend && (
            <div className="flex items-center gap-2 px-4 py-2 border border-[#262626] text-xs font-display tracking-wider text-gray-400">
              <Database className="h-4 w-4 text-[#9AB8FF]" />
              BASE : {data.db_backend.toUpperCase()}
            </div>
          )}
        </div>

        {loading && (
          <div className="text-gray-400 py-16 text-center animate-pulse">Chargement des métriques...</div>
        )}

        {error && (
          <div className="p-4 border border-red-500/40 bg-red-500/10 text-red-300 text-sm mb-8">{error}</div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
              <Kpi icon={<Users className="h-5 w-5" />} label="UTILISATEURS" value={totals.users} />
              <Kpi icon={<Crown className="h-5 w-5" />} label="ABONNÉS" value={totals.active_subscriptions} />
              <Kpi icon={<Euro className="h-5 w-5" />} label="MRR EST." value={`${totals.mrr_eur}€`} />
              <Kpi icon={<Video className="h-5 w-5" />} label="ANALYSES" value={totals.analyses} />
              <Kpi icon={<MessageCircle className="h-5 w-5" />} label="PROFILS COACH" value={totals.coach_profiles} />
              <Kpi icon={<CreditCard className="h-5 w-5" />} label="PAIEMENTS" value={totals.payments_total} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              <div className="p-6 border border-[#262626] bg-[#0A0A0A]">
                <div className="font-display text-xs tracking-widest text-[#9AB8FF] mb-4">RÉPARTITION DES PLANS</div>
                <PlanBar label="Gratuit" count={data.plans.free} total={totals.users} color="bg-gray-600" />
                <PlanBar label="Standard" count={data.plans.standard} total={totals.users} color="bg-white/70" />
                <PlanBar label="Premium" count={data.plans.premium} total={totals.users} color="bg-[#9AB8FF]" />
              </div>

              <div className="lg:col-span-2 p-6 border border-[#262626] bg-[#0A0A0A]">
                <div className="font-display text-xs tracking-widest text-[#9AB8FF] mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> INSCRIPTIONS — 8 SEMAINES
                </div>
                <BarChart data={data.weekly_signups} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <div className="p-6 border border-[#262626] bg-[#0A0A0A]">
                <div className="font-display text-xs tracking-widest text-[#9AB8FF] mb-4">ANALYSES VIDÉO — 8 SEMAINES</div>
                <BarChart data={data.weekly_analyses} />
              </div>
              <div className="p-6 border border-[#262626] bg-[#0A0A0A]">
                <div className="font-display text-xs tracking-widest text-[#9AB8FF] mb-4">SPORTS LES PLUS ANALYSÉS</div>
                {data.top_sports.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune analyse pour l&apos;instant.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.top_sports.map((s) => (
                      <li key={s.sport} className="flex items-center justify-between text-sm">
                        <span className="font-display tracking-wider uppercase">{s.sport}</span>
                        <span className="text-[#9AB8FF] font-display">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TableCard title="DERNIERS INSCRITS" empty="Aucun utilisateur">
                {data.recent_users.map((u) => (
                  <tr key={u.user_id} className="border-t border-[#1a1a1a]">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs font-display tracking-wider">
                      {u.plan ? (
                        <span className="text-[#9AB8FF]">{u.plan.toUpperCase()}</span>
                      ) : (
                        <span className="text-gray-500">FREE</span>
                      )}
                    </td>
                    <td className="py-3 text-xs text-gray-500 whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </TableCard>

              <TableCard title="DERNIERS PAIEMENTS" empty="Aucun paiement">
                {data.recent_payments.map((p) => (
                  <tr key={p.session_id} className="border-t border-[#1a1a1a]">
                    <td className="py-3 pr-4">
                      <div className="text-sm">{p.email}</div>
                      <div className="text-xs text-gray-500">{p.plan?.toUpperCase()}</div>
                    </td>
                    <td className="py-3 pr-4 text-sm font-display text-[#9AB8FF]">
                      {p.amount}€
                      {p.dev_mode && <span className="ml-1 text-[10px] text-gray-500">(dev)</span>}
                    </td>
                    <td className="py-3 text-xs text-gray-500 whitespace-nowrap">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </TableCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }) {
  return (
    <div className="p-4 border border-[#262626] bg-[#0A0A0A]">
      <div className="flex items-center gap-2 text-[#9AB8FF] mb-2">
        {icon}
        <span className="font-display text-[10px] tracking-widest text-gray-400">{label}</span>
      </div>
      <div className="font-display text-2xl md:text-3xl">{value ?? "—"}</div>
    </div>
  );
}

function PlanBar({ label, count, total, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-display text-[#9AB8FF]">
          {count} <span className="text-gray-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 bg-[#1a1a1a] overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BarChart({ data = [] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end justify-between gap-1 h-28">
      {data.map((d, i) => {
        const h = (d.count / max) * 100;
        const isCurrent = d.week_offset === 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="text-[10px] text-gray-500 h-3">{d.count > 0 ? d.count : ""}</div>
            <div
              className={`w-full ${isCurrent ? "bg-[#9AB8FF]" : "bg-[#9AB8FF]/35"}`}
              style={{ height: `${Math.max(2, h)}%`, minHeight: d.count > 0 ? "6px" : "2px" }}
            />
            <div className="text-[9px] font-display text-gray-500">{isCurrent ? "AUJ" : `-${d.week_offset}S`}</div>
          </div>
        );
      })}
    </div>
  );
}

function TableCard({ title, children, empty }) {
  const hasRows = Array.isArray(children) && children.length > 0;
  return (
    <div className="p-6 border border-[#262626] bg-[#0A0A0A] overflow-x-auto">
      <div className="font-display text-xs tracking-widest text-[#9AB8FF] mb-4">{title}</div>
      {!hasRows ? (
        <p className="text-gray-500 text-sm">{empty}</p>
      ) : (
        <table className="w-full text-left">
          <tbody>{children}</tbody>
        </table>
      )}
    </div>
  );
}
