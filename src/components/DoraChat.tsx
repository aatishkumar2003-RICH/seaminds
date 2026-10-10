import { useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authedFunctionHeaders } from "@/lib/authFetch";

type Msg = { role: "user" | "assistant"; content: string };

const CHIPS = ["My exam was interrupted", "What do I need for CV-based scoring?", "How do I set availability?", "Paper not ready"];

interface Props { sourceScreen: string; onEscalate: (question: string) => void }

export default function DoraChat({ sourceScreen, onEscalate }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const lastQ = useRef("");

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    lastQ.current = question;
    const history = msgs.slice(-4);
    setMsgs((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const append = (t: string) => setMsgs((m) => {
      const c = [...m]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + t }; return c;
    });
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dora-assist`, {
        method: "POST",
        headers: await authedFunctionHeaders(),
        body: JSON.stringify({ question, history, route_template: `/app/${sourceScreen.replace(/[^a-z]/gi, "")}` }),
      });
      if (!res.ok || !res.body) {
        let msg = "DORA is unavailable right now. Please raise a support request below.";
        try { const j = await res.json(); if (j?.message) msg = j.message; } catch { /* ignore */ }
        if (res.status === 401) msg = "Please sign in to use DORA.";
        append(msg);
        return;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5));
            if (j.type === "delta" && j.text) append(j.text);
            else if (j.type === "error") append(`\n${j.message ?? "Connection interrupted."}`);
          } catch { /* partial */ }
        }
      }
    } catch {
      append("Connection problem. Please try again or raise a support request below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-foreground">Ask DORA</h2>
        <span className="text-[10px] text-muted-foreground">answers from SeaMinds help guides</span>
      </div>

      {msgs.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => ask(c)} className="rounded-full border border-primary/40 px-3 py-1 text-xs text-primary hover:bg-primary/10">
              {c}
            </button>
          ))}
        </div>
      )}

      {msgs.length > 0 && (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-primary/15 p-2 text-sm text-foreground" : "mr-4 whitespace-pre-wrap rounded-lg bg-secondary p-2 text-sm text-foreground"}>
              {m.content || (busy && i === msgs.length - 1 ? "…" : "")}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input value={input} maxLength={600} disabled={busy} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(input); }} placeholder="Type your question…" />
        <Button size="icon" className="rounded-xl" disabled={busy || !input.trim()} onClick={() => ask(input)} aria-label="Ask DORA">
          <Send size={16} />
        </Button>
      </div>

      {msgs.length > 0 && !busy && (
        <button onClick={() => onEscalate(lastQ.current)} className="text-xs font-semibold text-primary underline">
          Not solved? Send this to the support team
        </button>
      )}
    </div>
  );
}
