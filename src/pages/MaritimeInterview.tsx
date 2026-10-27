import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Mic, MicOff, Volume2, Square, Send, Loader2, ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useInterviewVoice } from "@/hooks/useInterviewVoice";
import { applyInterviewStep, completedReview, emptyInterview, requestTranscript, MAX_ANSWER_CHARS, MAX_TURNS } from "@/lib/maritimeInterview";
import type { ExamStep } from "../../supabase/functions/_shared/maritimeExaminer";
import seamindsLogo from "@/assets/seaminds-logo.png";

const ranks = ["Master", "Chief Officer", "Second Officer", "Third Officer", "Deck Cadet", "Bosun", "AB", "Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer", "ETO", "Engine Cadet", "Oiler"];
const vessels = [["bulk", "Bulk carrier"], ["oil_tanker", "Oil tanker"], ["chemical_tanker", "Chemical tanker"], ["gas_carrier", "Gas carrier"], ["container", "Container ship"], ["general_cargo", "General cargo"], ["ro_ro", "Ro-ro"], ["offshore", "Offshore"], ["passenger", "Passenger ship"]];
const languages = [["en-GB", "English"], ["vi-VN", "Tiếng Việt"], ["id-ID", "Bahasa Indonesia"], ["hi-IN", "हिन्दी"], ["ta-IN", "தமிழ்"], ["fil-PH", "Filipino / Tagalog"]];

function Choice({ label, value, choices, onChange }: { label: string; value: string; choices: string[][]; onChange: (value: string) => void }) {
  return <div className="space-y-2 min-w-0"><label className="text-sm text-muted-foreground">{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="h-12"><SelectValue /></SelectTrigger><SelectContent>{choices.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div>;
}

export default function MaritimeInterview() {
  const navigate = useNavigate();
  const { user, isReady, accessToken } = useAuth();
  const [rank, setRank] = useState("Second Engineer");
  const [targetRank, setTargetRank] = useState("Chief Engineer");
  const [vessel, setVessel] = useState("bulk");
  const [locale, setLocale] = useState("en-GB");
  const [consent, setConsent] = useState(false);
  const [session, setSession] = useState(emptyInterview);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const voice = useInterviewVoice(locale, text => setAnswer(a => `${a}${a ? " " : ""}${text}`.slice(0, MAX_ANSWER_CHARS)));
  const active = Boolean(session.question) && !session.done;
  const review = completedReview(session);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (isReady && !user) navigate(`/join?next=${encodeURIComponent("/maritime-interview")}`, { replace: true }); }, [isReady, user, navigate]);
  useEffect(() => {
    if (!active && !busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active, busy]);

  const submit = async (response?: string) => {
    if (inFlight.current || !user || !accessToken || (!session.question && !consent)) return;
    inFlight.current = true; setBusy(true); setError(""); voice.stop(); voice.stopSpeaking();
    try {
      const { data, error: failure } = await supabase.functions.invoke("maritime-examiner", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { rank, targetRank, vessel, language: languages.find(([l]) => l === locale)?.[1] || "English", turns: requestTranscript(session), ...(session.question ? { pendingQuestion: session.question, answer: response ?? answer.trim() } : {}) },
      });
      if (failure || data?.error) {
        let message = data?.message;
        if (!message && failure && "context" in failure && failure.context instanceof Response) {
          const body = await failure.context.clone().json().catch(() => null);
          message = body?.message;
          if (!message && failure.context.status === 401) message = "Please sign in again before continuing.";
        }
        throw new Error(message || "The examiner could not respond. Your current answer is still here. Please try again.");
      }
      const next = applyInterviewStep(session, data as ExamStep, session.question ? response ?? answer.trim() : undefined);
      if (mounted.current) { setSession(next); setAnswer(""); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Could not reach the examiner. Please try again."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const back = () => { if (active || busy) setLeaving(true); else navigate("/training"); };
  const reset = () => { voice.stop(); voice.stopSpeaking(); setSession(emptyInterview()); setAnswer(""); setError(""); setConsent(false); };

  return <main className="min-h-dvh bg-background text-foreground pb-8">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 border-b border-border py-4">
        <Button variant="ghost" className="px-0 text-primary" onClick={back}><ChevronLeft /> Back</Button>
        <img src={seamindsLogo} alt="SeaMinds" className="h-9 w-auto max-w-32 object-contain" />
        <span className="text-xs text-muted-foreground">Private practice</span>
      </header>
      {!isReady || !user ? <p className="py-10 text-muted-foreground">Preparing your interview…</p> : <>
        <section className="py-7 space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-primary"><ShieldCheck size={16} /> Deck & Engine</p>
          <h1 className="text-2xl sm:text-3xl font-bold">Maritime AI interview</h1>
          <p className="text-sm text-muted-foreground">{active ? `${rank} → ${targetRank} · ${vessels.find(([id]) => id === vessel)?.[1]}` : review ? "Your practice review" : "Promotion preparation · About 12–15 minutes · Up to 7 scenarios"}</p>
        </section>
        {!active && !review && <section className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <Choice label="Your current rank" value={rank} choices={ranks.map(r => [r, r])} onChange={setRank} />
            <Choice label="Preparing for" value={targetRank} choices={ranks.map(r => [r, r])} onChange={setTargetRank} />
            <Choice label="Vessel type" value={vessel} choices={vessels} onChange={setVessel} />
            <Choice label="Which language feels comfortable?" value={locale} choices={languages} onChange={setLocale} />
          </div>
          <p className="text-sm text-muted-foreground">Practice only — not a certificate, promotion decision or onboard operating instruction. Check the vessel’s manuals and safety procedures.</p>
          <div className="flex items-start gap-3 border-t border-border pt-5">
            <Checkbox id="interview-consent" checked={consent} disabled={busy} onCheckedChange={v => setConsent(v === true)} className="mt-1" />
            <label htmlFor="interview-consent" className="text-sm text-muted-foreground">I agree to AI processing of my answers. This practice session is not saved or shared with managers. Refreshing or leaving clears it. Optional voice may use my browser’s speech service.</label>
          </div>
          <Button className="w-full sm:w-auto rounded-xl font-bold h-12" disabled={!consent || busy} onClick={() => void submit()}>{busy ? <><Loader2 className="animate-spin motion-reduce:animate-none" /> Preparing…</> : "Start interview"}</Button>
        </section>}
        {active && <section className="space-y-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Scenario {session.turns.length + 1} of {MAX_TURNS}</span><span>{languages.find(([id]) => id === locale)?.[1]}</span></div>
          <div className="flex gap-1" aria-label={`${session.turns.length} scenarios answered`}>{Array.from({ length: MAX_TURNS }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < session.turns.length ? "bg-primary" : "bg-border"}`} />)}</div>
          <article className="border-l-2 border-primary pl-4 py-2 space-y-4">
            <p className="text-xs font-semibold text-primary">SeaMinds examiner</p>
            <p className="text-lg leading-relaxed whitespace-pre-wrap break-words" aria-live="polite">{session.question}</p>
            {voice.canSpeak && <Button variant="ghost" size="sm" disabled={busy} onClick={() => voice.speaking ? voice.stopSpeaking() : voice.speak(session.question || "")} title={voice.speaking ? "Stop audio" : "Listen to question"}>{voice.speaking ? <Square /> : <Volume2 />}{voice.speaking ? "Stop audio" : "Listen"}</Button>}
          </article>
          <div className="space-y-2">
            <label htmlFor="interview-answer" className="text-sm font-semibold">Your answer</label>
            <Textarea id="interview-answer" value={answer} disabled={busy || voice.listening} maxLength={MAX_ANSWER_CHARS} onChange={e => setAnswer(e.target.value)} className="min-h-40 text-base leading-relaxed resize-y" />
            {voice.interim && <p className="text-sm text-muted-foreground" aria-live="polite">{voice.interim}</p>}
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{voice.listening ? "Listening… Stop to review your answer." : "Review your answer before sending."}</span><span className="shrink-0">{answer.length}/{MAX_ANSWER_CHARS}</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={busy || !voice.supported} onClick={() => voice.listening ? voice.stop() : voice.start()} title={voice.supported ? "Dictate answer" : "Voice input is unavailable in this browser"}>{voice.listening ? <MicOff /> : <Mic />}{voice.listening ? "Stop microphone" : "Speak"}</Button>
            <Button className="flex-1 rounded-xl font-bold" disabled={busy || voice.listening || !answer.trim()} onClick={() => void submit()}>{busy ? <><Loader2 className="animate-spin motion-reduce:animate-none" /> Checking…</> : <><Send /> Send answer</>}</Button>
            <Button variant="ghost" disabled={busy || voice.listening} onClick={() => void submit("I don't know")}>I don’t know</Button>
          </div>
        </section>}
        {error && <p role="alert" className="mt-5 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        {review && <section className="space-y-6">
          <div className="border-y border-border py-5 space-y-2"><h2 className="text-xl font-bold">Practice interview complete</h2><p className="text-sm text-muted-foreground">{review.turns.length} scenarios answered · {review.safety_flags} safety concerns identified. This AI review is provisional and is not saved.</p></div>
          {review.gaps.length > 0 && <div className="space-y-2"><h3 className="font-semibold text-primary">Topics to strengthen</h3><ul className="list-disc pl-5 space-y-2 text-sm">{review.gaps.map(g => <li key={g}>{g}</li>)}</ul></div>}
          <div className="space-y-3">{review.turns.map((t, i) => <details key={i} className="border-b border-border pb-3"><summary className="cursor-pointer text-sm font-semibold py-2">{i + 1}. {t.topic?.replaceAll("_", " ") || "Scenario"}{t.safety_flag ? " · Safety review" : ""}</summary><div className="space-y-3 py-3 text-sm break-words"><p>{t.question}</p><p className="text-muted-foreground">Your answer: {t.answer}</p><p>{t.feedback || "Revisit this topic using your approved vessel manuals and training materials."}</p></div></details>)}</div>
          <p className="text-xs text-muted-foreground">AI feedback may be incomplete. Confirm technical details against current rules, your company’s safety system and maker manuals.</p>
          <div className="flex flex-wrap gap-3"><Button onClick={() => navigate("/training")}>Open training</Button><Button variant="outline" onClick={reset}><RotateCcw /> New practice</Button></div>
        </section>}
      </>}
    </div>
    <AlertDialog open={leaving} onOpenChange={setLeaving}><AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg"><AlertDialogTitle>Leave this practice interview?</AlertDialogTitle><AlertDialogDescription>Your answers and review are not saved. Leaving clears this session.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Keep practising</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => navigate("/training")}>Leave interview</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}