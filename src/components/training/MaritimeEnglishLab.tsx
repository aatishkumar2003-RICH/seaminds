import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Volume2, ChevronLeft, RotateCcw, Flame, Trophy, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCENARIOS, VI_HINTS, scoreAnswer, loadProgress, recordAttempt, dailyScenario, level, today, type Scenario, type ScoreResult, type Domain } from "@/lib/maritimeEnglish";

const DOMAINS: Domain[] = ["Bridge & VHF", "Engine Room", "Safety & Emergency", "PSC & Vetting"];

const speak = (text: string) => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB"; u.rate = 0.92;
  window.speechSynthesis.speak(u);
};

const Drill = ({ sc, isDaily, onDone, onBack }: { sc: Scenario; isDaily: boolean; onDone: (s: number) => void; onBack: () => void }) => {
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [showVi, setShowVi] = useState(() => localStorage.getItem("sm_eng_vi") === "1");
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
        {VI_HINTS[sc.id] && (
          <div>
            <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => { const v = !showVi; setShowVi(v); localStorage.setItem("sm_eng_vi", v ? "1" : "0"); }}>
              🇻🇳 {showVi ? "Ẩn gợi ý tiếng Việt" : "Gợi ý tiếng Việt"}
            </button>
            {showVi && <p className="mt-1 text-xs rounded-lg bg-background border border-border p-2">{VI_HINTS[sc.id]} <em>Trả lời bằng tiếng Anh.</em></p>}
          </div>
        )}
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
          <Button variant="outline" className="w-full rounded-xl" onClick={() => { setResult(null); setAnswer(""); speak(sc.incoming); }}><RotateCcw size={16} /> Try again (practice is unlimited)</Button>
        </div>
      )}
    </div>
  );
};

const MaritimeEnglishLab = () => {
  const [progress, setProgress] = useState(loadProgress);
  const [active, setActive] = useState<{ sc: Scenario; daily: boolean } | null>(null);
  const [domain, setDomain] = useState<Domain | "ALL">("ALL");
  const daily = useMemo(() => dailyScenario(), []);
  const recent = progress.history.slice(-10);
  const avg = recent.length ? Math.round(recent.reduce((n, h) => n + h.s, 0) / recent.length) : 0;
  const mastered = Object.values(progress.best).filter((s) => s >= 85).length;
  const doneToday = progress.daily[today()] !== undefined;

  if (active) return <Drill sc={active.sc} isDaily={active.daily} onBack={() => setActive(null)}
    onDone={(s) => setProgress((p) => recordAttempt(p, active.sc.id, s, active.daily))} />;

  const list = SCENARIOS.filter((s) => domain === "ALL" || s.domain === domain);
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
        <p className="text-xs text-muted-foreground">{daily.domain} · {doneToday ? "Practice again anytime" : "Complete it to keep your streak"}</p>
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
      <p className="text-[11px] text-muted-foreground">SeaMinds practice based on IMO SMCP principles. It is not an official IELTS, Marlins or STCW certificate.</p>
    </div>
  );
};

export default MaritimeEnglishLab;
