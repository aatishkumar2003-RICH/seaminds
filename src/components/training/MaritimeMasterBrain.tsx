import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Brain, Volume2, VolumeX, Square, Mic, MicOff } from "lucide-react";
import { useInterviewVoice } from "@/hooks/useInterviewVoice";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authedFunctionHeaders, handleAuthError } from "@/lib/authFetch";

type Msg = { role: "user" | "assistant"; content: string };
const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bridge-chat`;
const LANGS = ["English", "Bahasa Indonesia", "Tagalog", "Tiếng Việt", "Hindi", "Russian", "Español", "Ukrainian", "Myanmar", "Chinese"];
const LOCALES: Record<string, string> = { English: "en-GB", "Bahasa Indonesia": "id-ID", Tagalog: "fil-PH", "Tiếng Việt": "vi-VN", Hindi: "hi-IN", Russian: "ru-RU", "Español": "es-ES", Ukrainian: "uk-UA", Myanmar: "my-MM", Chinese: "zh-CN" };
const QUICK = ["SIRE 2.0 inspection questions for my rank", "MARPOL Annex VI & CII basics", "Scavenge fire — immediate actions", "COLREGs Rule 19 in restricted visibility", "Enclosed space entry checklist", "Top PSC deficiencies (Tokyo / Paris MoU)"];

const MaritimeMasterBrain = () => {
  const [lang, setLang] = useState(() => localStorage.getItem("brain_lang") || "English");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem("brain_autospeak") !== "0");
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  const inputRef = useRef("");
  inputRef.current = input;
  const askRef = useRef<(t: string) => void>(() => {});
  const voiceTurn = useRef(false);
  const voice = useInterviewVoice(
    LOCALES[lang] || "en-GB",
    (t) => setInput((p) => { const n = `${p} ${t}`.trim(); inputRef.current = n; return n; }),
    {
      autoStopMs: 1800,
      onEnd: () => {
        if (!voiceTurn.current) return;
        voiceTurn.current = false;
        // let the final transcript state settle, then send automatically
        setTimeout(() => { const q = inputRef.current.trim(); if (q) askRef.current(q); else toast.info("I didn't catch that — tap 🎤 and try again."); }, 120);
      },
    },
  );
  const { listening, interim } = voice;
  // iOS only allows speech audio that was unlocked by a direct tap.
  const unlockAudio = () => {
    if (!("speechSynthesis" in window)) return;
    try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* noop */ }
  };
  const toggleMic = () => {
    if (!voice.supported) { toast.info("Voice input isn't supported in this browser — please type."); return; }
    if (listening) { voice.stop(); return; }
    window.speechSynthesis?.cancel(); setSpeakingIdx(null);
    unlockAudio();
    voiceTurn.current = true;
    voice.start();
  };

  const speak = (md: string, idx: number, force = false) => {
    if (!("speechSynthesis" in window)) { toast.info("Audio is not available in this browser."); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    if (!force && speakingIdx === idx) { setSpeakingIdx(null); return; }
    const text = md.replace(/```[\s\S]*?```/g, " ").replace(/[#*_>`|~]+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
    if (!text) return;
    const locale = LOCALES[lang] || "en-GB";
    const voices = synth.getVoices();
    const v = voices.find((x) => x.lang.toLowerCase() === locale.toLowerCase()) || voices.find((x) => x.lang.split("-")[0] === locale.split("-")[0]);
    if (voices.length && !v && locale !== "en-GB") toast.info(`No ${lang} voice on this phone — reading in default voice.`);
    // iOS cuts off long utterances — read sentence-sized chunks in a queue.
    const chunks = (text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text]).reduce<string[]>((a, s) => {
      const last = a[a.length - 1];
      if (last && (last + s).length < 220) a[a.length - 1] = last + s; else a.push(s);
      return a;
    }, []).map((s) => s.trim()).filter(Boolean);
    setSpeakingIdx(idx);
    chunks.forEach((c, n) => {
      const u = new SpeechSynthesisUtterance(c);
      u.lang = v?.lang || locale; if (v) u.voice = v; u.rate = 0.95;
      if (n === chunks.length - 1) u.onend = () => setSpeakingIdx((cur) => (cur === idx ? null : cur));
      u.onerror = () => setSpeakingIdx((cur) => (cur === idx ? null : cur));
      synth.speak(u);
    });
  };
  const stopAudio = () => { window.speechSynthesis?.cancel(); setSpeakingIdx(null); };


  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    let acc = "";
    const push = (c: string) => setMsgs([...next, { role: "assistant", content: c }]);
    try {
      const resp = await fetch(URL, { method: "POST", headers: await authedFunctionHeaders(), body: JSON.stringify({ messages: next.slice(-12), language: lang }) });
      if (!resp.ok || !resp.body) {
        if (handleAuthError(resp.status)) return push("Please sign in again.");
        const b = await resp.json().catch(() => ({}));
        return push(b.message || b.error || "The Brain could not answer right now. Try again.");
      }
      const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6); if (j === "[DONE]") continue;
          try { const c = JSON.parse(j).choices?.[0]?.delta?.content; if (c) { acc += c; push(acc); } } catch { /* partial */ }
        }
      }
    } finally {
      setBusy(false); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      if (autoSpeak && acc) speak(acc, next.length, true);
    }
  };
  askRef.current = (t: string) => { void ask(t); };

  return (
    <section className="space-y-3">
      <div className="space-y-2 rounded-xl border border-primary/40 bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0"><Brain className="text-primary shrink-0" size={20} /><div className="min-w-0"><p className="text-sm font-bold leading-tight">Maritime Master Brain</p><p className="text-[11px] text-muted-foreground leading-tight">Ask any technical, rules or career question</p></div></div>
          <select aria-label="Answer language" value={lang} onChange={(e) => { setLang(e.target.value); localStorage.setItem("brain_lang", e.target.value); }}
            className="rounded-lg border border-primary/40 bg-background px-2 py-1.5 text-xs text-foreground">
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => { const v = !autoSpeak; setAutoSpeak(v); localStorage.setItem("brain_autospeak", v ? "1" : "0"); if (!v && "speechSynthesis" in window) { window.speechSynthesis.cancel(); setSpeakingIdx(null); } }}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${autoSpeak ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary"}`}>
          {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />} Voice replies: {autoSpeak ? "ON — Brain speaks answers" : "OFF — tap to turn on"}
        </button>
      </div>
      {msgs.length === 0 && (
        <div className="flex flex-wrap gap-1.5">{QUICK.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-full border border-primary/40 px-2.5 py-1 text-[11px] text-primary">{q}</button>)}</div>
      )}
      <div className="space-y-2">
        {msgs.map((m, i) => (
          <div key={i} className={`rounded-xl p-3 text-sm ${m.role === "user" ? "ml-8 bg-primary/15" : "mr-2 border border-border bg-card prose prose-sm prose-invert max-w-none"}`}>
            {m.role === "user" ? m.content : <>
              <ReactMarkdown>{m.content}</ReactMarkdown>
              {!(busy && i === msgs.length - 1) && (
                <button type="button" onClick={() => speak(m.content, i)} aria-label={speakingIdx === i ? "Stop audio" : "Listen to answer"}
                  className="not-prose mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">
                  {speakingIdx === i ? <><Square size={12} /> Stop</> : <><Volume2 size={14} /> Listen</>}
                </button>
              )}
            </>}
          </div>
        ))}
        {busy && msgs[msgs.length - 1]?.role === "user" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={14} /> Thinking…</p>}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-2 space-y-1.5">
        {(listening || busy || speakingIdx !== null) && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-card px-3 py-1.5 text-xs" aria-live="polite">
            <span className="flex items-center gap-2 text-primary">
              {listening ? <><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Listening… pause when done and I'll send it</>
                : busy ? <><Loader2 className="animate-spin" size={12} /> Thinking…</>
                : <><Volume2 size={12} /> Speaking answer…</>}
            </span>
            {listening ? <button type="button" onClick={() => voice.stop()} className="font-semibold text-primary underline">Done</button>
              : speakingIdx !== null ? <button type="button" onClick={stopAudio} className="font-semibold text-primary underline">Stop</button> : null}
          </div>
        )}
        <form className="flex gap-2 rounded-xl border border-primary/40 bg-card p-2" onSubmit={(e) => { e.preventDefault(); if (listening) { voiceTurn.current = false; voice.stop(); } setTimeout(() => void ask(inputRef.current), listening ? 150 : 0); }}>
          <input value={listening ? `${input} ${interim}`.trim() : input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening… speak now" : "Ask or tap 🎤 to speak…"} className="flex-1 bg-transparent px-2 text-sm outline-none" />
          <Button type="button" size="sm" variant={listening ? "default" : "outline"} onClick={toggleMic} aria-label={listening ? "Stop microphone" : "Speak your question"}>
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </Button>
          <Button type="submit" size="sm" disabled={busy || !(input.trim() || interim.trim())} aria-label="Send"><Send size={16} /></Button>
        </form>
      </div>
      <p className="text-[10px] text-muted-foreground">Guidance only — always follow your company SMS, flag/class rules and maker manuals.</p>
    </section>
  );
};

export default MaritimeMasterBrain;
