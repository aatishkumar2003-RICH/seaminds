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
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none";
  const flags = c?.ai_result?.flags || [];
  const hasPrev = !!c?.document_paths?.length;
  const done = [license.trim() && website.trim(), person.name?.trim() && person.email?.trim() && person.phone?.trim(), bizFile, crewFile].filter(Boolean).length;
  const Field = ({ label, hint, req = true, children }: { label: string; hint: string; req?: boolean; children: React.ReactNode }) => (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-foreground">{label}{req ? <span className="text-primary"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}</span>
      {children}
      <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>
    </label>
  );
  const Drop = ({ title, hint, file, set }: { title: string; hint: string; file: File | null; set: (f: File | null) => void }) => (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 transition ${file ? "border-primary bg-primary/10" : "border-primary/40 hover:bg-primary/5"}`}>
      <span className="text-xl">{file ? "✅" : "📄"}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-foreground">{title} <span className="text-primary">*</span></span>
        <span className="block truncate text-[11px] text-muted-foreground">{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : hint}</span>
      </span>
      <span className="shrink-0 text-[11px] font-bold text-primary">{file ? "Change" : "Upload"}</span>
      <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => set(e.target.files?.[0] || null)} />
    </label>
  );
  const Step = ({ n, t }: { n: number; t: string }) => (
    <p className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-primary">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/50 text-[10px]">{n}</span>{t}
    </p>
  );

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
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="rounded-lg border border-primary/20 bg-background/50 p-3">
            <p className="text-xs font-semibold text-foreground">What you need ready</p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              <li>• Your crewing / recruitment licence number</li>
              <li>• Your official company website</li>
              <li>• Details of the person responsible for the company</li>
              <li>• Two documents (PDF or clear photo, max 10 MB each)</li>
            </ul>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${done * 25}%` }} /></div>
            <p className="mt-1 text-[10px] text-muted-foreground">{done} of 4 sections complete · checked automatically, you can keep working meanwhile</p>
          </div>
          {c?.admin_note && <p className="mt-2 text-xs text-primary">Note from SeaMinds: {c.admin_note}</p>}
          {status === "flagged" && flags.length > 0 && (
            <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2">
              <p className="text-xs font-semibold text-destructive">Please fix and resubmit:</p>
              <ul className="list-disc pl-5 text-[11px] text-destructive">{flags.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}

          <Step n={1} t="Company details" />
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Crewing licence number" hint="Exactly as printed on your licence, e.g. RPSL / SIUPPAK / MLC recruitment licence no.">
              <input className={input} placeholder="e.g. SIUPPAK 123.4/AL.003/2024" value={license} onChange={(e) => setLicense(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Company website" hint="Your official website, e.g. www.yourcompany.com">
              <input className={input} type="url" inputMode="url" placeholder="https://www.yourcompany.com" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} />
            </Field>
          </div>

          <Step n={2} t="Responsible person" />
          <p className="mt-1 text-[11px] text-muted-foreground">Director or manager accountable for crewing at your company.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Full name" hint="As on their ID"><input className={input} placeholder="e.g. Budi Santoso" maxLength={150} value={person.name || ""} onChange={(e) => setPerson({ ...person, name: e.target.value })} /></Field>
            <Field label="Designation" req={false} hint="e.g. Director, Crewing Manager"><input className={input} placeholder="e.g. Crewing Manager" maxLength={150} value={person.title || ""} onChange={(e) => setPerson({ ...person, title: e.target.value })} /></Field>
            <Field label="Work email" hint="Company email preferred"><input className={input} type="email" placeholder="name@yourcompany.com" maxLength={200} value={person.email || ""} onChange={(e) => setPerson({ ...person, email: e.target.value })} /></Field>
            <Field label="Phone / WhatsApp" hint="With country code, e.g. +62 812 3456 7890"><input className={input} type="tel" placeholder="+62 812 3456 7890" maxLength={50} value={person.phone || ""} onChange={(e) => setPerson({ ...person, phone: e.target.value })} /></Field>
          </div>

          <Step n={3} t="Documents" />
          {hasPrev && <p className="mt-1 text-[11px] text-muted-foreground">Documents already received. Upload fresh copies to resubmit.</p>}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Drop title="Business licence" hint="Company registration / NIB / trade licence" file={bizFile} set={setBizFile} />
            <Drop title="Crewing licence" hint="RPSL / SIUPPAK / recruitment licence" file={crewFile} set={setCrewFile} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Full page, all corners visible, not blurred. Company name must match your profile.</p>

          <button disabled={busy} onClick={submit} className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60 sm:w-auto">
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        </div>
      )}
    </section>
  );
}
