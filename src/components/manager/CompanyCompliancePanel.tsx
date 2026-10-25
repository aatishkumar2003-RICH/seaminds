import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type C = { status: string; requested_items: string[]; admin_note: string | null; license_number: string | null; website: string | null; document_paths: string[] };

/** Shows only when SeaMinds has requested company documents. Uploads go to a private folder. */
export default function CompanyCompliancePanel() {
  const { user } = useAuth();
  const [c, setC] = useState<C | null>(null);
  const [license, setLicense] = useState("");
  const [website, setWebsite] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("company_compliance" as never).select("*").eq("manager_user_id", user.id).maybeSingle();
    const row = data as unknown as C | null;
    setC(row);
    if (row) { setLicense(row.license_number || ""); setWebsite(row.website || ""); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  if (!c || c.status === "none" || c.status === "verified") return null;

  const submit = async () => {
    if (!user) return;
    if (!license.trim() && !website.trim() && files.length === 0) { toast.error("Add at least one item before submitting"); return; }
    const bad = files.find((f) => f.size > 10 * 1024 * 1024 || !/pdf|image\//.test(f.type));
    if (bad) { toast.error(`${bad.name}: PDF or image up to 10 MB only`); return; }
    setBusy(true);
    const paths: string[] = [];
    for (const f of files) {
      const path = `${user.id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("company-documents").upload(path, f);
      if (error) { setBusy(false); toast.error(`Upload failed: ${error.message}`); return; }
      paths.push(path);
    }
    const { error } = await supabase.rpc("submit_company_compliance" as never, { p_license: license.trim(), p_website: website.trim(), p_note: note.trim() || null, p_paths: paths } as never);
    if (error) { setBusy(false); toast.error(error.message); return; }
    await supabase.functions.invoke("company-compliance-notify", { body: { event: "docs_submitted" } });
    setBusy(false); setFiles([]); setNote("");
    toast.success("Submitted — SeaMinds will review your documents");
    load();
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  const alarm = c.status === "requested";
  const isOpen = open ?? false;
  return (
    <section id="compliance" className={`mx-4 sm:mx-6 mt-3 rounded-xl border bg-card ${alarm ? "border-destructive/60" : "border-primary/30"}`}>
      <button type="button" onClick={() => setOpen(!isOpen)} aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        {alarm ? (
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
          </span>
        ) : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary/70" />}
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-primary">
          🛡️ {alarm ? `Action required · ${c.requested_items.length} item(s) requested` : "Verification under review"}
          {alarm && c.admin_note && <span className="font-normal text-muted-foreground"> · {c.admin_note}</span>}
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-primary">{isOpen ? "Hide ▴" : alarm ? "Open ▾" : "View ▾"}</span>
      </button>
      {isOpen && <div className="border-t border-border px-4 pb-4 pt-2">
      {c.status === "submitted" ? (
        <p className="mt-1 text-xs text-muted-foreground">Thank you — your documents are under review. You can add more below if needed.</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">SeaMinds has requested the items below. Please upload them here — no need to email.</p>
      )}
      <ul className="mt-2 list-disc pl-5 text-xs text-foreground">{c.requested_items.map((i) => <li key={i}>{i}</li>)}</ul>
      {c.admin_note && <p className="mt-2 text-xs text-primary">Note from SeaMinds: {c.admin_note}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className={input} placeholder="Licence / registration no. (e.g. RPSL, SIUPPAK)" value={license} onChange={(e) => setLicense(e.target.value)} maxLength={200} />
        <input className={input} placeholder="Company website" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} />
      </div>
      <textarea className={`${input} mt-2`} rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      <input type="file" multiple accept="application/pdf,image/*" className="mt-2 block text-xs text-muted-foreground" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
      {c.document_paths.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{c.document_paths.length} file(s) already received.</p>}
      <button disabled={busy} onClick={submit} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
        {busy ? "Submitting…" : "Submit for verification"}
      </button>
      </div>}
    </section>
  );
}
