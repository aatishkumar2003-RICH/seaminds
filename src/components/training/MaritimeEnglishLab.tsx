import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Volume2, ChevronLeft, RotateCcw, Flame, Trophy, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SCENARIOS, scoreAnswer, loadProgress, recordAttempt, dailyScenario, level, today, pickVariant, deptOf, rankOrdered, nextRecommended, type Scenario, type ScoreResult, type Domain, type Dept, type Progress } from "@/lib/maritimeEnglish";
import { HINTS, HINT_LANGS, defaultHintLang, type HintLang } from "@/lib/maritimeEnglishHints";

const DOMAINS: Domain[] = ["Bridge & VHF", "Engine Room", "Deck & Ratings", "Safety & Emergency", "PSC & Vetting"];
const LANG_KEY = "sm_eng_hint_lang";

const speak = (text: string) => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB"; u.rate = 0.92;
  window.speechSynthesis.speak(u);
};

const Drill = ({ sc: base, isDaily, lang, setLang, onDone, onBack }: { sc: Scenario; isDaily: boolean; lang: HintLang | null; setLang: (l: HintLang | null) => void; onDone: (s: number) => void; onBack: () => void }) => {
  const [sc, setSc] = useState(() => pickVariant(base));
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const recRef = useRef<any>(null);
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  useEffect(() => { speak(sc.incoming); return () => { window.speechSynthesis?.cancel(); recRef.current?.stop?.(); }; }, [sc]);

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const r = new SR(); r.lang = "en-US"; r.interimResults = true; r.continuous = true;
    let finalText = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " "; else interim += e.results[i][0].transcript;
      }
      setAnswer((finalText + interim).trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; setResult(null); setAnswer(""); r.start(); setListening(true);
  };

  const check = () => { const s = scoreAnswer(sc, answer); setResult(s); onDone(s.total); };

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="px-0 text-primary" onClick={onBack}><ChevronLeft /> All scenarios</Button>
      <div className="rounded-2xl border border-primary/40 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-primary">{isDaily ? "⭐ TODAY'S CHALLENGE" : sc.domain.toUpperCase()}</span>
          <span className="text-muted-foreground">{sc.task}</span>
        </div>
        <h2 className="text-lg font-bold">{sc.title}</h2>
        <div className="rounded-xl bg-background p-3 font-mono text-sm border border-border">
          <div className="flex items-center gap-2 text-primary text-xs mb-1"><Radio size={14} /> CH 16 · INCOMING</div>
          {sc.incoming}
        </div>
        <Button variant="outline" size="sm" onClick={() => speak(sc.incoming)}><Volume2 size={16} /> Play again</Button>
        <p className="text-sm"><span className="font-semibold text-primary">Your task: </span>{sc.instruction}</p>
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5">
            {HINT_LANGS.map((l) => (
              <button key={l.code} type="button" onClick={() => setLang(lang === l.code ? null : l.code)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${lang === l.code ? "bg-primary text-primary-foreground border-primary" : "border-primary/40 text-primary"}`}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
          {lang && HINTS[lang][sc.id] && <p className="text-xs rounded-lg bg-background border border-border p-2">{HINTS[lang][sc.id]} <em>{HINT_LANGS.find((l) => l.code === lang)?.answerInEnglish}</em></p>}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {SR ? (
          <button type="button" onClick={toggleMic} aria-label={listening ? "Stop speaking" : "Push to talk"}
            className={`h-24 w-24 rounded-full flex items-center justify-center border-4 transition ${listening ? "bg-destructive border-destructive/50 animate-pulse text-destructive-foreground" : "bg-primary border-primary/40 text-primary-foreground"}`}>
            {listening ? <MicOff size={36} /> : <Mic size={36} />}
          </button>
        ) : null}
        <p className="text-xs text-muted-foreground">{SR ? (listening ? "Speaking… tap to stop" : "Tap and speak your reply in English") : "Voice not supported on this browser — type your reply"}</p>
      </div>

      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="Your reply appears here (you can also type)…"
        className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
      <Button className="w-full rounded-xl font-bold" disabled={!answer.trim() || listening} onClick={check}>Check my answer</Button>

      {result && (
        <div className="rounded-2xl border border-primary/40 bg-card p-4 space-y-3">
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-primary">{result.total}<span className="text-base text-muted-foreground">/100</span></p>
            <p className="text-sm font-semibold">{result.total >= 85 ? "🎉 Excellent!" : result.total >= 60 ? "👍 Good — almost there" : "💪 Keep going"}</p>
          </div>
          {([["Safe meaning", result.meaning], ["Radio protocol", result.protocol], ["Fluency", result.fluency]] as const).map(([l, v]) => (
            <div key={l}><div className="flex justify-between text-xs"><span>{l}</span><span>{v}%</span></div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden"><div className="h-full bg-primary" style={{ width: `${v}%` }} /></div></div>
          ))}
          {result.tips.length > 0 && <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">{result.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
          <div className="rounded-xl bg-background p-3 text-sm border border-border">
            <p className="text-xs text-primary font-semibold mb-1">Model answer</p>{sc.model}
            <Button variant="link" size="sm" className="px-0" onClick={() => speak(sc.model)}><Volume2 size={14} /> Listen & repeat</Button>
          </div>
          <Button variant="outline" className="w-full rounded-xl" onClick={() => { setResult(null); setAnswer(""); setSc(pickVariant(base)); }}><RotateCcw size={16} /> Try a new version (practice is unlimited)</Button>
        </div>
      )}
    </div>
  );
};

const MaritimeEnglishLab = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [active, setActive] = useState<{ sc: Scenario; daily: boolean } | null>(null);
  const [domain, setDomain] = useState<Domain | "ALL">("ALL");
  const [dept, setDept] = useState<Dept>("all");
  const [lang, setLangState] = useState<HintLang | null>(() => (localStorage.getItem(LANG_KEY) as HintLang) || null);
  const setLang = (l: HintLang | null) => { setLangState(l); localStorage.setItem(LANG_KEY, l ?? ""); };
  const daily = useMemo(() => dailyScenario(today(), dept), [dept]);
  const recommended = useMemo(() => nextRecommended(dept, progress.best), [dept, progress.best]);

  // Cloud progress: rank/nationality personalise; server summary survives phone changes.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [{ data: prof }, { data: sum }] = await Promise.all([
        supabase.from("crew_profiles").select("rank, nationality").eq("id", user.id).maybeSingle(),
        supabase.rpc("get_my_english_summary"),
      ]);
      if (!alive) return;
      setDept(deptOf((prof as any)?.rank));
      if (localStorage.getItem(LANG_KEY) === null) { const d = defaultHintLang((prof as any)?.nationality); if (d) setLang(d); }
      const s = sum as any;
      if (s?.ok) setProgress((p) => ({ ...p, streak: s.streak, best: { ...p.best, ...s.best }, daily: { ...p.daily, ...s.daily } }));
    })();
    return () => { alive = false; };
  }, [user]);

  const onDone = async (sc: Scenario, s: number, isDaily: boolean) => {
    setProgress((p) => recordAttempt(p, sc.id, s, isDaily));
    if (!user) return;
    const { data } = await supabase.rpc("record_english_attempt", { p_scenario: sc.id, p_score: s, p_daily: isDaily });
    const r = data as any;
    if (r?.ok) {
      setProgress((p) => ({ ...p, streak: r.streak }));
      if (r.credited > 0) toast.success(`🔥 ${r.streak}-day streak! +${r.credited} credits added to your wallet`);
    }
  };
  const recent = progress.history.slice(-10);
  const avg = recent.length ? Math.round(recent.reduce((n, h) => n + h.s, 0) / recent.length) : 0;
  const mastered = Object.values(progress.best).filter((s) => s >= 85).length;
  const doneToday = progress.daily[today()] !== undefined;

  if (active) return <Drill key={active.sc.id + active.daily} sc={active.sc} isDaily={active.daily} lang={lang} setLang={setLang} onBack={() => setActive(null)}
    onDone={(s) => onDone(active.sc, s, active.daily)} />;

  const list = rankOrdered(dept).filter((s) => domain === "ALL" || s.domain === domain);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/40 bg-card p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Maritime English Voice Lab</p>
        <h2 className="text-xl font-bold">Speak like a professional at sea</h2>
        <p className="text-xs text-muted-foreground">Practice IMO SMCP radio phrases, readbacks and inspection answers. Scored on safe meaning — not your accent.</p>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="rounded-xl bg-background p-2"><Flame className="mx-auto text-primary" size={18} /><p className="font-bold">{progress.streak}</p><p className="text-[10px] text-muted-foreground">Day streak</p></div>
          <div className="rounded-xl bg-background p-2"><Trophy className="mx-auto text-primary" size={18} /><p className="font-bold">{mastered}/{SCENARIOS.length}</p><p className="text-[10px] text-muted-foreground">Mastered</p></div>
          <div className="rounded-xl bg-background p-2"><p className="font-bold text-primary text-lg">{avg || "–"}</p><p className="text-[10px] text-muted-foreground">{avg ? level(avg) : "Readiness"}</p></div>
        </div>
      </div>

      <button type="button" onClick={() => setActive({ sc: daily, daily: true })} className="w-full text-left rounded-2xl border-2 border-primary bg-primary/10 p-4">
        <p className="text-xs font-bold text-primary">⭐ TODAY'S 2-MINUTE CHALLENGE {doneToday && `· Done (${progress.daily[today()]})`}</p>
        <p className="font-bold">{daily.title}</p>
        <p className="text-xs text-muted-foreground">{daily.domain} · {doneToday ? "Practice again anytime" : "Complete it to keep your streak — every 7 days in a row earns +5 credits"}</p>
      </button>

      <button type="button" onClick={() => setActive({ sc: recommended, daily: false })} className="w-full text-left rounded-2xl border border-primary/40 bg-card p-3">
        <p className="text-xs font-bold text-primary">🎯 RECOMMENDED FOR YOU{dept !== "all" ? ` · ${dept === "deck" ? "Deck" : dept === "engine" ? "Engine" : "Ratings"}` : ""}</p>
        <p className="text-sm font-semibold">{recommended.title}</p>
        <p className="text-xs text-muted-foreground">{progress.best[recommended.id] !== undefined ? `Your weakest so far (best ${progress.best[recommended.id]})` : "Not tried yet"}</p>
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["ALL", ...DOMAINS] as const).map((d) => (
          <button key={d} onClick={() => setDomain(d)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border ${domain === d ? "bg-primary text-primary-foreground border-primary" : "border-primary/40 text-primary"}`}>{d === "ALL" ? "All" : d}</button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map((s) => (
          <button key={s.id} type="button" onClick={() => setActive({ sc: s, daily: false })} className="w-full text-left rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{(progress.best[s.id] ?? 0) >= 85 ? "✓ " : ""}{s.title}</p><p className="text-xs text-muted-foreground">{s.domain} · {s.task}</p></div>
            <span className="text-xs font-bold text-primary">{progress.best[s.id] !== undefined ? `Best ${progress.best[s.id]}` : "Start"}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{user ? "Progress is saved to your account. " : "Sign in to save progress and earn streak credits. "}SeaMinds practice based on IMO SMCP principles. It is not an official IELTS, Marlins or STCW certificate.</p>
    </div>
  );
};

export default MaritimeEnglishLab;
