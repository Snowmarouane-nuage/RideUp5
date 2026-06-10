import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Upload, Sparkles, Lock, Target, Dumbbell, ShieldCheck, Award, ListChecks } from "lucide-react";

export default function VideoAnalysis() {
  const { user } = useAuth();
  const [sport, setSport] = useState("kitesurf");
  const [level, setLevel] = useState("Intermédiaire");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const locked = !user?.plan;

  useEffect(() => {
    if (!locked) {
      api.get("/video-analysis/history").then((r) => setHistory(r.data)).catch(() => {});
    }
  }, [locked]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError("Décris ta question ou la figure que tu veux analyser.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("sport", sport);
      fd.append("level", level);
      fd.append("description", description);
      if (file) fd.append("video", file);
      const r = await api.post("/video-analysis", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
      const h = await api.get("/video-analysis/history");
      setHistory(h.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  if (locked) return <LockedView title="ANALYSE VIDÉO IA" />;

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">COACHING IA</div>
        <h1 className="font-display text-4xl md:text-6xl mb-3">ANALYSE <span className="text-[#9AB8FF]">VIDÉO</span></h1>
        <p className="text-gray-400 mb-10 max-w-2xl">Upload ta vidéo (optionnel) et décris la figure ou la session. L&apos;agent RIDE’UP te livre un retour technique structuré.</p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <form onSubmit={submit} className="lg:col-span-2 p-8 border border-[#262626] bg-[#0A0A0A] space-y-5 h-fit" data-testid="analysis-form">
            <Field label="SPORT">
              <select data-testid="sport-select" value={sport} onChange={(e) => setSport(e.target.value)} className="va-input">
                <option value="kitesurf">Kitesurf</option>
                <option value="wakeboard" disabled>Wakeboard (à venir)</option>
                <option value="foil" disabled>Foil (à venir)</option>
                <option value="surf" disabled>Surf (à venir)</option>
              </select>
            </Field>
            <Field label="NIVEAU">
              <select data-testid="level-select" value={level} onChange={(e) => setLevel(e.target.value)} className="va-input">
                <option>Débutant</option>
                <option>Intermédiaire</option>
                <option>Avancé</option>
                <option>Pro</option>
              </select>
            </Field>
            <Field label="DÉCRIS TA SESSION / TON PROBLÈME">
              <textarea
                data-testid="description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Ex: Je tente mon premier backroll mais je tombe sur le dos systématiquement. Vent 22 kts, kite 9m..."
                className="va-input resize-none"
              />
            </Field>
            <Field label="VIDÉO (OPTIONNEL · MAX 100MB)">
              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#262626] bg-black cursor-pointer hover:border-[#9AB8FF] transition">
                <Upload className="h-5 w-5 text-[#9AB8FF]" />
                <span className="text-sm text-gray-400">{file ? file.name : "Sélectionne une vidéo de ta session"}</span>
                <input data-testid="video-file-input" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
            </Field>
            {error && <div className="text-red-500 text-sm" data-testid="analysis-error">{error}</div>}
            <button
              data-testid="analysis-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white py-4 font-display tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="h-5 w-5" />
              {loading ? "ANALYSE EN COURS..." : "ANALYSER MA SESSION"}
            </button>
          </form>

          {/* Result */}
          <div className="lg:col-span-3 min-h-[400px]" data-testid="analysis-result">
            {!loading && !result && (
              <div className="p-12 border border-dashed border-[#262626] bg-[#0A0A0A] text-center text-gray-500">
                <Sparkles className="h-10 w-10 text-[#9AB8FF] mx-auto mb-3" />
                Le retour de l&apos;agent RIDE’UP apparaîtra ici.
              </div>
            )}
            {loading && (
              <div className="p-12 border border-[#262626] bg-[#0A0A0A] text-center">
                <div className="h-12 w-12 mx-auto rounded-full border-4 border-[#9AB8FF] border-t-transparent animate-spin mb-4" />
                <div className="text-gray-300 font-display tracking-wider">L&apos;AGENT RIDE’UP ANALYSE TA SESSION...</div>
                <div className="text-gray-500 text-xs mt-2">Quelques secondes</div>
              </div>
            )}
            {result && <StructuredAnalysis data={result.structured || {}} />}
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display text-2xl">HISTORIQUE</div>
              {result && (
                <button
                  data-testid="new-analysis-btn"
                  onClick={() => { setResult(null); setDescription(""); setFile(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="text-xs font-display tracking-wider text-[#9AB8FF] hover:underline"
                >
                  + NOUVELLE ANALYSE
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.slice(0, 6).map((h) => {
                const isActive = result?.analysis_id === h.analysis_id;
                return (
                  <button
                    type="button"
                    key={h.analysis_id}
                    data-testid={`history-item-${h.analysis_id}`}
                    onClick={() => {
                      setResult(h);
                      window.scrollTo({ top: 300, behavior: "smooth" });
                    }}
                    className={`text-left p-4 border bg-[#0A0A0A] text-sm transition hover:border-[#9AB8FF] hover:-translate-y-0.5 ${isActive ? "border-[#9AB8FF] ring-2 ring-[#9AB8FF]/30" : "border-[#262626]"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display text-[#9AB8FF] text-xs tracking-wider">{h.sport.toUpperCase()} · {h.level.toUpperCase()}</span>
                      <span className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div className="text-gray-300 line-clamp-2 mb-2">{h.description}</div>
                    <div className="text-gray-400 text-xs line-clamp-3">
                      {h.structured?.headline || h.feedback?.slice(0, 200)}
                    </div>
                    {isActive && (
                      <div className="mt-2 text-[10px] font-display tracking-widest text-[#9AB8FF]">▸ AFFICHÉ CI-DESSUS</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .va-input { width: 100%; background: #000; border: 1px solid #262626; padding: 10px 14px; outline: none; }
        .va-input:focus { border-color: #9AB8FF; }
      `}</style>
    </div>
  );
}

function StructuredAnalysis({ data }) {
  const { headline, diagnostic, corrections = [], drills = [], securite, niveau_estime } = data;
  return (
    <div className="space-y-4" data-testid="structured-analysis">
      {/* Headline */}
      <div className="p-6 border-2 border-[#9AB8FF] bg-gradient-to-br from-[#9AB8FF]/15 to-transparent">
        <div className="flex items-center gap-2 text-[#9AB8FF] font-display text-xs tracking-widest mb-2">
          <Sparkles className="h-3 w-3" /> SYNTHÈSE
        </div>
        <div className="font-display text-2xl md:text-3xl leading-tight">{headline}</div>
        {niveau_estime && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs font-display tracking-wider text-gray-300">
            <Award className="h-3 w-3 text-[#9AB8FF]" /> NIVEAU LU : {niveau_estime.toUpperCase()}
          </div>
        )}
      </div>

      {/* Diagnostic */}
      {diagnostic && (
        <Section icon={<ListChecks className="h-4 w-4" />} title="DIAGNOSTIC">
          <p className="text-gray-200 leading-relaxed">{diagnostic}</p>
        </Section>
      )}

      {/* Corrections */}
      {corrections.length > 0 && (
        <Section icon={<Target className="h-4 w-4" />} title="POINTS À CORRIGER">
          <ul className="space-y-3">
            {corrections.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-[#9AB8FF] text-lg leading-none">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="font-display text-sm tracking-wide text-white">{c.titre}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Drills */}
      {drills.length > 0 && (
        <Section icon={<Dumbbell className="h-4 w-4" />} title="DRILLS D'ENTRAÎNEMENT">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {drills.map((d, i) => (
              <div key={i} className="p-4 border border-[#9AB8FF]/30 bg-black/40">
                <div className="font-display text-sm tracking-wide text-[#9AB8FF] mb-1">DRILL {i + 1}</div>
                <div className="font-display text-base text-white mb-1">{d.nom}</div>
                <div className="text-xs text-gray-400">{d.description}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Sécurité */}
      {securite && (
        <Section icon={<ShieldCheck className="h-4 w-4" />} title="SÉCURITÉ" accent="amber">
          <p className="text-gray-200 leading-relaxed">{securite}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children, accent }) {
  const border = accent === "amber" ? "border-amber-500/40 bg-amber-500/5" : "border-[#262626] bg-[#0A0A0A]";
  const tone = accent === "amber" ? "text-amber-400" : "text-[#9AB8FF]";
  return (
    <div className={`p-6 border ${border}`}>
      <div className={`flex items-center gap-2 ${tone} font-display text-xs tracking-widest mb-3`}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-display text-xs tracking-wider mb-2 text-gray-300">{label}</label>
      {children}
    </div>
  );
}

function LockedView({ title }) {
  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-2xl mx-auto text-center p-12 border border-[#262626] bg-[#0A0A0A]">
        <Lock className="h-16 w-16 text-[#9AB8FF] mx-auto mb-6" />
        <h1 className="font-display text-3xl md:text-5xl mb-4">{title}</h1>
        <p className="text-gray-400 mb-8">Cette fonctionnalité nécessite un abonnement actif.</p>
        <Link to="/pricing" className="inline-block bg-[#9AB8FF] hover:bg-[#7A9CE8] text-white px-8 py-4 font-display tracking-wider">
          VOIR LES ABONNEMENTS
        </Link>
      </div>
    </div>
  );
}
