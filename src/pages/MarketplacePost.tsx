import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VESSEL_TYPES, MAX_PHOTOS, MARKETPLACE_NOTICE, compressPhoto } from "@/lib/shipMarketplace";

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
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setAllowed(false); return; }
    supabase.rpc("is_approved_manager", { _uid: user.id }).then(({ data }) => setAllowed(!!data));
  }, [user]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const field = (k: string, label: string, ph = "") => (
    <label className="space-y-1 text-xs text-muted-foreground"><span>{label}</span><input className={inp} value={f[k] ?? ""} onChange={set(k)} placeholder={ph} /></label>
  );

  const submit = async () => {
    if (!user) return;
    if (!f.contact_whatsapp && !f.contact_email) return toast.error("Add a WhatsApp number or email so buyers can reach you.");
    if (!authority || !agree) return toast.error("Please confirm your authority to sell and accept the marketplace notice.");
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const file of photos.slice(0, MAX_PHOTOS)) {
        const blob = await compressPhoto(file);
        const path = `${user.id}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from("ship-listings").upload(path, blob, { contentType: "image/webp" });
        if (error) throw error;
        paths.push(path);
      }
      const { data, error } = await supabase.from("ship_listings").insert({
        vessel_type: f.vessel_type, vessel_name: f.vessel_name || null, imo: f.imo || null, show_identity: showId,
        flag: f.flag || null, class_society: f.class_society || null, year_built: num(f.year_built ?? ""), builder: f.builder || null,
        dwt: num(f.dwt ?? ""), gt: num(f.gt ?? ""), loa_m: num(f.loa_m ?? ""), beam_m: num(f.beam_m ?? ""),
        main_engine: f.main_engine || null, bwts: f.bwts || null, scrubber: f.scrubber || null, eexi_cii: f.eexi_cii || null,
        cargo_capacity: f.cargo_capacity || null, cargo_gear: f.cargo_gear || null,
        price_text: f.price_text || "On request", location: f.location || null, delivery_window: f.delivery_window || null,
        description: f.description || null, seller_company: f.seller_company || null,
        contact_whatsapp: f.contact_whatsapp || null, contact_email: f.contact_email || null,
        authority_basis: authority, photos: paths,
      }).select("id").single();
      if (error) throw error;
      toast.success("Your vessel is now listed.");
      navigate(`/marketplace?id=${data.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Could not publish the listing. Please check your connection and try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/30 bg-background/95 px-3 py-3 backdrop-blur">
        <button onClick={() => navigate("/marketplace")} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary"><ChevronLeft /></button>
        <h1 className="text-base font-bold">List a vessel for sale</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 p-4">
        {allowed === null ? <p className="text-sm text-muted-foreground">Checking your account…</p> : !allowed ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-5 text-sm text-muted-foreground">Listing vessels is open to approved ship owners and managers. Sign in with your company account; new accounts can list once approved by our team.</div>
        ) : (
          <>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Identity</h2>
              <label className="space-y-1 text-xs text-muted-foreground"><span>Vessel type</span>
                <select className={inp} value={f.vessel_type} onChange={set("vessel_type")}>{VESSEL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">{field("vessel_name", "Vessel name")}{field("imo", "IMO number")}{field("flag", "Flag")}{field("class_society", "Class society")}</div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showId} onChange={(e) => setShowId(e.target.checked)} />Show name & IMO publicly (otherwise "On request")</label>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Build & size</h2>
              <div className="grid grid-cols-2 gap-3">{field("year_built", "Year built", "2012")}{field("builder", "Builder / yard")}{field("dwt", "DWT")}{field("gt", "GT")}{field("loa_m", "LOA (m)")}{field("beam_m", "Beam (m)")}</div>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Machinery, green & cargo</h2>
              <div className="grid grid-cols-2 gap-3">{field("main_engine", "Main engine")}{field("bwts", "BWTS")}{field("scrubber", "Scrubber")}{field("eexi_cii", "EEXI / CII")}{field("cargo_capacity", "Cargo capacity")}{field("cargo_gear", "Cranes / gear")}</div>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Commercial</h2>
              <div className="grid grid-cols-2 gap-3">{field("price_text", "Price idea", "On request")}{field("location", "Current location")}{field("delivery_window", "Delivery window")}{field("seller_company", "Your company")}</div>
              <label className="space-y-1 text-xs text-muted-foreground"><span>Description</span><textarea rows={4} className={inp} value={f.description ?? ""} onChange={set("description")} placeholder="Surveys due, trading history, condition…" /></label>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Photos ({photos.length}/{MAX_PHOTOS})</h2>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-primary/30">
                    <img src={URL.createObjectURL(p)} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute right-0.5 top-0.5 rounded-full bg-background p-0.5"><X size={12} /></button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/50 text-[10px] text-primary">
                    <ImagePlus size={18} />Add
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos([...photos, ...Array.from(e.target.files ?? [])].slice(0, MAX_PHOTOS))} />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Photos are auto-compressed for slow ship connections. Only upload photos you own or have permission to use.</p>
            </section>
            <section className="space-y-3"><h2 className="text-sm font-bold text-primary">Buyer contact</h2>
              <div className="grid grid-cols-2 gap-3">{field("contact_whatsapp", "WhatsApp", "+65…")}{field("contact_email", "Email")}</div>
            </section>
            <section className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
              <h2 className="text-sm font-bold text-primary">Authority to sell</h2>
              {[["owner", "I am the registered owner (or its officer)"], ["manager", "I am the vessel's manager, authorised by the owner"], ["mandate", "I hold a written mandate from the owner"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-xs"><input type="radio" name="auth" checked={authority === v} onChange={() => setAuthority(v)} />{l}</label>
              ))}
              <p className="text-[11px] leading-snug text-muted-foreground">{MARKETPLACE_NOTICE}</p>
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I confirm the details are accurate to my knowledge, I am authorised to offer this vessel, and I accept the notice above.</label>
            </section>
            <button disabled={busy} onClick={submit} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "Publishing…" : "Publish listing (free)"}</button>
          </>
        )}
      </main>
    </div>
  );
};

export default MarketplacePost;
