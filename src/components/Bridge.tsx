import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Search, Send, Loader2, Bookmark, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const SaveToPocket = ({ messages }: { messages: Msg[] }) => {
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    const lastUser = [...messages].reverse().find(m => m.role === "user")?.content || "";
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant")?.content || "";
    const existing = JSON.parse(localStorage.getItem("bridge_pocket") || "[]");
    existing.push({ query: lastUser, answer: lastAssistant, savedAt: new Date().toISOString() });
    localStorage.setItem("bridge_pocket", JSON.stringify(existing));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="flex justify-center" style={{ marginTop: 20, marginBottom: 12 }}>
      <button
        onClick={handleSave}
        className="rounded transition-colors"
        style={{
          border: saved ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.2)",
          color: saved ? "#22c55e" : "#e2e8f0",
          padding: "6px 16px",
          fontSize: 13,
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {saved ? "✓ Saved to Pocket" : "💾 Save to My Pocket"}
      </button>
    </div>
  );
};

const BRIDGE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bridge-chat`;

const QUICK_TAPS = ["MARPOL", "SOLAS", "ISM Code", "MLC 2006", "STCW"];

const DEPARTMENTS = [
  { emoji: "⚙️", title: "MACHINERY", subtitle: "Engine, pumps, systems", questions: [
    "How to troubleshoot a fuel injector?", "Main engine lube oil pressure low — causes?", "Purifier not separating properly — steps?",
    "Emergency generator won't start — checklist?", "Boiler water test limits and treatment?", "How to overhaul a centrifugal pump?"
  ]},
  { emoji: "🧭", title: "NAVIGATION", subtitle: "Charts, ECDIS, colregs", questions: [
    "Rule 19 — conduct in restricted visibility?", "ECDIS alarm management best practices?", "How to plan a passage through a TSS?",
    "When to use radar plotting vs ARPA?", "Gyro compass error correction methods?", "Bridge team resource management essentials?"
  ]},
  { emoji: "🔥", title: "CARGO OPS", subtitle: "Loading, stability, tankers", questions: [
    "Cargo securing manual requirements?", "Tanker inerting system operation?", "How to calculate cargo stowage factor?",
    "Container lashing inspection checklist?", "Bulk cargo liquefaction risks and prevention?", "Loading computer vs manual stability calc?"
  ]},
  { emoji: "📡", title: "COMMS", subtitle: "GMDSS, VHF, Inmarsat", questions: [
    "GMDSS sea area equipment requirements?", "How to send a DSC distress alert?", "NAVTEX receiver setup and frequencies?",
    "Inmarsat-C polling and EGC explained?", "VHF channel 16 procedures and protocols?", "EPIRB testing and maintenance schedule?"
  ]},
  { emoji: "⚖️", title: "SAFETY", subtitle: "SOLAS, fire, LSA", questions: [
    "Fire drill frequency requirements per SOLAS?", "Lifeboat launching procedure step by step?", "SCBA donning time and inspection checks?",
    "Enclosed space entry permit requirements?", "Fire extinguisher types and applications?", "Muster list — who does what in emergency?"
  ]},
  { emoji: "🌊", title: "STABILITY", subtitle: "Trim, stress, flooding", questions: [
    "How to calculate GM and GZ curve?", "Free surface effect — how to minimize?", "Damage stability requirements per SOLAS?",
    "What is angle of loll and correction?", "Trim optimization for fuel efficiency?", "Stress limits on hull — hogging vs sagging?"
  ]},
  { emoji: "📋", title: "ISM/DOCS", subtitle: "SMS, audits, certificates", questions: [
    "ISM Code document of compliance requirements?", "How to prepare for a PSC inspection?", "Non-conformity vs major non-conformity?",
    "Safety management certificate renewal process?", "Internal audit checklist for ISM?", "Master review — what to include annually?"
  ]},
  { emoji: "🔧", title: "MAINTENANCE", subtitle: "Planned maintenance, repairs", questions: [
    "PMS software best practices onboard?", "Critical equipment maintenance intervals?", "Class survey preparation checklist?",
    "How to manage spare parts inventory?", "Dry dock preparation and planning?", "Running hours vs calendar-based maintenance?"
  ]},
];


async function streamBridgeChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(BRIDGE_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    onError(body.error || "Failed to get response");
    return;
  }

  if (!resp.body) { onError("No response body"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  onDone();
}

const Bridge = () => {
  const [searchValue, setSearchValue] = useState("");
  const [activeDept, setActiveDept] = useState<typeof DEPARTMENTS[number] | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPocket, setShowPocket] = useState(false);
  const [pocketItems, setPocketItems] = useState<{query: string; answer: string; savedAt: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadPocket = () => {
    const items = JSON.parse(localStorage.getItem("bridge_pocket") || "[]");
    setPocketItems(items);
  };

  const deletePocketItem = (index: number) => {
    const updated = pocketItems.filter((_, i) => i !== index);
    setPocketItems(updated);
    localStorage.setItem("bridge_pocket", JSON.stringify(updated));
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuery = async (query: string) => {
    if (!query.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: query.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSearchValue("");
    setShowChat(true);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamBridgeChat({
      messages: newMessages,
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${err}` }]);
        setIsLoading(false);
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(searchValue);
  };

  const handleChipClick = (question: string) => {
    setActiveDept(null);
    sendQuery(question);
  };

  const handleQuickTap = (term: string) => {
    sendQuery(`Explain ${term} — key points every seafarer should know`);
  };

  const handleBackToHome = () => {
    setShowChat(false);
  };

  // Chat view
  if (showChat) {
    return (
      <div className="flex flex-col h-full">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={handleBackToHome} style={{ color: "#D4AF37" }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#D4AF37" }}>BRIDGE</h2>
            <p className="text-[10px] text-muted-foreground">Technical Reference AI</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setShowChat(false); }}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded"
            >
              New Query
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "text-foreground"
                    : ""
                }`}
                style={
                  msg.role === "user"
                    ? { background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)" }
                    : { background: "rgba(13,27,42,0.8)", border: "1px solid rgba(255,255,255,0.05)" }
                }
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:text-[#D4AF37]">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground" style={{ background: "rgba(13,27,42,0.8)" }}>
                <Loader2 size={14} className="animate-spin" /> Searching references...
              </div>
            </div>
          )}
          {/* YouTube Videos Section - show after AI has responded */}
          {messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (() => {
            const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
            if (!lastUserMsg) return null;
            const q = lastUserMsg.content;
            const ytUrl = `https://www.youtube.com/results?search_query=maritime+${encodeURIComponent(q)}`;
            const cards = [
              `${q} — Full Explanation`,
              `${q} — Step by Step Guide`,
              `${q} — IMO Requirements`,
            ];
            return (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ color: "#D4AF37", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>▶ Watch on YouTube</h3>
                {cards.map((title, i) => (
                  <div
                    key={i}
                    onClick={() => window.open(ytUrl, "_blank")}
                    className="flex items-center gap-3 rounded-lg cursor-pointer"
                    style={{ background: "rgba(13,27,42,0.85)", borderLeft: "2px solid #FF0000", padding: 12, marginBottom: 8 }}
                  >
                    <span style={{ color: "#FF0000", fontSize: 18, flexShrink: 0 }}>▶</span>
                    <div>
                      <div className="text-sm text-foreground">{title}</div>
                      <div className="text-[11px] text-muted-foreground">Search on YouTube →</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Official References */}
          {messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ color: "#D4AF37", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 Official References</h3>
              {[
                { name: "IMO Official Site", url: "https://www.imo.org" },
                { name: "gCaptain Maritime News", url: "https://gcaptain.com" },
                { name: "Marine Insight Guides", url: "https://www.marineinsight.com" },
                { name: "BIMCO Resources", url: "https://www.bimco.org" },
              ].map((ref, i) => (
                <div
                  key={i}
                  onClick={() => window.open(ref.url, "_blank")}
                  className="flex items-center justify-between cursor-pointer py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>📄</span>
                    <span className="text-sm text-foreground">{ref.name}</span>
                  </div>
                  <span style={{ color: "#D4AF37", fontSize: 14 }}>→</span>
                </div>
              ))}
            </div>
          )}
          {/* Save to Pocket */}
          {messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (
            <SaveToPocket messages={messages} />
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border">
          <div className="flex gap-2">
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!searchValue.trim() || isLoading}
              className="px-3 py-2.5 rounded-xl transition-colors disabled:opacity-30"
              style={{ background: "#D4AF37", color: "#0D1B2A" }}
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Pocket view
  if (showPocket) {
    return (
      <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
        <button onClick={() => setShowPocket(false)} className="flex items-center gap-2 mb-4" style={{ color: "#D4AF37" }}>
          <ArrowLeft size={18} /> <span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold" style={{ color: "#D4AF37" }}>💾 My Pocket</h2>
          <p className="text-xs text-muted-foreground">{pocketItems.length} saved {pocketItems.length === 1 ? "item" : "items"}</p>
        </div>
        {pocketItems.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <p>No saved items yet.</p>
            <p className="text-xs mt-1">Use "Save to My Pocket" after any Bridge answer.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pocketItems.map((item, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "rgba(13,27,42,0.85)", border: "1px solid rgba(212,175,55,0.15)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-foreground flex-1">{item.query}</span>
                  <button onClick={() => deletePocketItem(i)} className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{item.answer}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(item.savedAt).toLocaleDateString()}</p>
                <button
                  onClick={() => {
                    setMessages([
                      { role: "user", content: item.query },
                      { role: "assistant", content: item.answer },
                    ]);
                    setShowPocket(false);
                    setShowChat(true);
                  }}
                  className="text-[11px] mt-2 font-medium"
                  style={{ color: "#D4AF37" }}
                >
                  View full answer →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Department drill-down
  if (activeDept) {
    return (
      <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
        <button onClick={() => setActiveDept(null)} className="flex items-center gap-2 mb-4" style={{ color: "#D4AF37" }}>
          <ArrowLeft size={18} /> <span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">{activeDept.emoji}</div>
          <h2 className="text-lg font-bold" style={{ color: "#D4AF37" }}>{activeDept.title}</h2>
          <p className="text-xs text-muted-foreground">{activeDept.subtitle}</p>
        </div>
        <div className="flex flex-col gap-2">
          {activeDept.questions.map((q) => (
            <button
              key={q}
              onClick={() => handleChipClick(q)}
              className="text-left text-sm px-4 py-3 rounded-xl transition-colors"
              style={{ background: "rgba(13,27,42,0.8)", border: "1px solid rgba(212,175,55,0.3)", color: "#e2e8f0" }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Home view
  return (
    <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold tracking-wider" style={{ color: "#D4AF37" }}>BRIDGE</h1>
        <p className="text-xs text-muted-foreground">Technical Reference & Guidance</p>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Ask any technical question..."
          className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#D4AF37]"
        />
        {searchValue.trim() && (
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded" style={{ color: "#D4AF37" }}>
            <Send size={16} />
          </button>
        )}
      </form>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {QUICK_TAPS.map((t) => (
          <button
            key={t}
            onClick={() => handleQuickTap(t)}
            className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
            style={{ border: "1px solid #D4AF37", color: "#D4AF37", background: "transparent" }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* My Pocket button */}
      <button
        onClick={() => { loadPocket(); setShowPocket(true); }}
        className="flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl text-sm w-full transition-colors"
        style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", background: "rgba(13,27,42,0.5)" }}
      >
        <Bookmark size={14} /> My Pocket
      </button>

      <div className="grid grid-cols-2 gap-3">
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept.title}
            onClick={() => setActiveDept(dept)}
            className="flex flex-col items-start p-4 rounded-xl text-left transition-all hover:border-[#D4AF37]"
            style={{ background: "rgba(13,27,42,0.85)", border: "1px solid rgba(212,175,55,0.15)" }}
          >
            <span className="text-2xl mb-2">{dept.emoji}</span>
            <span className="text-xs font-bold tracking-wide" style={{ color: "#D4AF37" }}>{dept.title}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{dept.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Bridge;
