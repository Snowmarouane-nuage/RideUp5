import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Upload, Sparkles, Lock } from "lucide-react";

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

  if (locked) {
    return (
      <LockedView title="ANALYSE VIDÉO IA" />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-[#1E6BFF] font-display text-xs tracking-[0.3em] mb-2">COACHING IA</div>
        <h1 className="font-display text-4xl md:text-6xl mb-3">ANALYSE <span className="text-[#1E6BFF]">VIDÉO</span></h1>
        <p className="text-gray-400 mb-10 max-w-2xl">Upload ta vidéo (optionnel) et décris la figure ou la session. Claude Sonnet 4.5 te livre un retour technique structuré.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={submit} className="p-8 border border-[#262626] bg-[#0A0A0A] space-y-5" data-testid="analysis-form">
            <div>
              <label className="block font-display text-xs tracking-wider mb-2 text-gray-300">SPORT</label>
              <select
                data-testid="sport-select"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full bg-black border border-[#262626] px-4 py-3 focus:border-[#1E6BFF] outline-none"
              >
                <option value="kitesurf">Kitesurf</option>
                <option value="wakeboard">Wakeboard</option>
                <option value="foil">Foil</option>
                <option value="surf">Surf</option>
              </select>
            </div>
            <div>
              <label className="block font-display text-xs tracking-wider mb-2 text-gray-300">NIVEAU</label>
              <select
                data-testid="level-select"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-black border border-[#262626] px-4 py-3 focus:border-[#1E6BFF] outline-none"
              >
                <option>Débutant</option>
                <option>Intermédiaire</option>
                <option>Avancé</option>
                <option>Pro</option>
              </select>
            </div>
            <div>
              <label className="block font-display text-xs tracking-wider mb-2 text-gray-300">DÉCRIS TA SESSION / TON PROBLÈME</label>
              <textarea
                data-testid="description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Ex: Je tente mon premier backroll mais je tombe sur le dos systématiquement. Vent 22 kts, kite 9m..."
                className="w-full bg-black border border-[#262626] px-4 py-3 focus:border-[#1E6BFF] outline-none resize-none"
              />
            </div>
            <div>
              <label className="block font-display text-xs tracking-wider mb-2 text-gray-300">VIDÉO (OPTIONNEL · MAX 100MB)</label>
              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#262626] bg-black cursor-pointer hover:border-[#1E6BFF] transition">
                <Upload className="h-5 w-5 text-[#1E6BFF]" />
                <span className="text-sm text-gray-400">{file ? file.name : "Sélectionne une vidéo de ta session"}</span>
                <input
                  data-testid="video-file-input"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            {error && <div className="text-red-500 text-sm" data-testid="analysis-error">{error}</div>}
            <button
              data-testid="analysis-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E6BFF] hover:bg-[#1751C4] text-white py-4 font-display tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="h-5 w-5" />
              {loading ? "ANALYSE EN COURS..." : "ANALYSER MA SESSION"}
            </button>
          </form>

          <div className="p-8 border border-[#262626] bg-[#0A0A0A] min-h-[400px]" data-testid="analysis-result">
            <div className="font-display text-xl mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#1E6BFF]" /> RETOUR DE COACH IA
            </div>
            {loading && <div className="text-gray-400 animate-pulse">Claude analyse ta session...</div>}
            {!loading && !result && <div className="text-gray-500 text-sm">Ton analyse apparaîtra ici.</div>}
            {result && (
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-gray-200 leading-relaxed">
                {result.feedback}
              </div>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-12">
            <div className="font-display text-2xl mb-4">HISTORIQUE</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.slice(0, 4).map((h) => (
                <div key={h.analysis_id} className="p-4 border border-[#262626] bg-[#0A0A0A] text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-[#1E6BFF] text-xs tracking-wider">{h.sport.toUpperCase()} · {h.level.toUpperCase()}</span>
                    <span className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <div className="text-gray-300 line-clamp-2 mb-2">{h.description}</div>
                  <div className="text-gray-400 text-xs line-clamp-3">{h.feedback}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LockedView({ title }) {
  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-2xl mx-auto text-center p-12 border border-[#262626] bg-[#0A0A0A]">
        <Lock className="h-16 w-16 text-[#1E6BFF] mx-auto mb-6" />
        <h1 className="font-display text-3xl md:text-5xl mb-4">{title}</h1>
        <p className="text-gray-400 mb-8">Cette fonctionnalité nécessite un abonnement actif.</p>
        <Link to="/pricing" className="inline-block bg-[#1E6BFF] hover:bg-[#1751C4] text-white px-8 py-4 font-display tracking-wider">
          VOIR LES ABONNEMENTS
        </Link>
      </div>
    </div>
  );
}
