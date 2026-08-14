const CARDS = [
  { title: "🏢 Your Company / DPA", text: "Emergency phone & email from your linked company" },
  { title: "🌍 ISWAN SeafarerHelp", text: "Free, confidential, 24/7" },
  { title: "🤝 ITF", text: "Protecting seafarers' rights" },
];

const SOSNetwork = () => (
  <section className="relative py-12 sm:py-16">
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6">
        Help Contacts That Travel With the Crew.
      </h2>
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl px-4 py-4 backdrop-blur-sm"
            style={{
              border: "1px solid rgba(212,175,55,0.3)",
              background: "rgba(17,34,64,0.65)",
            }}
          >
            <p className="text-sm font-semibold text-foreground mb-1">{c.title}</p>
            <p className="text-xs text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Crew linked to a company see their company's emergency contacts right in their SOS screen.
      </p>
    </div>
  </section>
);

export default SOSNetwork;
