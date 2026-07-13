import { Link } from "react-router-dom";
import { Lock, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { loginPath } from "@/lib/auth";

export function FeatureGate({ title, description, requirePremium = false, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 px-6 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-[#9AB8FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <GateShell
        icon={<LogIn className="h-16 w-16 text-[#9AB8FF] mx-auto mb-6" />}
        title={title}
        description={description || "Connecte-toi pour accéder à cette fonctionnalité."}
        action={
          <Link to={loginPath()} className="inline-block bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider">
            SE CONNECTER
          </Link>
        }
      />
    );
  }

  if (!user.plan && !user.is_admin) {
    return (
      <GateShell
        icon={<Lock className="h-16 w-16 text-[#9AB8FF] mx-auto mb-6" />}
        title={title}
        description={description || "Cette fonctionnalité nécessite un abonnement actif."}
        action={
          <Link to="/pricing" className="inline-block bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider">
            VOIR LES ABONNEMENTS
          </Link>
        }
      />
    );
  }

  if (requirePremium && user.plan !== "premium" && !user.is_admin) {
    return (
      <GateShell
        icon={<Lock className="h-16 w-16 text-[#9AB8FF] mx-auto mb-6" />}
        title={title}
        description="Le Spot Finder est réservé à l'abonnement Premium."
        action={
          <Link to="/pricing" className="inline-block bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider">
            PASSER EN PREMIUM
          </Link>
        }
      />
    );
  }

  return children;
}

function GateShell({ icon, title, description, action }) {
  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-2xl mx-auto text-center p-12 border border-[#262626] bg-[#0A0A0A]">
        {icon}
        <h1 className="font-display text-3xl md:text-5xl mb-4">{title}</h1>
        <p className="text-gray-400 mb-8">{description}</p>
        {action}
      </div>
    </div>
  );
}
