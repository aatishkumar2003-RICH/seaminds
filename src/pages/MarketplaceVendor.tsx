import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Lock, LogOut, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PasswordInput from "@/components/PasswordInput";
import MarketplaceExchange from "@/components/marketplace/MarketplaceExchange";
import { VENDOR_TYPES, vendorHubs, type ExchangeCategory } from "@/lib/marketplaceExchange";

type Vendor = { user_id: string; company_name: string; vendor_type: string; contact_email: string | null; whatsapp: string | null; city: string | null; country: string | null; status: string };
type Inq = { id: string; created_at: string; channel: string; port: string | null; quantity: string | null; needed_by: string | null; notes: string | null; marketplace_items: { title: string } };
const db = supabase as unknown as { from: (t: string) => any };
const inp = "w-full rounded-xl border border-primary/30 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";
const lbl = "space-y-1 text-xs text-muted-foreground";

const emptyForm = { company: "", type: "spares_supplier", name: "", email: "", password: "", whatsapp: "", city: "", country: "India" };

/** Fields shared by sign-up and "register existing account as supplier". */
const CompanyFields = ({ f, set }: { f: typeof emptyForm; set: (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void }) => (
  <>
    <label className={lbl}>Company name<input className={inp} maxLength={120} value={f.company} onChange={set("company")} autoComplete="organization" placeholder="e.g. Abhi Marine Pvt Ltd" /></label>
    <label className={lbl}>Business type
      <select className={inp} value={f.type} onChange={set("type")}>{VENDOR_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}</select>
    </label>
    <div className="grid grid-cols-2 gap-2">
      <label className={lbl}>City<input className={inp} maxLength={80} value={f.city} onChange={set("city")} placeholder="Mumbai" /></label>
      <label className={lbl}>Country<input className={inp} maxLength={80} value={f.country} onChange={set("country")} /></label>
    </div>
    <label className={lbl}>WhatsApp for quote requests<input className={inp} inputMode="tel" maxLength={30} value={f.whatsapp} onChange={set("whatsapp")} placeholder="+91 98xxxxxxxx" /></label>
  </>
);

const MarketplaceVendor = () => {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null | undefined>(undefined);
  const [mode, setMode] = useState<"register" | "signin">("register");
  const [f, setF] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [hub, setHub] = useState<ExchangeCategory>("spares");
  const [tab, setTab] = useState<"listings" | "inquiries">("listings");
  const [inqs, setInqs] = useState<Inq[]>([]);
  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  const loadVendor = useCallback(async () => {
    if (!user) { setVendor(null); return; }
    const { data } = await db.from("marketplace_vendors").select("*").eq("user_id", user.id).maybeSingle();
    setVendor(data ?? null);
    if (data) setHub(vendorHubs(data.vendor_type)[0]);
  }, [user]);
  useEffect(() => { if (isReady) loadVendor(); }, [isReady, loadVendor]);

  useEffect(() => {
    if (!vendor || !user) return;
    db.from("marketplace_inquiries").select("id,created_at,channel,port,quantity,needed_by,notes,marketplace_items!inner(title,seller_id)")
      .eq("marketplace_items.seller_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }: { data: Inq[] | null }) => setInqs(data ?? []));
  }, [vendor, user]);

  const signUp = async () => {
    if (f.company.trim().length < 2) return toast.error("Enter your company name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return toast.error("Enter a valid business email.");
    if (f.password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/marketplace/vendor`,
        data: { vendor_signup: true, vendor_company: f.company.trim(), vendor_type: f.type, full_name: f.name.trim(), whatsapp: f.whatsapp.trim(), city: f.city.trim(), country: f.country.trim() },
      },
    });
    setBusy(false);
    if (error) return toast.error(/registered|exists/i.test(error.message) ? "This email already has an account — use Sign in." : error.message);
    setSent(true);
  };

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
    setBusy(false);
    if (error) toast.error("Email or password is not correct.");
  };

  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return toast.error("Enter your email first.");
    await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    toast.success("Password reset link sent to your email.");
  };

  const registerExisting = async () => {
    if (!user || f.company.trim().length < 2) return toast.error("Enter your company name.");
    setBusy(true);
    const { error } = await db.from("marketplace_vendors").insert({
      user_id: user.id, company_name: f.company.trim(), vendor_type: f.type, contact_email: user.email,
      whatsapp: f.whatsapp.trim() || null, city: f.city.trim() || null, country: f.country.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error("Could not register your company. Please try again.");
    toast.success("Your supplier desk is ready.");
    loadVendor();
  };

  if (!isReady || vendor === undefined) return null;

  const Header = (
    <button onClick={back} className="flex items-center gap-1 text-sm text-primary"><ChevronLeft size={18} /> Back</button>
  );

  // Signed out: register or sign in as a supplier.
  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4">
        {Header}
        <div className="mx-auto mt-6 max-w-md space-y-4">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">SeaMinds Maritime Exchange</p>
            <h1 className="mt-1 text-xl font-bold text-foreground">Supplier, Yard &amp; Broker Desk</h1>
            <p className="mt-1 text-xs text-muted-foreground">For spares suppliers, shipyards, workshops, ship brokers and marine stores. Separate from seafarer and ship manager accounts.</p>
          </div>
          {sent ? (
            <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
              <p className="text-base font-bold text-foreground">Check your email</p>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to <b>{f.email}</b>. Tap it to open your supplier desk.</p>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
              <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-primary/30 p-1">
                {(["register", "signin"] as const).map((m) => (
                  <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                    className={`h-9 rounded-lg text-xs font-bold ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {m === "register" ? "Register company" : "Sign in"}
                  </button>
                ))}
              </div>
              {mode === "register" && <CompanyFields f={f} set={set} />}
              {mode === "register" && <label className={lbl}>Your name<input className={inp} maxLength={100} value={f.name} onChange={set("name")} autoComplete="name" /></label>}
              <label className={lbl}>Business email<input className={inp} type="email" value={f.email} onChange={set("email")} autoComplete="email" placeholder="sales@yourcompany.com" /></label>
              <label className={lbl}>Password<PasswordInput value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inp} autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>
              <button disabled={busy} onClick={mode === "register" ? signUp : signIn} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
                {mode === "register" ? "Create supplier account (free)" : "Sign in to my desk"}
              </button>
              {mode === "signin" && <button onClick={forgot} className="w-full text-xs text-primary">Forgot password?</button>}
            </div>
          )}
          <p className="text-center text-[11px] text-muted-foreground">Questions? admin@seaminds.life</p>
        </div>
      </div>
    );
  }

  // Signed in with another account type: register this account's company as a supplier.
  if (!vendor) {
    return (
      <div className="min-h-screen bg-background p-4">
        {Header}
        <div className="mx-auto mt-6 max-w-md space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
          <h1 className="text-lg font-bold text-foreground">Register your company as a supplier</h1>
          <p className="text-xs text-muted-foreground">Signed in as {user.email}. This adds a supplier desk to your account.</p>
          <CompanyFields f={f} set={set} />
          <button disabled={busy} onClick={registerExisting} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">Open my supplier desk</button>
        </div>
      </div>
    );
  }

  // Supplier desk.
  const type = VENDOR_TYPES.find((t) => t.id === vendor.vendor_type);
  const hubs = vendorHubs(vendor.vendor_type);
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between">
        {Header}
        <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1 text-xs text-muted-foreground"><LogOut size={14} /> Sign out</button>
      </div>
      <div className="mx-auto mt-4 max-w-3xl space-y-3">
        <div className="rounded-2xl border border-primary/30 bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">My supplier desk</p>
          <h1 className="text-lg font-bold text-foreground">{vendor.company_name}</h1>
          <p className="text-xs text-muted-foreground">{type?.icon} {type?.label}{vendor.city ? ` · ${vendor.city}` : ""}{vendor.country ? `, ${vendor.country}` : ""}</p>
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${vendor.status === "verified" ? "bg-primary text-primary-foreground" : "border border-primary/40 text-primary"}`}>
            {vendor.status === "verified" ? "✓ Verified partner" : "Verification pending"}
          </span>
        </div>
        <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-3 text-[11px] leading-snug text-muted-foreground">
          <Lock size={16} className="mt-0.5 shrink-0 text-primary" />
          <p>Private partner phase: your listings, prices and contacts are visible only to your company and the SeaMinds team. Buyers can search them once the exchange opens.</p>
        </div>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-primary/30 p-1">
          <button role="tab" aria-selected={tab === "listings"} onClick={() => setTab("listings")} className={`h-9 rounded-lg text-xs font-bold ${tab === "listings" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>My listings</button>
          <button role="tab" aria-selected={tab === "inquiries"} onClick={() => setTab("inquiries")} className={`h-9 rounded-lg text-xs font-bold ${tab === "inquiries" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Quote requests ({inqs.length})</button>
        </div>
        {tab === "listings" ? (
          <>
            {hubs.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto">
                {hubs.map((h) => {
                  const meta = VENDOR_HUB_LABEL[h];
                  return <button key={h} onClick={() => setHub(h)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${hub === h ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-muted-foreground"}`}>{meta}</button>;
                })}
              </div>
            )}
            {vendor.vendor_type === "ship_broker" && (
              <button onClick={() => navigate("/marketplace/post")} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">🚢 List a vessel for sale</button>
            )}
            <MarketplaceExchange key={hub} category={hub} canPost defaults={{ company: vendor.company_name, whatsapp: vendor.whatsapp ?? "", email: vendor.contact_email ?? "" }} />
          </>
        ) : inqs.length === 0 ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 text-primary" size={28} />No quote requests yet. They appear here once buyers can search the exchange.
          </div>
        ) : (
          <div className="space-y-2">
            {inqs.map((q) => (
              <div key={q.id} className="rounded-2xl border border-primary/30 bg-card p-3 text-xs">
                <p className="text-sm font-bold text-foreground">{q.marketplace_items?.title}</p>
                <p className="text-muted-foreground">{new Date(q.created_at).toLocaleString()} · via {q.channel}</p>
                {q.port && <p className="text-muted-foreground">Delivery: {q.port}{q.needed_by ? ` by ${q.needed_by}` : ""}</p>}
                {q.quantity && <p className="text-muted-foreground">Quantity: {q.quantity}</p>}
                {q.notes && <p className="mt-1 whitespace-pre-line text-foreground">{q.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const VENDOR_HUB_LABEL: Record<ExchangeCategory, string> = { spares: "⚙️ Spares & Parts", yards: "🛠️ Yards & Workshops", tech: "🦺 Tech, PPE & Stores" };

export default MarketplaceVendor;
