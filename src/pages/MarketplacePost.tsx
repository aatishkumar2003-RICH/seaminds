import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VESSEL_TYPES, MARKETPLACE_NOTICE, SELLER_DECLARATION, marketplaceApprovalMailto } from "@/lib/shipMarketplace";
import { SHIP_SPEC, SHIP_PHOTO_SLOTS, missingRequired } from "@/lib/marketplaceSpecs";
import { SpecFields, PhotoSlots, DocUpload, uploadListingMedia } from "@/components/marketplace/ListingSpecForm";
import { useMarketWallet } from "@/components/marketplace/SupplierWallet";

const inp = "w-full rounded-xl border border-primary/30 bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")) || null);

const MarketplacePost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [f, setF] = useState<Record<string, string>>({ vessel_type: "Bulk Carrier", price_text: "On request" });
  const [showId, setShowId] = useState(false);
  const [authority, setAuthority] = useState("");
  const [agree, setAgree] = useState(false);
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [spec, setSpec] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<File[]>([]);
  const { wallet, reload } = useMarketWallet();
  const cost = wallet?.ship ?? 0;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setAllowed(false); return; }
    supabase.rpc("is_marketplace_seller" as any, { _uid: user.id }).then(({ data }) => setAllowed(!!data));
  }, [user]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const field = (k: string, label: string, ph = "") => (
    <label className="space-y-1 text-xs text-muted-foreground"><span>{label}</span><input className={inp} value={f[k] ?? ""} onChange={set(k)} placeholder={ph} /></label>
  );

  const submit = async () => {
    if (!user) return;
    if (!f.contact_whatsapp && !f.contact_email) return toast.error("Add a WhatsApp number or email so buyers can reach you.");
    if (!f.dwt || !f.year_built || !f.main_engine || !f.class_society) return toast.error("Please add DWT, year built, main engine and class society.");
    const miss = missingRequired(SHIP_SPEC, spec, SHIP_PHOTO_SLOTS, photos);
    if (miss.length) return toast.error(`Please complete: ${miss.slice(0, 4).join(", ")}${miss.length > 4 ? "…" : ""}`);
    if (!docs.length) return toast.error("Attach at least the GA plan or vessel particulars (Q88 / Form C) as PDF.");
    if (!authority || !agree) return toast.error("Please confirm your authority to sell and accept the marketplace notice.");
    if (wallet && wallet.balance < cost) return toast.error(`A vessel listing needs ${cost} credits. Request free credits from your supplier wallet.`);
    setBusy(true);
    try {
      const { photoPaths: paths, docPaths } = await uploadListingMedia(user.id, photos, docs);
      const { data, error } = await supabase.from("ship_listings").insert({
        vessel_type: f.vessel_type, vessel_name: f.vessel_name || null, imo: f.imo || null, show_identity: showId,
        flag: f.flag || null, class_society: f.class_society || null, year_built: num(f.year_built ?? ""), builder: f.builder || null,
        dwt: num(f.dwt ?? ""), gt: num(f.gt ?? ""), loa_m: num(f.loa_m ?? ""), beam_m: num(f.beam_m ?? ""),
        main_engine: f.main_engine || null, bwts: f.bwts || null, scrubber: f.scrubber || null, eexi_cii: f.eexi_cii || null,
        cargo_capacity: f.cargo_capacity || null, cargo_gear: f.cargo_gear || null,
        price_text: f.price_text || "On request", location: f.location || null, delivery_window: f.delivery_window || null,
        description: f.description || null, seller_company: f.seller_company || null,
        contact_whatsapp: f.contact_whatsapp || null, contact_email: f.contact_email || null,
        authority_basis: authority, photos: paths, specifications: spec, documents: docPaths,
      }).select("id").single();
      if (error) throw error;
      reload();
      toast.success(cost > 0 ? `Your vessel is now listed · ${cost} credits used.` : "Your vessel is now listed.");
      navigate("/marketplace/vendor", { replace: true });
    } catch (e) {
      console.error(e);
      toast.error(/INSUFFICIENT_CREDITS/.test((e as Error)?.message ?? "") ? "Not enough credits. Request free credits from your supplier wallet." : "Could not publish the listing. Please check your connection and try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/30 bg-background/95 px-3 py-3 backdrop-blur">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/marketplace/vendor"))} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary"><ChevronLeft /></button>
        <h1 className="text-base font-bold">List a vessel for sale</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 p-4">
        {allowed === null ? <p className="text-sm text-muted-foreground">Checking your account…</p> : !allowed ? (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-bold text-primary"><Lock size={16} />Listing approval required</p>
            <p>To protect buyers, every seller is checked by the SeaMinds team before listing. Send us a short email with your company and your authority to sell (owner, mandate or broker). Browsing listings stays open to everyone.</p>
            <a href={marketplaceApprovalMailto(null, user?.email)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground"><Mail size={16} />Request approval by email</a>
          </div>
        ) : (
          <>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Identity</h2>
              <label className="space-y-1 text-xs text-muted-foreground"><span>Vessel type</span>
                <select className={inp} value={f.vessel_type} onChange={set("vessel_type")}>{VESSEL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">{field("vessel_name", "Vessel name")}{field("imo", "IMO number")}{field("flag", "Flag")}{field("class_society", "Class society *")}</div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showId} onChange={(e) => setShowId(e.target.checked)} />Show name & IMO publicly (otherwise "On request")</label>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Build & size</h2>
              <div className="grid grid-cols-2 gap-3">{field("year_built", "Year built *", "2012")}{field("builder", "Builder / yard")}{field("dwt", "DWT *")}{field("gt", "GT")}{field("loa_m", "LOA (m)")}{field("beam_m", "Beam (m)")}</div>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Machinery, green & cargo</h2>
              <div className="grid grid-cols-2 gap-3">{field("main_engine", "Main engine maker & model *")}{field("bwts", "BWTS")}{field("scrubber", "Scrubber")}{field("eexi_cii", "EEXI / CII")}{field("cargo_capacity", "Cargo capacity")}{field("cargo_gear", "Cranes / gear")}</div>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Commercial</h2>
              <div className="grid grid-cols-2 gap-3">{field("price_text", "Price idea", "On request")}{field("location", "Current location")}{field("delivery_window", "Delivery window")}{field("seller_company", "Your company")}</div>
              <label className="space-y-1 text-xs text-muted-foreground"><span>Description</span><textarea rows={4} className={inp} value={f.description ?? ""} onChange={set("description")} placeholder="Surveys due, trading history, condition…" /></label>
            </section>
            <SpecFields groups={SHIP_SPEC} spec={spec} onChange={(k, v) => setSpec((p) => ({ ...p, [k]: v }))} />
            <PhotoSlots slots={SHIP_PHOTO_SLOTS} photos={photos} onChange={setPhotos} />
            <DocUpload label="GA plan, Q88 / Form C, class survey status" docs={docs} onChange={setDocs} />
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Buyer contact</h2>
              <div className="grid grid-cols-2 gap-3">{field("contact_whatsapp", "WhatsApp", "+65…")}{field("contact_email", "Email")}</div>
            </section>
            <section className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
              <h2 className="text-sm font-bold text-primary">Authority to sell</h2>
              {[["owner", "I am the registered owner (or its officer)"], ["manager", "I am the vessel's manager, authorised by the owner"], ["mandate", "I hold a written mandate from the owner"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-xs"><input type="radio" name="auth" checked={authority === v} onChange={() => setAuthority(v)} />{l}</label>
              ))}
              <p className="text-[11px] leading-snug text-muted-foreground">{MARKETPLACE_NOTICE}</p>
              <div className="space-y-1"><p className="text-xs font-bold text-primary">Seller's declaration of authority and accuracy</p>
                <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-snug text-muted-foreground">{SELLER_DECLARATION.map((d) => <li key={d}>{d}</li>)}</ol></div>
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I confirm and warrant each statement in the seller's declaration above, and I accept the marketplace notice and the <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline">Terms of Service</a>.</label>
            </section>
            <button disabled={busy} onClick={submit} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "Publishing…" : cost > 0 ? `Publish vessel · ${cost} credits${wallet ? ` (you have ${wallet.balance})` : ""}` : "Publish listing (free)"}</button>
          </>
        )}
      </main>
    </div>
  );
};

export default MarketplacePost;
