import { shareZalo } from "@/lib/zaloShare";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, UserPlus, Download, Mail, MessageCircle, Link2, ShieldCheck, Search, FileDown, Trash2, ScanLine, Paperclip, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readRosterFile, templateCsv, inviteMessage, claimLink, IMPORT_ERRORS, toIsoDate, type CrewImportRow } from "@/lib/companyCrewImport";
import { readXlsxCv, isSpreadsheet } from "@/lib/xlsxCv";
import { buildResumePdf } from "@/lib/resumePdf";
import { cvToCrewRow, archiveCv, CV_ACCEPT } from "@/lib/cvToCrewRow";

type Rec = {
  id: string; crew_unique_id: string; live_crew_unique_id: string; first_name: string; last_name: string; rank: string; nationality: string | null;
  email: string | null; whatsapp: string | null; date_of_birth: string | null; vessel: string | null; available_from: string | null;
  cdc_no: string | null; passport_no: string | null; notes: string | null; sea_service: any[]; certificates: any[]; status: string;
  claim_token: string; invited_at: string | null; invite_channel: string | null; accepted_at: string | null; company_name: string | null;
};
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Not invited", cls: "border-border text-muted-foreground" },
  invited: { label: "Invited", cls: "border-amber-400/50 text-amber-400" },
  accepted: { label: "Accepted ✓", cls: "border-emerald-400/50 text-emerald-400" },
  declined: { label: "Declined", cls: "border-destructive/50 text-destructive" },
};
const input = "w-full rounded-xl border border-border bg-background px-3 min-h-[42px] text-sm text-foreground";
const daysTo = (d?: string) => { const iso = toIsoDate(d || "") ; return iso ? Math.floor((new Date(iso).getTime() - Date.now()) / 86400000) : null; };
const toBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(f); });

export default function CompanyCrewTab() {
  const [list, setList] = useState<Rec[] | null>(null);
  const [q, setQ] = useState(""); const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false); const [openId, setOpenId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: CrewImportRow[]; problems: { line: number; reason: string }[]; duplicates: number; name: string } | null>(null);
  const [bulkCv, setBulkCv] = useState(false); const lastIds = useRef<string[]>([]);
  const [busy, setBusy] = useState(""); const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("company_crew_list" as any);
    if (error) { toast.error("Could not load your company crew."); setList([]); return; }
    setList(((data as any[]) || []) as Rec[]);
  }, []);
  useEffect(() => { void load(); const onFocus = () => void load(); window.addEventListener("focus", onFocus); return () => window.removeEventListener("focus", onFocus); }, [load]);

  const shown = useMemo(() => (list || []).filter(r => (filter === "all" || r.status === filter) &&
    (!q || `${r.first_name} ${r.last_name} ${r.rank} ${r.live_crew_unique_id} ${r.vessel || ""} ${r.nationality || ""} ${r.email || ""}`.toLowerCase().includes(q.toLowerCase()))), [list, q, filter]);
  const counts = useMemo(() => { const c: Record<string, number> = { all: list?.length || 0 }; (list || []).forEach(r => { c[r.status] = (c[r.status] || 0) + 1; }); return c; }, [list]);
  const company = list?.[0]?.company_name || "Your company";

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "SeaMinds_Crew_Import_Template.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const pickFile = async (f?: File) => {
    if (!f) return;
    try { const p = await readRosterFile(f); setPreview({ ...p, name: f.name }); if (!p.rows.length) toast.error(p.problems[0]?.reason || "No crew rows found."); }
    catch (e: any) { toast.error(e?.message || "Could not read this file."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  const importRows = async (rows: CrewImportRow[]) => {
    let created = 0, skipped = 0, invalid = 0, updated = 0, linked = 0;
    for (let i = 0; i < rows.length; i += 200) {
      setBusy(`Adding crew ${Math.min(i + 200, rows.length)} / ${rows.length}…`);
      const { data, error } = await supabase.rpc("company_crew_import" as any, { p_rows: rows.slice(i, i + 200) as any });
      const d = data as any;
      if (error || !d?.ok) { setBusy(""); toast.error(IMPORT_ERRORS[d?.error] || "Could not add crew. Please try again."); await load(); return null; }
      lastIds.current = [...(i ? lastIds.current : []), ...((d.records || []) as any[]).map((x: any) => x.id)];
      created += d.created; skipped += d.skipped; invalid += d.invalid; updated += d.updated || 0; linked += d.linked || 0;
    }
    setBusy(""); await load();
    toast.success(`${created} crew added${updated ? ` · ${updated} existing updated` : ""}${linked ? ` · ${linked} already on SeaMinds` : ""}${skipped ? ` · ${skipped} already in your list` : ""}${invalid ? ` · ${invalid} skipped (no email, name or rank)` : ""}`);
    return created;
  };

  const markInvited = (ids: string[], channel: "whatsapp" | "link") => supabase.rpc("company_crew_mark_invited" as any, { p_ids: ids, p_channel: channel }).then(() => load());
  const whatsapp = (r: Rec) => {
    if (!r.whatsapp) { toast.error("No WhatsApp number for this crew member."); return; }
    window.open(`https://wa.me/${r.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(inviteMessage({ ...r, crew_unique_id: r.live_crew_unique_id }, company))}`, "_blank");
    void markInvited([r.id], "whatsapp");
  };
  const zalo = (r: Rec) => { void shareZalo(inviteMessage({ ...r, crew_unique_id: r.live_crew_unique_id }, company), r.whatsapp); void markInvited([r.id], "link"); };
  const copyLink = (r: Rec) => navigator.clipboard.writeText(inviteMessage({ ...r, crew_unique_id: r.live_crew_unique_id }, company)).then(() => { toast.success("Invitation message copied"); void markInvited([r.id], "link"); }, () => toast.error("Could not copy"));
  const emailInvite = async (ids: string[]) => {
    if (!ids.length) { toast.error("Select crew to invite first."); return; }
    setBusy("Sending email invitations…");
    const { data, error } = await supabase.functions.invoke("company-crew-invite", { body: { ids } });
    setBusy(""); const d = data as any;
    if (error || !d?.ok) { toast.error(d?.error || "Could not send invitations."); return; }
    toast.success(`${d.sent} invitation email(s) handed to the mail service${d.no_email ? ` · ${d.no_email} have no email` : ""}${d.skipped ? ` · ${d.skipped} skipped (already invited today or accepted)` : ""}`);
    setSel(new Set()); await load();
  };
  const exportLinks = () => {
    const rows = (list || []).filter(r => sel.size ? sel.has(r.id) : r.status !== "accepted");
    const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [["Crew ID", "Name", "Rank", "WhatsApp", "Email", "Status", "Claim link"], ...rows.map(r => [r.live_crew_unique_id, `${r.first_name} ${r.last_name}`.trim(), r.rank, r.whatsapp || "", r.email || "", r.status, claimLink(r.claim_token)])].map(r => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "SeaMinds_Crew_Claim_Links.csv"; a.click(); URL.revokeObjectURL(url);
    void markInvited(rows.filter(r => r.status === "pending").map(r => r.id), "link");
  };
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = shown.length > 0 && shown.every(r => sel.has(r.id));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="text-primary shrink-0" size={22} />
          <div>
            <p className="font-semibold text-foreground">Company Crew — add your own crew in minutes</p>
            <p className="text-xs text-muted-foreground">Add one seafarer or upload your whole crew list. Each one gets a SeaMinds Crew ID straight away and is marked <b>Company Verified</b>. Then send them a link: they check their details and accept with one tap.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAdding(true)} className="rounded-xl font-bold"><UserPlus size={16} /> Add crew member</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="rounded-xl border-primary text-primary"><Upload size={16} /> Upload crew list (Excel / CSV)</Button>
          <Button variant="outline" onClick={() => setBulkCv(true)} className="rounded-xl border-primary text-primary"><ScanLine size={16} /> Bulk upload CVs</Button>
          <Button variant="outline" onClick={() => setEmailList(true)} className="rounded-xl border-primary text-primary"><Mail size={16} /> Add by email list</Button>
          <Button variant="ghost" onClick={downloadTemplate} className="rounded-xl text-primary"><Download size={16} /> Download template</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => pickFile(e.target.files?.[0])} />
        </div>
        {busy && <p className="flex items-center gap-2 text-sm text-primary"><Loader2 className="animate-spin" size={16} /> {busy}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-3.5 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, rank, Crew ID, vessel…" className={`${input} pl-8`} /></div>
        {["all", "pending", "invited", "accepted", "declined"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-xl px-3 min-h-[38px] text-xs border ${filter === f ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground"}`}>
            {f === "all" ? "All" : STATUS[f].label} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {list && list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(shown.map(r => r.id)))} /> Select shown</label>
          <span className="text-xs text-muted-foreground">{sel.size} selected</span>
          <Button size="sm" variant="outline" className="rounded-xl border-primary text-primary" onClick={() => emailInvite([...sel])} disabled={!!busy}><Mail size={14} /> Email invites</Button>
          <Button size="sm" variant="outline" className="rounded-xl border-primary text-primary" onClick={exportLinks}><Link2 size={14} /> Export links for WhatsApp</Button>
        </div>
      )}

      {list === null && <p className="text-sm text-muted-foreground">Loading company crew…</p>}
      {list?.length === 0 && <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No company crew yet. Add a crew member or upload your crew list to start.</div>}
      <div className="space-y-2">
        {shown.map(r => {
          const exp = (r.certificates || []).map(c => daysTo(c.expiry_date)).filter((d): d is number => d !== null);
          const soon = exp.filter(d => d <= 90).length;
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
              <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select crew" />
              <button onClick={() => setOpenId(r.id)} className="flex-1 min-w-[200px] text-left">
                <p className="font-semibold text-foreground">{`${r.first_name} ${r.last_name}`.trim()} <span className="text-xs font-mono text-primary ml-1">{r.live_crew_unique_id}</span></p>
                <p className="text-xs text-muted-foreground">{[r.rank, r.nationality, r.vessel].filter(Boolean).join(" • ")}</p>
                <p className="text-[11px] text-muted-foreground">{r.sea_service?.length || 0} sea service · {r.certificates?.length || 0} certificates{soon ? <span className="text-amber-400"> · {soon} expiring ≤90 days</span> : null}</p>
              </button>
              <span className="text-[11px] rounded-full border border-emerald-400/40 text-emerald-400 px-2 py-0.5 flex items-center gap-1"><ShieldCheck size={11} /> Company Verified</span>
              <span className={`text-[11px] rounded-full border px-2 py-0.5 ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label || r.status}</span>
              {r.status !== "accepted" && r.status !== "declined" && <>
                <button onClick={() => whatsapp(r)} className="rounded-xl border border-primary text-primary px-2 min-h-[38px] text-xs flex items-center gap-1"><MessageCircle size={13} /> WhatsApp</button>
                <button onClick={() => zalo(r)} className="rounded-xl border border-primary text-primary px-2 min-h-[38px] text-xs flex items-center gap-1">💙 Zalo</button>
                <button onClick={() => emailInvite([r.id])} disabled={!r.email} className="rounded-xl border border-primary text-primary px-2 min-h-[38px] text-xs flex items-center gap-1 disabled:opacity-40"><Mail size={13} /> Email</button>
                <button onClick={() => copyLink(r)} className="rounded-xl border border-border text-muted-foreground px-2 min-h-[38px] text-xs flex items-center gap-1"><Link2 size={13} /> Copy</button>
              </>}
              <button onClick={() => setOpenId(r.id)} className="rounded-xl bg-primary text-primary-foreground font-bold px-3 min-h-[38px] text-xs">Open</button>
            </div>
          );
        })}
      </div>

      {adding && <AddCrewDialog onClose={() => setAdding(false)} onSave={async (row, cv) => { const n = await importRows([row]); if (n) { if (cv && lastIds.current[0]) await archiveCv(lastIds.current[0], cv); setAdding(false); } }} />}
      {bulkCv && <BulkCvDialog onClose={() => setBulkCv(false)} importOne={async (row, cv) => { const n = await importRows([row]); if (n && lastIds.current[0]) await archiveCv(lastIds.current[0], cv); return !!n; }} />}
      {preview && (
        <Dialog open onOpenChange={o => !o && setPreview(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Check your crew list</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{preview.name}: <b className="text-foreground">{preview.rows.length}</b> crew ready to add{preview.duplicates ? ` · ${preview.duplicates} repeated rows removed` : ""}.</p>
            {preview.problems.length > 0 && <div className="rounded-xl border border-amber-400/40 p-2 text-xs text-amber-400 max-h-32 overflow-y-auto">{preview.problems.slice(0, 50).map((p, i) => <p key={i}>Row {p.line}: {p.reason}</p>)}</div>}
            <div className="rounded-xl border border-border overflow-x-auto max-h-72">
              <table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{["Name", "Rank", "Nationality", "WhatsApp", "Email", "Vessel"].map(h => <th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
                <tbody>{preview.rows.slice(0, 100).map((r, i) => <tr key={i} className="border-t border-border"><td className="p-2">{r.first_name} {r.last_name}</td><td className="p-2">{r.rank}</td><td className="p-2">{r.nationality}</td><td className="p-2">{r.whatsapp}</td><td className="p-2">{r.email}</td><td className="p-2">{r.vessel}</td></tr>)}</tbody></table>
            </div>
            {preview.rows.length > 100 && <p className="text-xs text-muted-foreground">Showing first 100 rows.</p>}
            <p className="text-xs text-muted-foreground">By adding, you confirm these details come from your company records and that each seafarer will be asked to accept their profile.</p>
            <Button disabled={!preview.rows.length || !!busy} className="w-full min-h-12 rounded-xl font-bold" onClick={async () => { const rows = preview.rows; setPreview(null); await importRows(rows); }}>
              Add {preview.rows.length} crew & create Crew IDs
            </Button>
          </DialogContent>
        </Dialog>
      )}
      {openId && list && (() => { const r = list.find(x => x.id === openId); return r ? <RecordDialog rec={r} company={company} onClose={() => setOpenId(null)} onChanged={load} /> : null; })()}
    </div>
  );
}

function AddCrewDialog({ onClose, onSave }: { onClose: () => void; onSave: (r: CrewImportRow, cv?: File) => Promise<void> }) {
  const [f, setF] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false);
  const [cv, setCv] = useState<File | null>(null); const [reading, setReading] = useState(false); const [extra, setExtra] = useState<{ sea_service: any[]; certificates: any[] }>({ sea_service: [], certificates: [] });
  const cvIn = useRef<HTMLInputElement>(null);
  const readCv = async (file?: File) => {
    if (!file) return; setReading(true);
    try {
      const x: any = await cvToCrewRow(file);
      setF(s => { const n = { ...s }; for (const k of ["first_name", "last_name", "rank", "nationality", "whatsapp", "email", "vessel", "date_of_birth", "cdc_no", "passport_no"]) if (!n[k] && x[k]) n[k] = x[k]; return n; });
      setExtra({ sea_service: x.sea_service || [], certificates: x.certificates || [] }); setCv(file);
      toast.success(`CV read: ${x.sea_service?.length || 0} sea service, ${x.certificates?.length || 0} certificates — please check the details`);
    } catch (e: any) { toast.error(e?.message || "Could not read this CV."); }
    finally { setReading(false); if (cvIn.current) cvIn.current.value = ""; }
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: e.target.value }));
  const [found, setFound] = useState<any>(null);
  const lookup = async () => {
    const em = (f.email || "").trim().toLowerCase(); setFound(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return;
    const { data } = await supabase.rpc("manager_lookup_crew_by_email" as any, { p_emails: [em] });
    const m = ((data as any[]) || [])[0]; if (!m) return;
    setFound(m);
    setF(s => ({ ...s, first_name: s.first_name || m.first_name || "", last_name: s.last_name || m.last_name || "", rank: s.rank || m.rank || "", nationality: s.nationality || m.nationality || "" }));
  };
  const submit = async () => {
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((f.email || "").trim());
    if (!okEmail && (!f.first_name?.trim() || !f.rank?.trim())) { toast.error("Enter an email address, or first name and rank."); return; }
    setSaving(true);
    await onSave({ first_name: (f.first_name || "").trim(), last_name: (f.last_name || "").trim(), rank: (f.rank || "").trim(), nationality: f.nationality, email: f.email, whatsapp: f.whatsapp,
      date_of_birth: f.date_of_birth || undefined, vessel: f.vessel, available_from: f.available_from || undefined, cdc_no: f.cdc_no, passport_no: f.passport_no, ...extra } as any, cv || undefined);
    setSaving(false);
  };
  const field = (k: string, label: string, type = "text", ph = "") => <label className="text-xs text-muted-foreground">{label}<input type={type} value={f[k] || ""} onChange={set(k)} placeholder={ph} className={`${input} mt-1`} /></label>;
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add crew member</DialogTitle></DialogHeader>
        <button type="button" disabled={reading} onClick={() => cvIn.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void readCv(e.dataTransfer.files?.[0]); }}
          className="w-full rounded-xl border-2 border-dashed border-primary/50 p-4 text-center hover:bg-primary/5">
          {reading ? <p className="flex items-center justify-center gap-2 text-sm text-primary"><Loader2 className="animate-spin" size={16} /> Reading CV…</p>
            : cv ? <p className="text-sm text-primary">✅ Filled from {cv.name} — tap to use another CV</p>
            : <><p className="flex items-center justify-center gap-2 text-sm font-semibold text-primary"><ScanLine size={16} /> Upload or drop the crew CV to fill this form</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, CSV, text or a photo of the CV</p></>}
        </button>
        <input ref={cvIn} type="file" accept={CV_ACCEPT} className="hidden" onChange={e => readCv(e.target.files?.[0])} />
        <label className="block text-xs text-muted-foreground">Email — enough on its own; other details can be added later
          <input type="email" value={f.email || ""} onChange={set("email")} onBlur={lookup} placeholder="crew@email.com" className={`${input} mt-1`} /></label>
        {found && <p className="rounded-xl border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">✨ Already registered on SeaMinds: <b>{`${found.first_name || ""} ${found.last_name || ""}`.trim() || "crew member"}</b>{found.rank ? ` · ${found.rank}` : ""}. Details filled in — they can accept your company link with their own login.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("first_name", "First name")}{field("last_name", "Last name")}
          {field("rank", "Rank", "text", "e.g. Chief Officer")}{field("nationality", "Nationality")}
          {field("whatsapp", "WhatsApp", "tel", "+63 917 123 4567")}
          {field("vessel", "Vessel")}{field("available_from", "Available from", "date")}
          {field("date_of_birth", "Date of birth", "date")}{field("cdc_no", "CDC / Seaman book no.")}
          {field("passport_no", "Passport no.")}
        </div>
        <p className="text-xs text-muted-foreground">{cv ? "The original CV is saved in this crew member's company folder." : "Or fill the details by hand."} After saving, open the crew member to attach documents (CoC, passport, medical).</p>
        <Button onClick={submit} disabled={saving} className="w-full min-h-12 rounded-xl font-bold">{saving ? "Saving…" : "Save & create Crew ID"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function RecordDialog({ rec, company, onClose, onChanged }: { rec: Rec; company: string; onClose: () => void; onChanged: () => Promise<void> }) {
  const [r, setR] = useState<Rec>(rec); const [saving, setSaving] = useState(false); const [scan, setScan] = useState(false);
  const [docs, setDocs] = useState<{ name: string }[]>([]); const [upl, setUpl] = useState(false);
  const cvRef = useRef<HTMLInputElement>(null); const docRef = useRef<HTMLInputElement>(null);
  const locked = rec.status === "accepted";
  const folder = useMemo(() => null as string | null, []);
  const loadDocs = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const { data } = await supabase.storage.from("company-crew-docs").list(`${u.user.id}/${rec.id}`, { limit: 100 });
    setDocs((data || []).filter(d => d.name && !d.name.startsWith(".")));
  }, [rec.id]);
  useEffect(() => { void loadDocs(); }, [loadDocs, folder]);

  const set = (k: keyof Rec) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setR(s => ({ ...s, [k]: e.target.value }));
  const save = async (patch?: Partial<Rec>) => {
    const v = { ...r, ...patch };
    setSaving(true);
    const { error } = await supabase.from("company_crew_records" as any).update({
      first_name: v.first_name, last_name: v.last_name, rank: v.rank, nationality: v.nationality || null, email: v.email?.trim().toLowerCase() || null,
      whatsapp: v.whatsapp || null, date_of_birth: v.date_of_birth || null, vessel: v.vessel || null, available_from: v.available_from || null,
      cdc_no: v.cdc_no || null, passport_no: v.passport_no || null, notes: v.notes || null, sea_service: v.sea_service || [], certificates: v.certificates || [],
    } as any).eq("id", rec.id);
    setSaving(false);
    if (error) { toast.error(/duplicate|unique/i.test(error.message) ? "Another crew member in your list already uses this email or WhatsApp." : "Could not save."); return false; }
    toast.success("Saved"); await onChanged(); return true;
  };
  const scanCv = async (f?: File) => {
    if (!f) return; setScan(true);
    try {
      const body = isSpreadsheet(f) ? { mime_type: "text/spreadsheet", text_content: (await readXlsxCv(f)).text } : { file_base64: await toBase64(f), mime_type: f.type };
      const { data, error } = await supabase.functions.invoke("parse-cv-documents", { body });
      const d = (data as any)?.data;
      if (error || !d) throw new Error((data as any)?.error || "Could not read this CV.");
      const next: Partial<Rec> = {
        first_name: r.first_name || d.first_name || "", last_name: r.last_name || d.last_name || "", rank: r.rank || d.rank || "",
        nationality: r.nationality || d.nationality || null, email: r.email || (d.email ? String(d.email).toLowerCase() : null), whatsapp: r.whatsapp || d.phone || null,
        date_of_birth: r.date_of_birth || (/^\d{4}-\d{2}-\d{2}$/.test(d.date_of_birth || "") ? d.date_of_birth : null),
        cdc_no: r.cdc_no || d.cdc_no || null, passport_no: r.passport_no || d.passport_no || null,
        sea_service: Array.isArray(d.sea_service) && d.sea_service.length ? d.sea_service : r.sea_service,
        certificates: [...(r.certificates || []), ...(Array.isArray(d.certificates) ? d.certificates : []), ...(Array.isArray(d.medical) ? d.medical.map((m: any) => ({ name: m.cert_type || "Medical", expiry_date: m.expiry_date, issue_date: m.issue_date, issuing_authority: m.issuing_authority })) : [])]
          .filter((c, i, a) => c?.name && a.findIndex(x => (x.name || "").toLowerCase() === (c.name || "").toLowerCase() && (x.number || "") === (c.number || "")) === i),
      };
      setR(s => ({ ...s, ...next }));
      if (await save(next)) toast.success(`CV read: ${next.sea_service?.length || 0} sea service, ${next.certificates?.length || 0} certificates`);
    } catch (e: any) { toast.error(e?.message || "Could not read this CV."); }
    finally { setScan(false); if (cvRef.current) cvRef.current.value = ""; }
  };
  const uploadDocs = async (files: FileList | null) => {
    if (!files?.length) return; setUpl(true);
    const { data: u } = await supabase.auth.getUser();
    let ok = 0;
    for (const f of Array.from(files)) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} is larger than 20 MB`); continue; }
      const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const { error } = await supabase.storage.from("company-crew-docs").upload(`${u.user!.id}/${rec.id}/${Date.now()}_${safe}`, f, { upsert: false });
      if (!error) ok++; else toast.error(`Could not upload ${f.name}`);
    }
    setUpl(false); if (docRef.current) docRef.current.value = "";
    if (ok) toast.success(`${ok} document(s) attached`); void loadDocs();
  };
  const openDoc = async (name: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.storage.from("company-crew-docs").createSignedUrl(`${u.user!.id}/${rec.id}/${name}`, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank"); else toast.error("Could not open the document.");
  };
  const removeDoc = async (name: string) => {
    if (!confirm("Remove this document?")) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.storage.from("company-crew-docs").remove([`${u.user!.id}/${rec.id}/${name}`]); void loadDocs();
  };
  const pdf = async () => {
    try {
      const doc = await buildResumePdf({ personal: { firstName: r.first_name, lastName: r.last_name, first_name: r.first_name, last_name: r.last_name, rank: r.rank, nationality: r.nationality, dateOfBirth: r.date_of_birth, email: r.email, phone: r.whatsapp, cdcNo: r.cdc_no, passportNo: r.passport_no },
        sea: r.sea_service || [], certs: r.certificates || [], edu: [], training: [], skills: {}, photo: null, cvUid: r.live_crew_unique_id, declaration: null });
      doc.save(`${(r.first_name + "_" + r.last_name).replace(/\s+/g, "_")}_${r.live_crew_unique_id}_CV.pdf`);
    } catch { toast.error("PDF could not be created."); }
  };
  const del = async () => {
    if (!confirm("Delete this crew record? This cannot be undone.")) return;
    const { error } = await supabase.from("company_crew_records" as any).delete().eq("id", rec.id);
    if (error) { toast.error("Could not delete."); return; }
    toast.success("Deleted"); await onChanged(); onClose();
  };
  const field = (k: keyof Rec, label: string, type = "text") => <label className="text-xs text-muted-foreground">{label}<input type={type} value={(r[k] as string) || ""} onChange={set(k)} disabled={locked && (k === "email" || k === "whatsapp")} className={`${input} mt-1`} /></label>;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{`${r.first_name} ${r.last_name}`.trim()} <span className="font-mono text-sm text-primary">{r.live_crew_unique_id}</span></DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-400/40 text-emerald-400 px-2 py-0.5 flex items-center gap-1"><ShieldCheck size={11} /> Company Verified by {company}</span>
          <span className={`rounded-full border px-2 py-0.5 ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
          {r.accepted_at && <span className="text-muted-foreground">Accepted {new Date(r.accepted_at).toLocaleDateString()}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl border-primary text-primary" disabled={scan} onClick={() => cvRef.current?.click()}>{scan ? <Loader2 className="animate-spin" size={14} /> : <ScanLine size={14} />} {scan ? "Reading CV…" : "Scan CV with AI"}</Button>
          <Button variant="outline" className="rounded-xl border-primary text-primary" disabled={upl} onClick={() => docRef.current?.click()}><Paperclip size={14} /> {upl ? "Uploading…" : "Attach documents"}</Button>
          <Button variant="outline" className="rounded-xl border-primary text-primary" onClick={pdf}><FileDown size={14} /> Download CV (PDF)</Button>
          <input ref={cvRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx" className="hidden" onChange={e => scanCv(e.target.files?.[0])} />
          <input ref={docRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xlsx" className="hidden" onChange={e => uploadDocs(e.target.files)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("first_name", "First name")}{field("last_name", "Last name")}{field("rank", "Rank")}{field("nationality", "Nationality")}
          {field("whatsapp", "WhatsApp", "tel")}{field("email", "Email", "email")}{field("vessel", "Vessel")}{field("available_from", "Available from", "date")}
          {field("date_of_birth", "Date of birth", "date")}{field("cdc_no", "CDC / Seaman book no.")}{field("passport_no", "Passport no.")}
        </div>
        <label className="text-xs text-muted-foreground">Office notes<textarea value={r.notes || ""} onChange={set("notes")} rows={2} className={`${input} mt-1 py-2`} /></label>

        <section className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Certificates ({r.certificates?.length || 0})</p>
          {(r.certificates || []).map((c, i) => { const d = daysTo(c.expiry_date); return (
            <div key={i} className="flex items-center gap-2 text-xs border-b border-border py-1">
              <span className="flex-1 text-foreground">{c.name}{c.number ? ` · ${c.number}` : ""}</span>
              <span className={d !== null && d < 0 ? "text-destructive" : d !== null && d <= 90 ? "text-amber-400" : "text-muted-foreground"}>{c.expiry_date ? `Exp ${c.expiry_date}` : "No expiry"}</span>
              <button onClick={() => setR(s => ({ ...s, certificates: s.certificates.filter((_, j) => j !== i) }))} className="text-muted-foreground" aria-label="Remove certificate"><Trash2 size={12} /></button>
            </div>); })}
          <CertAdder onAdd={c => setR(s => ({ ...s, certificates: [...(s.certificates || []), c] }))} />
        </section>
        <section className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Sea service ({r.sea_service?.length || 0})</p>
          {(r.sea_service || []).slice(0, 30).map((s, i) => <p key={i} className="text-xs text-muted-foreground border-b border-border py-1">{s.vessel_name || s.vessel} · {s.rank} · {s.vessel_type} · {s.sign_on} → {s.sign_off}</p>)}
          {!r.sea_service?.length && <p className="text-xs text-muted-foreground">Use “Scan CV with AI” to fill sea service automatically.</p>}
        </section>
        <section className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Office documents ({docs.length})</p>
          {docs.map(d => <div key={d.name} className="flex items-center gap-2 text-xs"><button onClick={() => openDoc(d.name)} className="flex-1 text-left text-primary underline truncate">{d.name.replace(/^\d+_/, "")}</button><button onClick={() => removeDoc(d.name)} aria-label="Remove document"><Trash2 size={12} className="text-muted-foreground" /></button></div>)}
          <p className="text-[11px] text-muted-foreground">Documents stay private to your company.</p>
        </section>
        <div className="flex gap-2">
          <Button onClick={() => save()} disabled={saving} className="flex-1 min-h-12 rounded-xl font-bold">{saving ? "Saving…" : "Save changes"}</Button>
          {!locked && <Button variant="outline" onClick={del} className="rounded-xl border-destructive text-destructive min-h-12"><Trash2 size={14} /></Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CertAdder({ onAdd }: { onAdd: (c: { name: string; number: string; expiry_date: string }) => void }) {
  const [n, setN] = useState(""); const [no, setNo] = useState(""); const [ex, setEx] = useState("");
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <input value={n} onChange={e => setN(e.target.value)} placeholder="Certificate (e.g. CoC, GMDSS)" className={`${input} flex-1 min-w-[160px]`} />
      <input value={no} onChange={e => setNo(e.target.value)} placeholder="Number" className={`${input} w-32`} />
      <input type="date" value={ex} onChange={e => setEx(e.target.value)} className={`${input} w-40`} />
      <Button variant="outline" className="rounded-xl border-primary text-primary" onClick={() => { if (!n.trim()) return; onAdd({ name: n.trim(), number: no.trim(), expiry_date: ex }); setN(""); setNo(""); setEx(""); }}>Add</Button>
    </div>
  );
}

type BulkItem = { file: File; state: "wait" | "reading" | "ready" | "error" | "added" | "skipped"; row?: CrewImportRow; err?: string };
function BulkCvDialog({ onClose, importOne }: { onClose: () => void; importOne: (r: CrewImportRow, cv: File) => Promise<boolean> }) {
  const [items, setItems] = useState<BulkItem[]>([]); const [run, setRun] = useState(false); const inRef = useRef<HTMLInputElement>(null);
  const upd = (i: number, p: Partial<BulkItem>) => setItems(a => a.map((x, j) => j === i ? { ...x, ...p } : x));
  const add = async (files: FileList | File[] | null) => {
    const list = Array.from(files || []).slice(0, 20 - items.length);
    if (!list.length) return;
    const start = items.length;
    setItems(a => [...a, ...list.map(file => ({ file, state: "wait" as const }))]);
    for (let k = 0; k < list.length; k++) {
      upd(start + k, { state: "reading" });
      try { const row = await cvToCrewRow(list[k]); upd(start + k, row.first_name || row.last_name ? { state: "ready", row } : { state: "error", err: "No name found in this CV" }); }
      catch (e: any) { upd(start + k, { state: "error", err: e?.message || "Could not read" }); }
    }
    if (inRef.current) inRef.current.value = "";
  };
  const edit = (i: number, k: keyof CrewImportRow, v: string) => setItems(a => a.map((x, j) => j === i && x.row ? { ...x, row: { ...x.row, [k]: v } } : x));
  const ready = items.filter(x => x.state === "ready" && x.row?.rank?.trim());
  const go = async () => {
    setRun(true);
    for (let i = 0; i < items.length; i++) { const x = items[i]; if (x.state !== "ready" || !x.row?.rank?.trim()) continue; upd(i, { state: (await importOne(x.row, x.file)) ? "added" : "skipped" }); }
    setRun(false);
  };
  const reading = items.some(x => x.state === "reading" || x.state === "wait");
  const badge: Record<string, string> = { wait: "Waiting", reading: "Reading…", ready: "Ready", error: "Problem", added: "Added ✓", skipped: "Not added" };
  return (
    <Dialog open onOpenChange={o => !o && !run && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Bulk upload CVs</DialogTitle></DialogHeader>
        <button type="button" disabled={items.length >= 20 || run} onClick={() => inRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void add(e.dataTransfer.files); }}
          className="w-full rounded-xl border-2 border-dashed border-primary/50 p-5 text-center hover:bg-primary/5 disabled:opacity-50">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-primary"><Upload size={16} /> Choose or drop up to 20 CVs ({items.length}/20)</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, CSV, text or photos — AI reads each one, you check, then add all.</p>
        </button>
        <input ref={inRef} type="file" multiple accept={CV_ACCEPT} className="hidden" onChange={e => add(e.target.files)} />
        {items.length > 0 && <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{["CV file", "First name", "Last name", "Rank *", "WhatsApp", "Email", "Status"].map(h => <th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
            <tbody>{items.map((x, i) => <tr key={i} className="border-t border-border align-top">
              <td className="p-2 max-w-[140px] truncate" title={x.file.name}>{x.file.name}</td>
              {(["first_name", "last_name", "rank", "whatsapp", "email"] as const).map(k => <td key={k} className="p-1">{x.row && x.state === "ready"
                ? <input value={(x.row as any)[k] || ""} onChange={e => edit(i, k, e.target.value)} className={`w-full min-w-[90px] rounded-lg border bg-background px-2 py-1 text-foreground ${k === "rank" && !x.row.rank?.trim() ? "border-destructive" : "border-border"}`} />
                : <span className="text-muted-foreground">{(x.row as any)?.[k] || ""}</span>}</td>)}
              <td className="p-2 whitespace-nowrap"><span className={x.state === "error" || x.state === "skipped" ? "text-destructive" : x.state === "added" ? "text-emerald-400" : "text-primary"}>{badge[x.state]}</span>
                {x.err && <p className="text-[10px] text-muted-foreground">{x.err}</p>}
                {!run && x.state !== "added" && <button className="block text-[10px] text-muted-foreground underline" onClick={() => setItems(a => a.filter((_, j) => j !== i))}>remove</button>}</td>
            </tr>)}</tbody></table>
        </div>}
        <p className="text-xs text-muted-foreground">Crew already in your list (same email or WhatsApp) are not added twice. Each original CV is saved in that crew member's company folder.</p>
        <Button disabled={!ready.length || run || reading} onClick={go} className="w-full min-h-12 rounded-xl font-bold">
          {run ? <><Loader2 className="animate-spin" size={16} /> Adding crew…</> : reading ? "Reading CVs…" : `Add ${ready.length} crew & create Crew IDs`}
        </Button>
        {items.some(x => x.state === "added") && !run && <Button variant="outline" onClick={onClose} className="w-full rounded-xl">Done</Button>}
      </DialogContent>
    </Dialog>
  );
}
