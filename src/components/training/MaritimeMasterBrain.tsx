import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Brain, Volume2, Square } from "lucide-react";
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
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const speak = (md: string, idx: number) => {
    if (!("speechSynthesis" in window)) { toast.info("Audio is not available in this browser."); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    if (speakingIdx === idx) { setSpeakingIdx(null); return; }
    const text = md.replace(/```[\s\S]*?```/g, " ").replace(/[#*_>`|~-]+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
    const locale = LOCALES[lang] || "en-GB";
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) || voices.find((v) => v.lang.split("-")[0] === locale.split("-")[0]);
    if (voices.length && !voice && locale !== "en-GB") toast.info(`No ${lang} voice on this phone — reading in default voice.`);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang || locale; if (voice) u.voice = voice; u.rate = 0.95;
    u.onend = u.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx); synth.speak(u);
  };


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
    } finally { setBusy(false); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-card p-3">
        <div className="flex items-center gap-2 min-w-0"><Brain className="text-primary shrink-0" size={20} /><div className="min-w-0"><p className="text-sm font-bold leading-tight">Maritime Master Brain</p><p className="text-[11px] text-muted-foreground leading-tight">Ask any technical, rules or career question</p></div></div>
        <select aria-label="Answer language" value={lang} onChange={(e) => { setLang(e.target.value); localStorage.setItem("brain_lang", e.target.value); }}
          className="rounded-lg border border-primary/40 bg-background px-2 py-1.5 text-xs text-foreground">
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
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
      <form className="sticky bottom-2 flex gap-2 rounded-xl border border-primary/40 bg-card p-2" onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the Brain…" className="flex-1 bg-transparent px-2 text-sm outline-none" />
        <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Send"><Send size={16} /></Button>
      </form>
      <p className="text-[10px] text-muted-foreground">Guidance only — always follow your company SMS, flag/class rules and maker manuals.</p>
    </section>
  );
};

export default MaritimeMasterBrain;
