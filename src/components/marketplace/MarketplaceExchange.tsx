import { useEffect, useMemo, useState } from "react";
import { Search, X, MessageCircle, Mail, Send, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreditPricing } from "@/hooks/useCreditPricing";
import { ORIGINS, PORTS, CONDITIONS, EXCHANGE_NOTICE, flagOf, filterItems, buildRfqText, type ExchangeCategory, type Inquiry } from "@/lib/marketplaceExchange";

type Item = {
  id: string; seller_id: string; category: ExchangeCategory; title: string; maker: string | null; part_number: string | null;
  origin_country: string; stock_ports: string[]; condition: string; description: string | null; price_text: string | null;
  moq: string | null; certification: string | null; company: string; featured: boolean; is_sample: boolean; status: string;
};
// New tables are not yet in generated types.
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: unknown) => any };
const QUICK = ["O-ring", "Purifier", "Piston ring", "Drydock", "Turbocharger", "Boiler suit", "Gas detector"];
const sel = "rounded-xl border border-primary/30 bg-card px-2 py-2 text-xs text-foreground";

const MarketplaceExchange = ({ category, canPost }: { category: ExchangeCategory; canPost: boolean }) => {
  const { user } = useAuth();
  const pricing = useCreditPricing() as unknown as { market_contact_credits?: number } | null;
  const cost = Number(pricing?.market_contact_credits ?? 0);
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ q: "", origin: "All", port: "All", condition: "All" });
  const [rfq, setRfq] = useState<Item | null>(null);
  const [posting, setPosting] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    db.from("marketplace_items").select("*").eq("category", category).neq("status", "hidden")
      .order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(300)
      .then(({ data }: { data: Item[] | null }) => { setRows((data ?? []).filter((r) => r.status === "active" || r.seller_id === user?.id)); setLoading(false); });
  }, [category, tick, user?.id]);

  const list = useMemo(() => filterItems(rows, f), [rows, f]);
  const origins = useMemo(() => ORIGINS.filter((o) => rows.some((r) => r.origin_country === o.name)), [rows]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search part, maker, part number, yard or port…"
          className="w-full rounded-2xl border border-primary/40 bg-card py-3 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
        {f.q && <button onClick={() => setF({ ...f, q: "" })} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={16} /></button>}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {QUICK.map((q) => <button key={q} onClick={() => setF({ ...f, q })} className="shrink-0 rounded-full border border-primary/30 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-primary">{q}</button>)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select aria-label="Made in" className={sel} value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })}>
          <option value="All">🌍 Made in: all</option>
          {ORIGINS.map((o) => <option key={o.name} value={o.name}>{o.flag} {o.name}</option>)}
        </select>
        <select aria-label="Stock port" className={sel} value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })}>
          <option value="All">⚓ Any port</option>
          {PORTS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select aria-label="Condition" className={sel} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
          <option value="All">All conditions</option>
          {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {origins.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {origins.map((o) => <button key={o.name} onClick={() => setF({ ...f, origin: f.origin === o.name ? "All" : o.name })}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${f.origin === o.name ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-muted-foreground"}`}>{o.flag} {o.name}</button>)}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{loading ? "Loading…" : `${list.length} result${list.length === 1 ? "" : "s"}`}</span>
        <span>{cost > 0 ? `Inquiry / contact: ${cost} credit${cost > 1 ? "s" : ""} (once per item)` : "Inquiries free during launch"}</span>
      </div>
      {canPost && <button onClick={() => setPosting(true)} className="flex w-full items-center justify-center gap-1 rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary"><Plus size={14} />List your item / service</button>}

      {!loading && list.length === 0 ? (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center text-sm text-muted-foreground">Nothing matches yet. Try another country, port or search term.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((r) => (
            <div key={r.id} className={`rounded-2xl border bg-card p-3 ${r.featured ? "border-primary" : "border-primary/30"}`}>
              <div className="flex flex-wrap gap-1">
                {r.featured && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Featured</span>}
                {r.is_sample && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">Sample listing</span>}
                <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] text-primary">{flagOf(r.origin_country)} Made in {r.origin_country}</span>
                <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] text-muted-foreground">{CONDITIONS[r.condition] ?? r.condition}</span>
                {r.status !== "active" && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{r.status}</span>}
              </div>
              <p className="mt-2 text-sm font-bold text-foreground">{r.title}</p>
              <p className="text-[11px] text-muted-foreground">{[r.maker, r.part_number].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{r.company}{r.stock_ports.length ? ` · Stock: ${r.stock_ports.join(", ")}` : ""}</p>
              {r.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{r.description}</p>}
              <div className="mt-2 flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-primary">{r.price_text || "Price on request"}</p>
                  <p className="text-[10px] text-muted-foreground">{[r.moq && `MOQ ${r.moq}`, r.certification].filter(Boolean).join(" · ")}</p>
                </div>
                {r.seller_id === user?.id && !r.is_sample ? (
                  <button onClick={async () => { await db.from("marketplace_items").update({ status: r.status === "active" ? "withdrawn" : "active" }).eq("id", r.id); setTick((t) => t + 1); }}
                    className="rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary">{r.status === "active" ? "Withdraw" : "Relist"}</button>
                ) : (
                  <button onClick={() => setRfq(r)} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Request quote</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-3 text-[11px] leading-snug text-muted-foreground">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-primary" /><p>{EXCHANGE_NOTICE}</p>
      </div>
      {rfq && <RfqSheet item={rfq} cost={cost} onClose={() => setRfq(null)} />}
      {posting && <PostSheet category={category} onClose={() => setPosting(false)} onDone={() => { setPosting(false); setTick((t) => t + 1); }} />}
    </div>
  );
};

const Sheet = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-primary/30 bg-card p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-foreground">{title}</h2><button onClick={onClose} aria-label="Close" className="text-muted-foreground"><X size={18} /></button></div>
      {children}
    </div>
  </div>
);
const inp = "w-full rounded-xl border border-primary/30 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

const RfqSheet = ({ item, cost, onClose }: { item: Item; cost: number; onClose: () => void }) => {
  const [q, setQ] = useState<Inquiry>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Inquiry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setQ({ ...q, [k]: e.target.value });

  const send = async (channel: "online" | "whatsapp" | "email") => {
    if (item.is_sample) return toast.info("This is a sample listing — real suppliers will receive your inquiry here.");
    setBusy(true);
    const { data, error } = await db.rpc("marketplace_contact", { p_item: item.id, p_channel: channel, p_inquiry: q });
    setBusy(false);
    if (error || !data?.ok) {
      const e = data?.error;
      return toast.error(e === "no_credits" ? `You need ${data.cost} credit(s). Top up from your credit wallet.` : e === "owner_preview_only" ? "Marketplace is in private preview." : "Could not send the inquiry.");
    }
    const text = buildRfqText(item, q);
    if (channel === "whatsapp") {
      if (!data.whatsapp) return toast.error("This supplier has no WhatsApp number. Inquiry sent online instead.");
      window.open(`https://wa.me/${String(data.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } else if (channel === "email") {
      if (!data.email) return toast.error("This supplier has no email. Inquiry sent online instead.");
      window.location.href = `mailto:${data.email}?subject=${encodeURIComponent(`RFQ: ${item.title} (SeaMinds)`)}&body=${encodeURIComponent(text)}`;
    } else toast.success("Inquiry sent to the supplier.");
    if (data.charged) toast.info(`${data.cost} credit(s) used. Further inquiries for this item are free.`);
    onClose();
  };

  return (
    <Sheet title="Request quotation" onClose={onClose}>
      <p className="text-sm font-semibold text-foreground">{item.title}</p>
      <p className="mb-3 text-[11px] text-muted-foreground">{item.company} · {flagOf(item.origin_country)} {item.origin_country}</p>
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="Vessel name" maxLength={80} onChange={set("vessel")} />
        <input className={inp} placeholder="IMO" inputMode="numeric" maxLength={10} onChange={set("imo")} />
        <input className={inp} placeholder="Delivery port" maxLength={80} onChange={set("port")} />
        <input className={inp} type="date" aria-label="Needed by" onChange={set("needed_by")} />
        <input className={`${inp} col-span-2`} placeholder="Quantity" maxLength={60} onChange={set("quantity")} />
        <textarea className={`${inp} col-span-2`} rows={3} placeholder="Notes (certificates, lead time…)" maxLength={800} onChange={set("notes")} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{cost > 0 ? `${cost} credit(s) once per item; then all channels are free.` : "Free during launch."}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button disabled={busy} onClick={() => send("online")} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"><Send size={15} />Send online</button>
        <button disabled={busy} onClick={() => send("whatsapp")} className="flex items-center justify-center gap-1.5 rounded-xl border border-primary px-3 py-3 text-sm font-bold text-primary disabled:opacity-60"><MessageCircle size={15} />WhatsApp</button>
        <button disabled={busy} onClick={() => send("email")} className="flex items-center justify-center gap-1.5 rounded-xl border border-primary px-3 py-3 text-sm font-bold text-primary disabled:opacity-60"><Mail size={15} />Email</button>
      </div>
    </Sheet>
  );
};

const PostSheet = ({ category, onClose, onDone }: { category: ExchangeCategory; onClose: () => void; onDone: () => void }) => {
  const { user } = useAuth();
  const [v, setV] = useState({ title: "", maker: "", part_number: "", origin_country: "China", ports: "", condition: category === "yards" ? "service" : "new_oem", price_text: "", moq: "", certification: "", company: "", description: "", whatsapp: "", email: "" });
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const submit = async () => {
    if (v.title.trim().length < 3 || !v.company.trim()) return toast.error("Add a title and company name.");
    if (!v.whatsapp.trim() && !v.email.trim()) return toast.error("Add a WhatsApp number or email for inquiries.");
    if (!ok) return toast.error("Please confirm the declaration.");
    setBusy(true);
    const { data, error } = await db.from("marketplace_items").insert({
      seller_id: user?.id, category, title: v.title.trim(), maker: v.maker || null, part_number: v.part_number || null,
      origin_country: v.origin_country, stock_ports: v.ports.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
      condition: v.condition, price_text: v.price_text || null, moq: v.moq || null, certification: v.certification || null,
      company: v.company.trim(), description: v.description || null,
    }).select("id").single();
    if (!error && data) {
      const { error: e2 } = await db.from("marketplace_item_contacts").insert({ item_id: data.id, whatsapp: v.whatsapp || null, email: v.email || null });
      if (e2) { await db.from("marketplace_items").update({ status: "withdrawn" }).eq("id", data.id); setBusy(false); return toast.error("Could not save contact details."); }
    }
    setBusy(false);
    if (error) return toast.error("Could not publish. Your account may need marketplace seller approval.");
    toast.success("Listing published."); onDone();
  };

  return (
    <Sheet title="List your item / service" onClose={onClose}>
      <div className="space-y-2">
        <input className={inp} placeholder="Title (e.g. Purifier O-ring kit)" maxLength={160} onChange={set("title")} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inp} placeholder="Maker / brand" onChange={set("maker")} />
          <input className={inp} placeholder="Part no. / model" onChange={set("part_number")} />
          <select className={inp} value={v.origin_country} onChange={set("origin_country")} aria-label="Made in">{ORIGINS.map((o) => <option key={o.name} value={o.name}>{o.flag} {o.name}</option>)}</select>
          <select className={inp} value={v.condition} onChange={set("condition")} aria-label="Condition">{Object.entries(CONDITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className={inp} placeholder="Price (e.g. On request)" onChange={set("price_text")} />
          <input className={inp} placeholder="MOQ" onChange={set("moq")} />
        </div>
        <input className={inp} placeholder="Stock ports, comma separated" onChange={set("ports")} />
        <input className={inp} placeholder="Certification (class, ISO…)" onChange={set("certification")} />
        <input className={inp} placeholder="Company name" onChange={set("company")} />
        <textarea className={inp} rows={3} placeholder="Description" maxLength={2000} onChange={set("description")} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inp} placeholder="WhatsApp (+code)" inputMode="tel" onChange={set("whatsapp")} />
          <input className={inp} placeholder="Sales email" type="email" onChange={set("email")} />
        </div>
        <label className="flex gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5" />I confirm I am authorised to sell this, the details are accurate, and the goods are not subject to sanctions. SeaMinds is not a party to any sale.</label>
        <button disabled={busy} onClick={submit} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">Publish listing (free)</button>
      </div>
    </Sheet>
  );
};

export default MarketplaceExchange;
