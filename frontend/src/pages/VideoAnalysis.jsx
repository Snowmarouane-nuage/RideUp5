import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Upload, Sparkles, Target, Dumbbell, ShieldCheck, Award, ListChecks, Wind } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";

const MAX_VIDEO_MB = 100;
const MAX_VIDEO_SECONDS = 20;

function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid"));
    };
    video.src = url;
  });
}

export default function VideoAnalysis() {
  const { user } = useAuth();
  const [sport, setSport] = useState("kitesurf");
  const [level, setLevel] = useState("Intermédiaire");
  const [trick, setTrick] = useState("");
  const [problem, setProblem] = useState("");
  const [conditions, setConditions] = useState("");
  const [file, setFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadPct, setUploadPct] = useState(null);
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
    if (!file) {
      setError("Ajoute une vidéo de ta session — le coach RIDE'UP analyse les images extraites de ton clip.");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Vidéo trop lourde (max ${MAX_VIDEO_MB} MB).`);
      return;
    }
    setLoading(true);
    setUploadPct(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("sport", sport);
      fd.append("level", level);
      fd.append("trick", trick.trim());
      fd.append("problem", problem.trim());
      fd.append("conditions", conditions.trim());
      if (file) fd.append("video", file);
      const r = await api.post("/video-analysis", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 320000,
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadPct(Math.round((evt.loaded * 100) / evt.total));
          }
        },
      });
      setResult(r.data);
      const h = await api.get("/video-analysis/history");
      setHistory(h.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
      setUploadPct(null);
    }
  };

  return (
    <FeatureGate title="ANALYSE VIDÉO IA">
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">COACHING IA</div>
        <h1 className="font-display text-4xl md:text-6xl mb-3">ANALYSE <span className="text-[#9AB8FF]">VIDÉO KITESURF</span></h1>
        <p className="text-gray-400 mb-10 max-w-2xl">
          Analyse expert sur <span className="text-white">48+ images</span> par clip, concentrées autour du décollage et de la réception.
          Modèle vision <span className="text-white">GPT-4.1</span> (fallback GPT-4o). Aucune supposition.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <form onSubmit={submit} className="lg:col-span-2 p-8 border border-[#262626] bg-[#0A0A0A] space-y-5 h-fit" data-testid="analysis-form">
            <Field label="SPORT">
              <select data-testid="sport-select" value={sport} onChange={(e) => setSport(e.target.value)} className="va-input">
                <option value="kitesurf">Kitesurf</option>
                <option value="wakeboard">Wakeboard</option>
                <option value="foil">Foil</option>
                <option value="surf">Surf</option>
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
            <Field label="FIGURE TENTÉE (OPTIONNEL)">
              <input
                data-testid="trick-input"
                type="text"
                value={trick}
                onChange={(e) => setTrick(e.target.value)}
                placeholder="Laisse vide — l'IA détecte le trick. Ex: Backroll, raley…"
                className="va-input"
              />
            </Field>
            <Field label="TON PROBLÈME / QUESTION (OPTIONNEL)">
              <textarea
                data-testid="problem-input"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={4}
                placeholder="Laisse vide — l'IA identifie le problème. Ou décris ce qui bloque…"
                className="va-input resize-none"
              />
            </Field>
            <Field label="CONTEXTE (OPTIONNEL)">
              <input
                data-testid="conditions-input"
                type="text"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Vent 22 kts, kite 9m, twintip 138, spot Leucate…"
                className="va-input"
              />
            </Field>
            <Field label={`VIDÉO (OBLIGATOIRE · MAX ${MAX_VIDEO_SECONDS}S · ${MAX_VIDEO_MB} MB)`}>
              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#262626] bg-black cursor-pointer hover:border-[#9AB8FF] transition">
                <Upload className="h-5 w-5 text-[#9AB8FF]" />
                <span className="text-sm text-gray-400">
                  {file
                    ? `${file.name}${videoDuration != null ? ` · ${Math.ceil(videoDuration)}s` : ""}`
                    : `Sélectionne un clip (max ${MAX_VIDEO_SECONDS}s)`}
                </span>
                <input
                  data-testid="video-file-input"
                  type="file"
                  accept="video/*"
                  onChange={async (e) => {
                    const picked = e.target.files?.[0] || null;
                    setError(null);
                    if (!picked) {
                      setFile(null);
                      setVideoDuration(null);
                      return;
                    }
                    if (picked.size > MAX_VIDEO_MB * 1024 * 1024) {
                      setError(`Vidéo trop lourde (max ${MAX_VIDEO_MB} MB).`);
                      e.target.value = "";
                      setFile(null);
                      setVideoDuration(null);
                      return;
                    }
                    try {
                      const duration = await readVideoDuration(picked);
                      if (duration > MAX_VIDEO_SECONDS) {
                        setError(
                          `Vidéo trop longue (${Math.ceil(duration)}s). Coupe ton clip à ${MAX_VIDEO_SECONDS} secondes maximum.`
                        );
                        e.target.value = "";
                        setFile(null);
                        setVideoDuration(null);
                        return;
                      }
                      setVideoDuration(duration);
                      setFile(picked);
                    } catch {
                      setVideoDuration(null);
                      setFile(picked);
                    }
                  }}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Concentre-toi sur une seule figure ou manœuvre — 15 à 20 secondes suffisent pour une analyse précise.
              </p>
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
                <div className="text-gray-400 text-sm mt-2">
                  {uploadPct !== null && uploadPct < 100
                    ? `Envoi de la vidéo… ${uploadPct}%`
                    : "Extraction des images et analyse IA — compte 1 à 2 minutes"}
                </div>
              </div>
            )}
            {result && (
              <>
                {result.dev_mode && (
                  <div className="mb-4 p-3 border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs">
                    Mode démo — analyse simplifiée pour les tests locaux.
                  </div>
                )}
                <StructuredAnalysis data={result.structured || {}} />
              </>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display text-2xl">HISTORIQUE</div>
              {result && (
                <button
                  data-testid="new-analysis-btn"
                  onClick={() => { setResult(null); setTrick(""); setProblem(""); setConditions(""); setFile(null); setVideoDuration(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
                      {kitesurfHeadline(h.structured) || h.structured?.headline || h.feedback?.slice(0, 200)}
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
    </FeatureGate>
  );
}

function StructuredAnalysis({ data }) {
  if (isKitesurfExpert(data)) {
    return <KitesurfExpertAnalysis data={data} />;
  }
  return <LegacyCoachAnalysis data={data} />;
}

function isKitesurfExpert(data) {
  if (!data || typeof data !== "object") return false;
  return (
    data.stance !== undefined
    || data.body_rotation !== undefined
    || data.rotation_degrees !== undefined
    || data.kiteloop !== undefined
  );
}

function readField(data, key) {
  const val = data?.[key];
  if (val && typeof val === "object" && "prediction" in val) {
    return {
      prediction: val.prediction || "",
      confidence: val.confidence ?? null,
      alternatives: Array.isArray(val.alternatives) ? val.alternatives : [],
    };
  }
  const legacyConf = data?.confidence?.[key];
  return {
    prediction: typeof val === "string" ? val : "",
    confidence: legacyConf ?? null,
    alternatives: [],
  };
}

function kitesurfHeadline(data) {
  if (!isKitesurfExpert(data)) return "";
  const parts = [
    readField(data, "body_rotation").prediction,
    readField(data, "rotation_degrees").prediction,
    readField(data, "rotation_direction").prediction,
  ].filter((v) => v && v !== "Impossible à déterminer");
  ["kiteloop", "downloop", "heliloop"].forEach((k) => {
    if (readField(data, k).prediction.toLowerCase() === "oui") parts.push(k.replace("_", " "));
  });
  return parts.join(" · ");
}

function KitesurfExpertAnalysis({ data }) {
  const headline = kitesurfHeadline(data) || "Analyse kitesurf";
  const exec = data.execution || {};
  const framesCount = data.frames_analyzed;

  const fieldKeys = [
    ["stance", "Stance"],
    ["approach", "Approche"],
    ["rotation_degrees", "Rotation"],
    ["rotation_direction", "Sens rotation"],
    ["body_rotation", "Rotation corps"],
    ["kiteloop", "Kiteloop"],
    ["downloop", "Downloop"],
    ["heliloop", "Heliloop"],
    ["bar_position", "Barre"],
    ["hands", "Mains"],
    ["grab", "Grab"],
    ["board_off", "Board off"],
    ["one_foot", "One foot"],
    ["kite_position", "Position aile"],
    ["landing", "Réception"],
  ];

  return (
    <div className="space-y-4" data-testid="structured-analysis">
      <div className="p-6 border-2 border-[#9AB8FF] bg-gradient-to-br from-[#9AB8FF]/15 to-transparent">
        <div className="flex items-center gap-2 text-[#9AB8FF] font-display text-xs tracking-widest mb-2">
          <Sparkles className="h-3 w-3" /> ANALYSE EXPERT KITESURF
        </div>
        <div className="font-display text-2xl md:text-3xl leading-tight">{headline}</div>
        <p className="text-gray-500 text-xs mt-2">
          Source : vidéo uniquement — {framesCount ? `${framesCount} images analysées` : "échantillonnage intelligent"}
        </p>
      </div>

      <Section icon={<ListChecks className="h-4 w-4" />} title="OBSERVATIONS">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {fieldKeys.map(([key, label]) => {
            const { prediction, confidence, alternatives } = readField(data, key);
            if (!prediction) return null;
            return (
              <div key={key} className="p-3 border border-[#262626] bg-black/30">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-gray-500 font-display text-xs tracking-wider">{label.toUpperCase()}</span>
                  {confidence != null && confidence > 0 && (
                    <span className={`text-[10px] font-display ${confidence >= 90 ? "text-green-400" : "text-amber-400"}`}>
                      {confidence}%
                    </span>
                  )}
                </div>
                <p className="text-white">{prediction}</p>
                {alternatives.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {alternatives.map((alt, i) => (
                      <p key={i} className="text-xs text-gray-500">
                        Alt. {alt.name} ({alt.confidence}%)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {hasValues(exec) && (
        <Section icon={<Target className="h-4 w-4" />} title="QUALITÉ D'EXÉCUTION">
          <DetailGrid data={exec} labels={{
            height: "Hauteur",
            amplitude: "Amplitude",
            control: "Contrôle",
            timing: "Timing",
          }} />
        </Section>
      )}
    </div>
  );
}

function LegacyCoachAnalysis({ data }) {
  const {
    headline,
    diagnostic,
    figure_declaree,
    figure_observee,
    probleme_identifie,
    correspondance_description,
    ecart_description,
    observations_mouvement,
    analyse_voile,
    conditions,
    decollage,
    barre,
    rotation,
    grab,
    hand_pass,
    reception,
    confiance,
    confiance_explication,
    corrections = [],
    drills = [],
    securite,
    niveau_estime,
  } = data;

  const obs = observations_mouvement || {};
  const voile = analyse_voile || {};
  const loopLabels = {
    kiteloop: "Kiteloop",
    downloop: "Downloop",
    heli_loop: "Heli loop",
    loop_partiel: "Loop partiel",
    demi_loop: "Demi-loop",
    loop_engage: "Loop engagé",
    loop_avorte: "Loop avorté",
    absence_de_loop: "Absence de loop",
    contraloop: "Contraloop",
    indetermine: "Indéterminé",
  };
  const loopType = (voile.type_manoeuvre || "").toLowerCase().replace(/\s+/g, "_");
  const match = (correspondance_description || "").toLowerCase();
  const isAuto = match === "auto";
  const ignoreUser = match === "ignore";
  const matchColor =
    match === "oui" ? "text-green-400" : match === "non" ? "text-red-400" : "text-amber-400";
  const showFigureSection =
    figure_observee || probleme_identifie || (figure_declaree && !isAuto && !ignoreUser);

  return (
    <div className="space-y-4" data-testid="structured-analysis">
      <div className="p-6 border-2 border-[#9AB8FF] bg-gradient-to-br from-[#9AB8FF]/15 to-transparent">
        <div className="flex items-center gap-2 text-[#9AB8FF] font-display text-xs tracking-widest mb-2">
          <Sparkles className="h-3 w-3" /> SYNTHÈSE
        </div>
        <div className="font-display text-2xl md:text-3xl leading-tight">{headline}</div>
        <div className="mt-3 flex flex-wrap gap-3">
          {niveau_estime && (
            <span className="inline-flex items-center gap-2 text-xs font-display tracking-wider text-gray-300">
              <Award className="h-3 w-3 text-[#9AB8FF]" /> NIVEAU : {niveau_estime.toUpperCase()}
            </span>
          )}
          {confiance && (
            <span className="inline-flex items-center gap-2 text-xs font-display tracking-wider text-gray-300">
              CONFIANCE : {confiance.toUpperCase()}
            </span>
          )}
        </div>
        {confiance_explication && (
          <p className="text-gray-400 text-sm mt-2">{confiance_explication}</p>
        )}
      </div>

      {showFigureSection && (
        <Section icon={<ListChecks className="h-4 w-4" />} title={isAuto || ignoreUser ? "FIGURE DÉTECTÉE (VIDÉO)" : "DESCRIPTION VS VIDÉO"}>
          <div className="space-y-3 text-sm">
            {figure_declaree && !isAuto && !ignoreUser && (
              <div>
                <span className="text-gray-500 font-display text-xs tracking-wider">TEXTE RIDER (non utilisé pour l&apos;analyse)</span>
                <p className="text-gray-400 mt-1">{figure_declaree}</p>
              </div>
            )}
            {figure_observee && (
              <div>
                <span className="text-gray-500 font-display text-xs tracking-wider">FIGURE OBSERVÉE</span>
                <p className="text-white mt-1">{figure_observee}</p>
              </div>
            )}
            {probleme_identifie && (
              <div>
                <span className="text-gray-500 font-display text-xs tracking-wider">PROBLÈME / CRASH</span>
                <p className="text-white mt-1">{probleme_identifie}</p>
              </div>
            )}
            {correspondance_description && !isAuto && !ignoreUser && (
              <div className={`font-display text-xs tracking-wider ${matchColor}`}>
                CORRESPONDANCE TEXTE : {correspondance_description.toUpperCase()}
              </div>
            )}
            {ecart_description && (
              <p className="text-amber-200/90 text-sm border-l-2 border-amber-500/50 pl-3">{ecart_description}</p>
            )}
          </div>
        </Section>
      )}

      {conditions && hasValues(conditions) && (
        <Section icon={<Target className="h-4 w-4" />} title="1. CONDITIONS">
          <DetailGrid data={conditions} labels={{
            direction_rider: "Direction rider",
            amure: "Amure",
            main_avant: "Main avant",
            main_arriere: "Main arrière",
            sens_deplacement: "Sens déplacement",
          }} />
        </Section>
      )}

      {decollage && hasValues(decollage) && (
        <Section icon={<Target className="h-4 w-4" />} title="2. DÉCOLLAGE">
          <DetailGrid data={decollage} labels={{
            position_corps: "Corps",
            position_jambes: "Jambes",
            position_barre: "Barre",
            border_choquer: "Border / choquer",
            position_aile_horloge: "Aile (horloge)",
            trajectoire_aile: "Trajectoire aile",
            deplacement_mains: "Mains",
          }} />
        </Section>
      )}

      {barre && (
        <Section icon={<Target className="h-4 w-4" />} title="3. BARRE">
          <p className="text-gray-200 text-sm">{barre}</p>
        </Section>
      )}

      {(loopType || hasValues(voile)) && (
        <Section icon={<Wind className="h-4 w-4" />} title="4. ANALYSE DE L'AILE">
          <div className="space-y-3 text-sm">
            {loopType && (
              <div className="inline-flex px-3 py-1 border border-[#9AB8FF]/40 bg-[#9AB8FF]/10">
                <span className="text-[#9AB8FF] font-display text-xs tracking-wider">
                  {(loopLabels[loopType] || voile.type_manoeuvre).toUpperCase()}
                </span>
              </div>
            )}
            <DetailGrid data={voile} labels={{
              position_initiale: "Position initiale",
              vitesse: "Vitesse",
              acceleration: "Accélération",
              ralentissement: "Ralentissement",
              deplacement: "Déplacement",
              angle: "Angle",
              trajectoire: "Trajectoire",
              sens_loop: "Sens du loop",
              timing_rider_kite: "Timing rider/kite",
              erreurs_voile: "Erreurs voile",
            }} />
          </div>
        </Section>
      )}

      {rotation && hasValues(rotation) && (
        <Section icon={<Target className="h-4 w-4" />} title="5. ROTATION">
          <DetailGrid data={rotation} labels={{
            type: "Type",
            sens: "Sens (gauche/droite)",
          }} />
        </Section>
      )}

      {grab && hasValues(grab) && (
        <Section icon={<Target className="h-4 w-4" />} title="6. GRAB">
          <DetailGrid data={grab} labels={{
            type: "Grab",
            main: "Main",
            carre: "Carre",
            duree: "Durée",
          }} />
        </Section>
      )}

      {hand_pass && hasValues(hand_pass) && (
        <Section icon={<Target className="h-4 w-4" />} title="7. PASSAGE DE BARRE">
          <DetailGrid data={hand_pass} labels={{
            moment: "Moment",
            nombre_passes: "Nombre de passes",
          }} />
        </Section>
      )}

      {reception && hasValues(reception) && (
        <Section icon={<Target className="h-4 w-4" />} title="8. RÉCEPTION">
          <DetailGrid data={reception} labels={{
            position_aile: "Position aile",
            vitesse: "Vitesse",
            direction: "Direction",
            jambes: "Jambes",
            equilibre: "Équilibre",
            controle: "Contrôle",
          }} />
        </Section>
      )}

      {(obs.rider || obs.kite || obs.board) && (
        <Section icon={<Target className="h-4 w-4" />} title="LECTURE DU MOUVEMENT">
          <div className="grid grid-cols-1 gap-4 text-sm">
            {obs.rider && (
              <div>
                <div className="text-[#9AB8FF] font-display text-xs tracking-wider mb-1">RIDER</div>
                <p className="text-gray-200">{obs.rider}</p>
              </div>
            )}
            {obs.kite && (
              <div>
                <div className="text-[#9AB8FF] font-display text-xs tracking-wider mb-1">KITE / VOILE</div>
                <p className="text-gray-200">{obs.kite}</p>
              </div>
            )}
            {obs.board && (
              <div>
                <div className="text-[#9AB8FF] font-display text-xs tracking-wider mb-1">BOARD</div>
                <p className="text-gray-200">{obs.board}</p>
              </div>
            )}
          </div>
        </Section>
      )}

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

function hasValues(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some((v) => v != null && String(v).trim() !== "");
}

function DetailGrid({ data, labels }) {
  if (!data) return null;
  const entries = Object.entries(labels).filter(([key]) => {
    const val = data[key];
    return val != null && String(val).trim() !== "" && key !== "type_manoeuvre";
  });
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 text-sm">
      {entries.map(([key, label]) => (
        <div key={key}>
          <div className="text-gray-500 font-display text-xs tracking-wider mb-1">{label.toUpperCase()}</div>
          <p className="text-gray-200">{data[key]}</p>
        </div>
      ))}
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

