import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Check, Send, Target, Award, MessageCircle, ArrowRight } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";

export default function Coach() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("roadmap");

  useEffect(() => {
    if (!user?.plan) { setLoading(false); return; }
    api.get("/coach/profile")
      .then((r) => setProfile(r.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading && user?.plan) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 px-6 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-[#9AB8FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  const content = !profile ? (
    <Onboarding onDone={(p) => setProfile(p)} />
  ) : (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">COACH IA</div>
        <h1 className="font-display text-4xl md:text-6xl mb-3">COACH <span className="text-[#9AB8FF]">KITESURF PERSONNEL</span></h1>
        <p className="text-gray-300 max-w-3xl mb-8">{profile.welcome}</p>

        <div className="flex gap-2 mb-8 border-b border-[#262626]">
          <TabBtn active={tab === "roadmap"} onClick={() => setTab("roadmap")} testId="tab-roadmap"><Target className="h-4 w-4" /> ROADMAP</TabBtn>
          <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} testId="tab-chat"><MessageCircle className="h-4 w-4" /> CHAT COACH</TabBtn>
        </div>

        {tab === "roadmap" && <Roadmap profile={profile} setProfile={setProfile} />}
        {tab === "chat" && <ChatPanel profile={profile} setProfile={setProfile} />}
      </div>
    </div>
  );

  return (
    <FeatureGate
      title="COACH KITESURF PERSONNEL"
      description="Roadmap de figures, chat coaching et suivi de progression trick par trick."
    >
      {content}
    </FeatureGate>
  );
}

function TabBtn({ active, onClick, children, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`px-4 py-3 font-display tracking-wider text-sm flex items-center gap-2 transition border-b-2 -mb-px ${active ? "border-[#9AB8FF] text-white" : "border-transparent text-gray-400 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ level: "Intermédiaire", sport: "kitesurf", current_tricks: [], goal: "" });
  const [newTrick, setNewTrick] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const r = await api.post("/coach/onboarding", data);
      onDone(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">COACH IA · ONBOARDING</div>
        <h1 className="font-display text-4xl md:text-5xl mb-6">FAISONS <span className="text-[#9AB8FF]">CONNAISSANCE</span></h1>

        {step === 0 && (
          <div className="p-8 border border-[#262626] bg-[#0A0A0A] space-y-5" data-testid="onboarding-step-0">
            <div className="font-display text-lg">Ton niveau actuel ?</div>
            <div className="grid grid-cols-2 gap-3">
              {["Débutant", "Intermédiaire", "Avancé", "Pro"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`level-${lvl}`}
                  onClick={() => setData({ ...data, level: lvl })}
                  className={`p-4 border font-display tracking-wider transition ${data.level === lvl ? "border-[#9AB8FF] bg-[#9AB8FF]/15" : "border-[#262626] hover:border-[#9AB8FF]/50"}`}
                >
                  {lvl.toUpperCase()}
                </button>
              ))}
            </div>
            <button data-testid="ob-next-0" onClick={() => setStep(1)} className="w-full bg-[#9AB8FF] hover:bg-[#7A9CE8] py-3 font-display tracking-wider mt-4">SUITE →</button>
          </div>
        )}

        {step === 1 && (
          <div className="p-8 border border-[#262626] bg-[#0A0A0A] space-y-5" data-testid="onboarding-step-1">
            <div className="font-display text-lg">Tricks que tu maîtrises déjà</div>
            <div className="text-sm text-gray-400">Ajoute-les un par un (ex: water start, transitions, premier saut)</div>
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {data.current_tricks.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#9AB8FF]/15 border border-[#9AB8FF]/50 text-sm">
                  {t}
                  <button type="button" onClick={() => setData({ ...data, current_tricks: data.current_tricks.filter((_, idx) => idx !== i) })} className="text-[#9AB8FF] hover:text-white text-base leading-none ml-1">×</button>
                </span>
              ))}
              {data.current_tricks.length === 0 && <span className="text-xs text-gray-500 self-center">aucun pour le moment</span>}
            </div>
            <div className="flex gap-2">
              <input
                data-testid="trick-input"
                value={newTrick}
                onChange={(e) => setNewTrick(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTrick.trim()) { e.preventDefault(); setData({ ...data, current_tricks: [...data.current_tricks, newTrick.trim()] }); setNewTrick(""); } }}
                placeholder="ex: water start"
                className="flex-1 bg-black border border-[#262626] px-3 py-2 outline-none focus:border-[#9AB8FF]"
              />
              <button type="button" data-testid="add-trick" onClick={() => { if (newTrick.trim()) { setData({ ...data, current_tricks: [...data.current_tricks, newTrick.trim()] }); setNewTrick(""); } }} className="px-4 border border-[#262626] hover:border-[#9AB8FF] text-sm font-display tracking-wider">AJOUTER</button>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setStep(0)} className="px-5 py-3 border border-[#262626] hover:border-[#9AB8FF] font-display tracking-wider">← RETOUR</button>
              <button type="button" data-testid="ob-next-1" onClick={() => setStep(2)} className="flex-1 bg-[#9AB8FF] hover:bg-[#7A9CE8] py-3 font-display tracking-wider">SUITE →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 border border-[#262626] bg-[#0A0A0A] space-y-5" data-testid="onboarding-step-2">
            <div className="font-display text-lg">Ton objectif principal ?</div>
            <textarea
              data-testid="goal-input"
              value={data.goal}
              onChange={(e) => setData({ ...data, goal: e.target.value })}
              rows={4}
              placeholder="Ex: Réussir mon premier backroll cet été et naviguer en bord de fenêtre sans tomber."
              className="w-full bg-black border border-[#262626] px-3 py-3 outline-none focus:border-[#9AB8FF] resize-none"
            />
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setStep(1)} className="px-5 py-3 border border-[#262626] hover:border-[#9AB8FF] font-display tracking-wider">← RETOUR</button>
              <button
                type="button"
                data-testid="ob-finish"
                onClick={submit}
                disabled={submitting}
                className="flex-1 bg-[#9AB8FF] hover:bg-[#7A9CE8] py-3 font-display tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" /> {submitting ? "GÉNÉRATION DE TA ROADMAP..." : "GÉNÉRER MA ROADMAP"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Roadmap({ profile, setProfile }) {
  const roadmap = profile.roadmap || [];
  const done = roadmap.filter((t) => t.status === "done").length;
  const pct = roadmap.length > 0 ? Math.round((done / roadmap.length) * 100) : 0;

  const markDone = async (trick) => {
    try {
      const r = await api.post("/coach/trick/complete", { trick });
      setProfile(r.data);
    } catch {}
  };

  // Find next undone
  const nextIdx = roadmap.findIndex((t) => t.status !== "done");

  return (
    <div className="space-y-6" data-testid="roadmap-panel">
      {/* Progress */}
      <div className="p-6 border-2 border-[#9AB8FF] bg-gradient-to-br from-[#9AB8FF]/15 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-xs tracking-widest text-[#9AB8FF] flex items-center gap-2"><Award className="h-3 w-3" /> PROGRESSION GLOBALE</div>
          <div className="font-display text-2xl">{done}<span className="text-gray-500">/{roadmap.length}</span></div>
        </div>
        <div className="h-2 bg-[#262626] overflow-hidden">
          <div className="h-full bg-[#9AB8FF] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-2">{pct}% de ta roadmap validée</div>
      </div>

      {/* Tricks list */}
      <div className="space-y-3">
        {roadmap.map((t, i) => {
          const isDone = t.status === "done";
          const isCurrent = i === nextIdx;
          return (
            <div
              key={t.trick}
              data-testid={`trick-${i}`}
              className={`p-5 border ${isDone ? "border-[#262626] opacity-60" : isCurrent ? "border-[#9AB8FF] bg-[#9AB8FF]/5" : "border-[#262626]"} bg-[#0A0A0A] flex items-center gap-4`}
            >
              <div className={`w-10 h-10 flex items-center justify-center font-display ${isDone ? "bg-[#9AB8FF] text-white" : "border border-[#262626] text-gray-500"}`}>
                {isDone ? <Check className="h-5 w-5" /> : String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1">
                <div className="font-display text-lg flex items-center gap-2 flex-wrap">
                  {t.trick}
                  {isCurrent && <span className="text-[10px] font-display tracking-widest bg-[#9AB8FF] text-white px-2 py-0.5">EN COURS</span>}
                </div>
                <div className="text-sm text-gray-400">{t.why}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-display tracking-wider">DIFF {t.difficulty}/5</span>
                {!isDone && (
                  <button
                    data-testid={`mark-done-${i}`}
                    onClick={() => markDone(t.trick)}
                    className="text-xs px-3 py-2 border border-[#9AB8FF] text-[#9AB8FF] hover:bg-[#9AB8FF] hover:text-white font-display tracking-wider transition"
                  >
                    VALIDÉ
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {done === roadmap.length && roadmap.length > 0 && (
        <div className="p-6 border-2 border-[#9AB8FF] bg-[#9AB8FF]/10 text-center">
          <div className="font-display text-2xl mb-2">ROADMAP COMPLÉTÉE 🤘</div>
          <p className="text-gray-300">Tu as tout validé. Ouvre le chat coach pour passer au niveau supérieur.</p>
        </div>
      )}
    </div>
  );
}

function ChatPanel({ profile, setProfile }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState(profile.messages || []);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", text, at: new Date().toISOString() }]);
    try {
      const r = await api.post("/coach/chat", { message: text });
      setMessages(r.data.messages || []);
      setProfile({ ...profile, messages: r.data.messages || [] });
    } catch (err) {
      setMessages((m) => [...m, { role: "coach", text: "Désolé, j'ai un souci technique. Retente dans quelques secondes.", at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="chat-panel">
      <div ref={scrollRef} className="h-[500px] overflow-y-auto p-6 border border-[#262626] bg-[#0A0A0A] space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <MessageCircle className="h-10 w-10 text-[#9AB8FF] mx-auto mb-3" />
            <div className="font-display text-lg text-white mb-1">DÉBUTE LA CONVERSATION</div>
            <p className="text-sm">Pose une question sur un trick, demande des conseils, ou parle de ta dernière session.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] p-3 ${m.role === "user" ? "bg-[#9AB8FF] text-white" : "bg-[#1a1a1a] text-gray-100 border border-[#262626]"}`}>
              <div className="text-[10px] font-display tracking-widest mb-1 opacity-70">{m.role === "user" ? "TOI" : "COACH"}</div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] border border-[#262626] p-3">
              <div className="text-[10px] font-display tracking-widest mb-1 opacity-70 text-gray-400">COACH</div>
              <div className="flex gap-1">
                <span className="h-2 w-2 bg-[#9AB8FF] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="h-2 w-2 bg-[#9AB8FF] rounded-full animate-bounce" style={{ animationDelay: "120ms" }}></span>
                <span className="h-2 w-2 bg-[#9AB8FF] rounded-full animate-bounce" style={{ animationDelay: "240ms" }}></span>
              </div>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question au coach..."
          className="flex-1 bg-black border border-[#262626] px-4 py-3 outline-none focus:border-[#9AB8FF]"
        />
        <button data-testid="chat-send" type="submit" disabled={sending || !input.trim()} className="px-5 bg-[#9AB8FF] hover:bg-[#7A9CE8] disabled:opacity-50 transition flex items-center gap-2 font-display tracking-wider">
          <Send className="h-4 w-4" /> ENVOYER
        </button>
      </form>
      <div className="text-xs text-gray-500 text-center">Le coach se souvient de tes derniers échanges et de ta roadmap.</div>
    </div>
  );
}
