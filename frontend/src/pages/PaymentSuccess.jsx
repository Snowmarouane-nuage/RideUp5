import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Check, X } from "lucide-react";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("polling");
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    let attempts = 0;
    const poll = async () => {
      attempts++;
      if (attempts > 8) { setStatus("timeout"); return; }
      try {
        const r = await api.get(`/checkout/status/${sessionId}`);
        if (r.data.payment_status === "paid") {
          await refresh();
          setStatus("paid");
          return;
        }
        if (r.data.status === "expired") { setStatus("expired"); return; }
        setTimeout(poll, 2000);
      } catch {
        setStatus("error");
      }
    };
    poll();
  }, [sessionId, refresh]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md p-12 border border-[#262626] bg-[#0A0A0A]" data-testid="payment-success">
        {status === "polling" && (
          <>
            <div className="h-16 w-16 mx-auto mb-6 rounded-full border-4 border-[#9AB8FF] border-t-transparent animate-spin" />
            <h1 className="font-display text-3xl mb-2">VALIDATION DU PAIEMENT</h1>
            <p className="text-gray-400">Quelques secondes...</p>
          </>
        )}
        {status === "paid" && (
          <>
            <div className="h-16 w-16 mx-auto mb-6 rounded-full bg-[#9AB8FF] flex items-center justify-center">
              <Check className="h-10 w-10 text-white" />
            </div>
            <h1 className="font-display text-3xl mb-2">PAIEMENT CONFIRMÉ</h1>
            <p className="text-gray-400 mb-6">
              Ton abonnement RIDE&apos;UP est actif. Bienvenue dans la team.
              {sessionId?.startsWith("dev_") && (
                <span className="block mt-2 text-xs text-gray-500">Mode développement (Stripe non configuré)</span>
              )}
            </p>
            <button data-testid="goto-dashboard" onClick={() => navigate("/dashboard")} className="bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider">
              ACCÉDER AU DASHBOARD
            </button>
          </>
        )}
        {(status === "error" || status === "timeout" || status === "expired") && (
          <>
            <div className="h-16 w-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="h-10 w-10 text-red-500" />
            </div>
            <h1 className="font-display text-3xl mb-2">PROBLÈME</h1>
            <p className="text-gray-400 mb-6">Impossible de confirmer le paiement. Contacte le support si besoin.</p>
            <button onClick={() => navigate("/pricing")} className="border-2 border-white text-white px-8 py-4 font-display tracking-wider hover:bg-white hover:text-black">
              RETOUR AUX ABONNEMENTS
            </button>
          </>
        )}
      </div>
    </div>
  );
}
