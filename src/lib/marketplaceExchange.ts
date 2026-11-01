export type ExchangeCategory = "spares" | "yards" | "tech";

export const HUBS = [
  { id: "spares", label: "Spares & Parts", icon: "⚙️" },
  { id: "yards", label: "Yards & Workshops", icon: "🛠️" },
  { id: "ships", label: "Ships for Sale", icon: "🚢" },
  { id: "tech", label: "Tech, PPE & Stores", icon: "🦺" },
] as const;
export type HubId = (typeof HUBS)[number]["id"];

export const ORIGINS: { name: string; flag: string }[] = [
  { name: "Japan", flag: "🇯🇵" }, { name: "Germany", flag: "🇩🇪" }, { name: "Singapore", flag: "🇸🇬" },
  { name: "South Korea", flag: "🇰🇷" }, { name: "China", flag: "🇨🇳" }, { name: "India", flag: "🇮🇳" },
  { name: "Indonesia", flag: "🇮🇩" }, { name: "Turkey", flag: "🇹🇷" }, { name: "Netherlands", flag: "🇳🇱" },
  { name: "Other", flag: "🌍" },
];
export const flagOf = (c: string) => ORIGINS.find((o) => o.name === c)?.flag ?? "🌍";

export const PORTS = ["Singapore", "Batam", "Jakarta", "Ningbo", "Shanghai", "Zhoushan", "Busan", "Mumbai", "Dubai", "Fujairah", "Rotterdam", "Houston"];

export const CONDITIONS: Record<string, string> = {
  new_oem: "OEM / new",
  certified_equivalent: "Certified equivalent",
  reconditioned: "Reconditioned",
  service: "Service",
};

export const EXCHANGE_NOTICE =
  "SeaMinds is an introductory noticeboard connecting maritime buyers and independent suppliers. SeaMinds is not a broker, manufacturer, stockist or inspection agency. Quality, class certification, export customs, delivery and payment are agreed strictly between buyer and seller.";

export type Inquiry = { company?: string; port?: string; needed_by?: string; quantity?: string; notes?: string };

// Preserve buyer identity in the existing inquiry notes field without schema changes.
export function buildInquiryPayload(q: Inquiry) {
  return {
    port: q.port?.trim(), needed_by: q.needed_by || undefined, quantity: q.quantity?.trim(),
    notes: [q.company?.trim() && `Buyer / company: ${q.company.trim()}`, q.notes?.trim()].filter(Boolean).join("\n"),
  };
}

export function buildRfqText(item: { title: string; maker?: string | null; part_number?: string | null; origin_country: string }, q: Inquiry): string {
  const lines = [
    "Hello, I am requesting a quotation via SeaMinds Marketplace:",
    `• Item: ${item.title}${item.maker ? ` (${item.maker}${item.part_number ? ` / ${item.part_number}` : ""})` : ""} — origin ${item.origin_country}`,
  ];
  if (q.company?.trim()) lines.push(`• Buyer / company: ${q.company.trim()}`);
  if (q.port || q.needed_by) lines.push(`• Delivery: ${[q.port, q.needed_by && `by ${q.needed_by}`].filter(Boolean).join(" ")}`);
  if (q.quantity) lines.push(`• Quantity: ${q.quantity}`);
  if (q.notes) lines.push(`• Notes: ${q.notes}`);
  lines.push("Please reply with price, availability and lead time.");
  return lines.join("\n");
}

type Filterable = { title: string; maker: string | null; part_number: string | null; company: string; description: string | null; origin_country: string; stock_ports: string[]; condition: string };
export function filterItems<T extends Filterable>(rows: T[], f: { q: string; origin: string; port: string; condition: string }): T[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (f.origin !== "All" && r.origin_country !== f.origin) return false;
    if (f.port !== "All" && !r.stock_ports.includes(f.port)) return false;
    if (f.condition !== "All" && r.condition !== f.condition) return false;
    const hay = [r.title, r.maker, r.part_number, r.company, r.description, r.origin_country, ...r.stock_ports].join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// Third-party sellers (separate from crew and ship managers) and the hubs each type posts into.
export const VENDOR_TYPES = [
  { id: "spares_supplier", label: "Spares supplier / OEM / stockist", icon: "⚙️" },
  { id: "shipyard_workshop", label: "Shipyard / repair workshop", icon: "🛠️" },
  { id: "ship_broker", label: "Ship broker (vessel S&P)", icon: "🚢" },
  { id: "tech_stores", label: "Marine tech, PPE & stores", icon: "🦺" },
] as const;
export function vendorHubs(type: string): ExchangeCategory[] {
  if (type === "shipyard_workshop") return ["yards", "spares"];
  if (type === "tech_stores") return ["tech", "spares"];
  if (type === "ship_broker") return ["spares", "yards", "tech"];
  return ["spares", "tech", "yards"];
}
