import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Person = { name?: string; title?: string; email?: string; phone?: string };
type C = {
  status: string; requested_items: string[]; admin_note: string | null; license_number: string | null; website: string | null;
  document_paths: string[]; responsible_person: Person | null; ai_result: { flags?: string[] } | null;
};

/** Self-service company verification: 4 items → AI check → auto-verified, or flagged to admin. Never blocks work. */
export default function CompanyCompliancePanel() {
  const { user } = useAuth();
  const [c, setC] = useState<C | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [license, setLicense] = useState("");
  const [website, setWebsite] = useState("");
  const [person, setPerson] = useState<Person>({});
  const [bizFile, setBizFile] = useState<File | null>(null);
  const [crewFile, setCrewFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("company_compliance" as never).select("*").eq("manager_user_id", user.id).maybeSingle();
    const row = data as unknown as C | null;
    setC(row); setLoaded(true);
    if (row) { setLicense(row.license_number || ""); setWebsite(row.website || ""); setPerson(row.responsible_person || {}); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  if (!loaded || !user) return null;
  const status = c?.status || "none";

  if (status === "verified") {
    return (
      <section className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2 text-xs">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="font-bold text-primary">🛡️ Company Verified ✓</span>
        {c?.license_number && <span className="truncate text-muted-foreground">· Licence {c.license_number}</span>}
      </section>
    );
  }

  const upload = async (f: File, tag: string) => {
    const path = `${user.id}/${tag}-${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("company-documents").upload(path, f);
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return path;
  };

  const submit = async () => {
    if (!license.trim() || !website.trim()) { toast.error("Licence number and website are required"); return; }
    if (!person.name?.trim() || !person.email?.trim() || !person.phone?.trim()) { toast.error("Responsible person name, email and phone are required"); return; }
    if (!bizFile || !crewFile) { toast.error("Upload both the business licence and the crewing licence"); return; }
    const bad = [bizFile, crewFile].find((f) => f.size > 10 * 1024 * 1024 || !/pdf|image\//.test(f.type));
    if (bad) { toast.error(`${bad.name}: PDF or image up to 10 MB only`); return; }
    setBusy(true);
    try {
      const [b, k] = [await upload(bizFile, "business"), await upload(crewFile, "crewing")];
      const { error } = await supabase.rpc("submit_company_verification" as never, { p_license: license.trim(), p_website: website.trim(), p_person: person, p_business_path: b, p_crewing_path: k } as never);
      if (error) throw new Error(error.message);
      toast.info("Documents received — checking them now. You can keep working.");
      setOpen(false); load();
      const { data } = await supabase.functions.invoke("verify-company", { body: {} });
      if (data?.status === "verified") toast.success("Company verified ✓");
      else toast.warning("Our team will take a quick look at your documents.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); setBizFile(null); setCrewFile(null); load(); }
  };

  const alarm = status === "requested" || status === "flagged";
  const label = status === "ai_review" ? "Checking your documents…"
    : status === "flagged" ? "Verification needs attention"
    : status === "requested" ? `Action required · ${c?.requested_items.length || 0} item(s) requested`
    : status === "submitted" ? "Verification under review"
    : "Verify your company · 4 quick items";
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  const flags = c?.ai_result?.flags || [];

  return (
    <section id="compliance" className={`mx-4 sm:mx-6 mt-3 rounded-xl border bg-card ${alarm ? "border-destructive/60" : "border-primary/30"}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        {alarm ? (
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
          </span>
        ) : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary/70" />}
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-primary">🛡️ {label}</span>
        <span className="shrink-0 text-[11px] font-semibold text-primary">{open ? "Hide ▴" : "Open ▾"}</span>
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-2">
          <p className="text-xs text-muted-foreground">Upload once — documents are checked automatically, usually within a minute. You can keep using SeaMinds meanwhile.</p>
          {c?.admin_note && <p className="mt-2 text-xs text-primary">Note from SeaMinds: {c.admin_note}</p>}
          {status === "flagged" && flags.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-destructive">{flags.map((f) => <li key={f}>{f}</li>)}</ul>
          )}
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-primary">1 · Company</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <input className={input} placeholder="Crewing licence no. (RPSL / SIUPPAK)" value={license} onChange={(e) => setLicense(e.target.value)} maxLength={200} />
            <input className={input} placeholder="Official company website" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} />
          </div>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-primary">2 · Responsible person</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(["name", "title", "email", "phone"] as const).map((k) => (
              <input key={k} className={input} maxLength={k === "email" ? 200 : 150} type={k === "email" ? "email" : "text"}
                placeholder={{ name: "Full name", title: "Designation (optional)", email: "Email", phone: "Phone / WhatsApp" }[k]}
                value={person[k] || ""} onChange={(e) => setPerson({ ...person, [k]: e.target.value })} />
            ))}
          </div>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-primary">3 · Documents (PDF or photo, max 10 MB)</p>
          <label className="mt-1 block text-xs text-foreground">Business licence / company registration
            <input type="file" accept="application/pdf,image/*" className="mt-1 block text-xs text-muted-foreground" onChange={(e) => setBizFile(e.target.files?.[0] || null)} />
          </label>
          <label className="mt-2 block text-xs text-foreground">Crewing licence (RPSL / SIUPPAK / recruitment licence)
            <input type="file" accept="application/pdf,image/*" className="mt-1 block text-xs text-muted-foreground" onChange={(e) => setCrewFile(e.target.files?.[0] || null)} />
          </label>
          <button disabled={busy} onClick={submit} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        </div>
      )}
    </section>
  );
}
