import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ChevronLeft, Plus, Flag, MessageCircle, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VESSEL_TYPES, MARKETPLACE_NOTICE, signPhotos } from "@/lib/shipMarketplace";
import type { Tables } from "@/integrations/supabase/types";

type Listing = Tables<"ship_listings">;

const Notice = () => (
  <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-3 text-[11px] leading-snug text-muted-foreground">
    <ShieldAlert size={16} className="mt-0.5 shrink-0 text-primary" />
    <p>{MARKETPLACE_NOTICE}</p>
  </div>
);

const Spec = ({ k, v }: { k: string; v: unknown }) =>
  v === null || v === undefined || v === "" ? null : (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 text-xs"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{String(v)}</span></div>
  );

const Marketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const id = params.get("id");
  const [rows, setRows] = useState<Listing[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [type, setType] = useState("All");
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("ship_listings").select("*").in("status", ["active", "sold"])
        .order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(200);
      const list = (data ?? []) as Listing[];
      setRows(list);
      setUrls(await signPhotos(list.flatMap((l) => l.photos.slice(0, id ? 8 : 1))));
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_approved_manager", { _uid: user.id }).then(({ data }) => setCanPost(!!data));
  }, [user]);

  const filtered = useMemo(() => rows.filter((r) => type === "All" || r.vessel_type === type), [rows, type]);
  const sel = id ? rows.find((r) => r.id === id) : null;
  const back = () => (id ? setParams({}) : window.history.length > 1 ? navigate(-1) : navigate("/app"));
  const title = (l: Listing) => (l.show_identity && l.vessel_name ? l.vessel_name : `${l.vessel_type}${l.dwt ? ` · ${l.dwt.toLocaleString()} DWT` : ""}`);

  const report = async (l: Listing) => {
    if (!user) return toast.error("Please sign in to report a listing.");
    const reason = window.prompt("Why are you reporting this listing?");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase.from("ship_listing_reports").insert({ listing_id: l.id, reason: reason.trim().slice(0, 500) });
    error ? toast.error(error.code === "23505" ? "You have already reported this listing." : "Could not send report.") : toast.success("Thanks — our team will review this listing.");
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/30 bg-background/95 px-3 py-3 backdrop-blur">
        <button onClick={back} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary"><ChevronLeft /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{sel ? title(sel) : "Ship Marketplace"}</h1>
          <p className="text-[11px] text-muted-foreground">Vessels for sale · direct from owners & managers</p>
        </div>
        {canPost && !sel && (
          <Link to="/marketplace/post" className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus size={14} />List a vessel</Link>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {sel ? (
          <>
            {sel.photos.length > 0 && (
              <div className="flex snap-x gap-2 overflow-x-auto">
                {sel.photos.map((p) => urls[p] && <img key={p} src={urls[p]} alt="Vessel" loading="lazy" className="h-56 w-auto snap-start rounded-xl object-cover" />)}
              </div>
            )}
            <div className="rounded-2xl border border-primary/30 bg-card p-4">
              <p className="text-lg font-bold text-primary">{sel.price_text}</p>
              {sel.status === "sold" && <p className="text-xs font-bold text-muted-foreground">SOLD</p>}
              <div className="mt-3">
                <Spec k="Type" v={sel.vessel_type} />
                <Spec k="IMO" v={sel.show_identity ? sel.imo : "On request"} />
                <Spec k="Year built" v={sel.year_built} /><Spec k="Builder" v={sel.builder} />
                <Spec k="Flag" v={sel.flag} /><Spec k="Class" v={sel.class_society} />
                <Spec k="DWT" v={sel.dwt?.toLocaleString()} /><Spec k="GT" v={sel.gt?.toLocaleString()} />
                <Spec k="LOA (m)" v={sel.loa_m} /><Spec k="Beam (m)" v={sel.beam_m} />
                <Spec k="Main engine" v={sel.main_engine} /><Spec k="BWTS" v={sel.bwts} />
                <Spec k="Scrubber" v={sel.scrubber} /><Spec k="EEXI / CII" v={sel.eexi_cii} />
                <Spec k="Cargo capacity" v={sel.cargo_capacity} /><Spec k="Cargo gear" v={sel.cargo_gear} />
                <Spec k="Location" v={sel.location} /><Spec k="Delivery" v={sel.delivery_window} />
                <Spec k="Seller" v={sel.seller_company} />
              </div>
              {sel.description && <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">{sel.description}</p>}
            </div>
            {sel.status === "active" && (user ? (
              <div className="flex flex-wrap gap-2">
                {sel.contact_whatsapp && <a href={`https://wa.me/${sel.contact_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Inquiry via SeaMinds Marketplace: ${title(sel)}`)}`} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><MessageCircle size={16} />WhatsApp seller</a>}
                {sel.contact_email && <a href={`mailto:${sel.contact_email}?subject=${encodeURIComponent(`Inquiry: ${title(sel)} (SeaMinds Marketplace)`)}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary"><Mail size={16} />Email seller</a>}
              </div>
            ) : <Link to="/app" className="block rounded-xl border border-primary px-4 py-3 text-center text-sm font-bold text-primary">Sign in to contact the seller</Link>)}
            <Notice />
            <button onClick={() => report(sel)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"><Flag size={12} />Report this listing</button>
          </>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["All", ...VESSEL_TYPES].map((t) => (
                <button key={t} onClick={() => setType(t)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading vessels…</p> : filtered.length === 0 ? (
              <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center text-sm text-muted-foreground">No vessels listed{type !== "All" ? ` in ${type}` : ""} yet. Approved ship owners and managers can list vessels for free.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filtered.map((l) => (
                  <button key={l.id} onClick={() => setParams({ id: l.id })} className="overflow-hidden rounded-2xl border border-primary/30 bg-card text-left transition hover:border-primary">
                    <div className="relative flex h-40 items-center justify-center bg-secondary text-4xl">
                      {l.photos[0] && urls[l.photos[0]] ? <img src={urls[l.photos[0]]} alt="" loading="lazy" className="h-full w-full object-cover" /> : "🚢"}
                      {l.featured && <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Featured</span>}
                      {l.status === "sold" && <span className="absolute right-2 top-2 rounded-full bg-background px-2 py-0.5 text-[10px] font-bold">SOLD</span>}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold">{title(l)}</p>
                      <p className="text-[11px] text-muted-foreground">{[l.year_built && `Built ${l.year_built}`, l.flag, l.location].filter(Boolean).join(" · ")}</p>
                      <p className="mt-1 text-sm font-bold text-primary">{l.price_text}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <Notice />
          </>
        )}
      </main>
    </div>
  );
};

export default Marketplace;
