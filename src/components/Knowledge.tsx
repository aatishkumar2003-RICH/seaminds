import { useState } from "react";
import Bridge from "@/components/Bridge";
import Academy from "@/components/Academy";

interface Props {
  profileId: string;
}

const Knowledge = ({ profileId }: Props) => {
  const [mode, setMode] = useState<"ask" | "guides">("ask");

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Learn</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask about any equipment or rule — or browse the guides
        </p>
        <div className="flex gap-2 mt-3">
          {([
            { id: "ask", label: "🔧 Ask a Question" },
            { id: "guides", label: "📚 Guides" },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="flex-1 rounded-xl py-2 text-xs font-bold transition-colors"
              style={{
                background: mode === m.id ? "#D4AF37" : "transparent",
                color: mode === m.id ? "#0D1B2A" : "#D4AF37",
                border: `1px solid ${mode === m.id ? "#D4AF37" : "rgba(212,175,55,0.4)"}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "ask" ? <Bridge profileId={profileId} /> : <Academy />}
      </div>
    </div>
  );
};

export default Knowledge;
