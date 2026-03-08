interface GoDeepCardProps {
  lastQuery: string;
  header: string;
  subtext: string;
}

const GoDeepCard = ({ lastQuery, header, subtext }: GoDeepCardProps) => {
  const encoded = encodeURIComponent(lastQuery);
  const links = [
    { label: "▶ YouTube Search", url: `https://www.youtube.com/results?search_query=maritime+${encoded}` },
    { label: "🔎 Google Search", url: `https://www.google.com/search?q=maritime+${encoded}` },
    { label: "🤖 ChatGPT Free", url: `https://chatgpt.com/?q=${encoded}+maritime+seafarer+technical+guide` },
    { label: "🧠 Claude.ai Free", url: `https://claude.ai/new?q=${encoded}+explain+for+maritime+seafarer` },
  ];

  return (
    <div
      className="rounded-xl"
      style={{
        background: "rgba(13,27,42,0.9)",
        border: "1px solid hsl(var(--primary) / 0.4)",
        padding: 16,
        marginTop: 12,
      }}
    >
      <p className="text-sm font-semibold text-foreground mb-1">{header}</p>
      <p className="text-xs text-muted-foreground mb-3">{subtext}</p>
      <div className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <button
            key={l.label}
            onClick={() => window.open(l.url, "_blank")}
            className="rounded-lg text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
            style={{
              border: "1px solid hsl(var(--primary) / 0.3)",
              background: "transparent",
              padding: 8,
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GoDeepCard;
