// ShipManager Vacancy Studio — Intake → Review → Preflight.
// All publishing rules live in @/lib/managerVacancies (shared with Paste-to-Post).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { UploadCloud, Loader2, AlertTriangle, Plus, Trash2, ChevronDown, ChevronUp, FileText, Image as ImageIcon } from "lucide-react";
import {
  type PreviewVacancy, type ManagerIdentity, type Ownership, type DuplicateScan, type PublishResult,
  toPreviewVacancy, emptyPreviewVacancy, loadManagerIdentity, checkWhatsapp, isValidEmail,
  scanDuplicates, publishVacancyBatch, publishSummary, uploadOriginalFlier, validateJoiningDates,
  reconcileBatch, loadUncertainMarker,
  validateContactFormats, validateAttribution, ACCEPTED_FLIER_TYPES as ACCEPTED,
} from "@/lib/managerVacancies";
import { splitAdverts, MAX_PASTE_CHARS, MAX_ADVERT_CHARS } from "@/lib/advertSplitter";

const MAX_FLIERS = 5;
type Risk = "low" | "medium" | "high";
type Row = PreviewVacancy & { _key: string; selected: boolean; open: boolean };
type Source = {
  id: string;
  kind: "flier" | "text" | "manual";
  label: string;
  status: "reading" | "ready" | "error";
  error?: string;
  flierUrl: string | null;
  risk: { level: Risk; flags: string[] };
  ownership?: Ownership;
  rows: Row[];
  /** Set when the advert boundary was guessed; its vacancies start unselected. */
  boundary?: string;
};

const uid = () => crypto.randomUUID();
const toRisk = (l: unknown): Risk => (l === "high" || l === "medium" ? l : "low");
const mkRow = (v: PreviewVacancy, risk: Risk): Row => ({ ...v, _key: uid(), selected: risk !== "high", open: false });

const downscaleImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read that image"));
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        if (!ctx) { reject(new Error("Could not read that image")); return; }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

const parseError = (error: unknown) => {
  const status = (error as { context?: { status?: number } })?.context?.status;
  if (status === 403) return "Your company account is pending approval.";
  if (status === 429) return "Daily reading limit reached. Please try again tomorrow.";
  if (status === 401) return "Please sign in again.";
  return "Could not read this advert.";
};

const PostVacancy = () => {
  const [identity, setIdentity] = useState<ManagerIdentity | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [scan, setScan] = useState<DuplicateScan | null>(null);
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uncertain, setUncertain] = useState<{ batchId: string; expected: number; message: string } | null>(null);
  const [lastResult, setLastResult] = useState<PublishResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadManagerIdentity().then(setIdentity); }, []);
  // Restore an unresolved batch after refresh (minimal marker only).
  useEffect(() => {
    if (!identity) return;
    const m = loadUncertainMarker(identity.userId);
    if (m) setUncertain({ batchId: m.batchId, expected: m.expected, message: "An earlier publication was not confirmed. Re-check before publishing anything new." });
  }, [identity]);

  const fliersUsed = sources.filter((s) => s.kind === "flier").length;
  const patch = (id: string, fn: (s: Source) => Source) => { setScan(null); setSources((prev) => prev.map((s) => (s.id === id ? fn(s) : s))); };
  const patchRow = (sid: string, key: string, fn: (r: Row) => Row) => patch(sid, (s) => ({ ...s, rows: s.rows.map((r) => (r._key === key ? fn(r) : r)) }));

  const ready = (): boolean => {
    if (!identity?.userId) { toast({ title: "Please wait", description: "Loading your company account…", variant: "destructive" }); return false; }
    if (!identity.approved) { toast({ title: "Pending approval", description: "Your company account is pending approval.", variant: "destructive" }); return false; }
    return true;
  };

  const finishParse = (id: string, data: unknown, error: unknown) => {
    const res = data as { ok?: boolean; error?: string; vacancies?: Record<string, unknown>[]; risk?: { level?: string; flags?: string[] } } | null;
    if (error || !res?.ok) { patch(id, (s) => ({ ...s, status: "error", error: error ? parseError(error) : res?.error || "Could not read this advert." })); return; }
    const risk = { level: toRisk(res.risk?.level), flags: (res.risk?.flags || []).map(String) };
    const rows = (res.vacancies || []).map((v) => mkRow(toPreviewVacancy(v), risk.level));
    patch(id, (s) => ({ ...s, status: rows.length ? "ready" : "error", error: rows.length ? undefined : "No vacancies found in this advert.", risk, rows: s.boundary ? rows.map((r) => ({ ...r, selected: false })) : rows }));
  };

  const addFliers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !ready() || !identity) return;
    const room = MAX_FLIERS - fliersUsed;
    if (files.length > room) toast({ title: `Up to ${MAX_FLIERS} flyers per batch`, description: `Only the first ${Math.max(room, 0)} were added.`, variant: "destructive" });
    for (const file of files.slice(0, Math.max(room, 0))) {
      const id = uid();
      const base: Source = { id, kind: "flier", label: file.name, status: "reading", flierUrl: null, risk: { level: "low", flags: [] }, rows: [] };
      if (!ACCEPTED.includes(file.type.toLowerCase())) {
        setSources((p) => [...p, { ...base, status: "error", error: "Flyer must be a JPG, PNG or WEBP image." }]);
        continue;
      }
      setSources((p) => [...p, base]);
      try {
        const image_base64 = await downscaleImage(file);
        const up = await uploadOriginalFlier(file, identity.userId);
        if (!up.ok) { patch(id, (s) => ({ ...s, status: "error", error: `Original flyer could not be saved: ${"error" in up ? up.error : ""}` })); continue; }
        patch(id, (s) => ({ ...s, flierUrl: up.url }));
        const { data, error } = await supabase.functions.invoke("parse-vacancy-text", { body: { image_base64 } });
        finishParse(id, data, error);
      } catch (err) {
        patch(id, (s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Could not read this flyer." }));
      }
    }
  };

  const addText = async () => {
    if (!pasteText.trim() || !ready()) return;
    const blocks = splitAdverts(pasteText);
    const multi = blocks.length > 1;
    const queued = blocks.map((b, i) => ({
      b,
      src: {
        id: uid(), kind: "text" as const,
        label: `${multi ? `Advert ${i + 1}: ` : ""}${b.text.slice(0, 48)}${b.text.length > 48 ? "…" : ""}`,
        status: "reading" as const, flierUrl: null, risk: { level: "low" as Risk, flags: [] }, rows: [],
        boundary: b.uncertain ? b.reason : undefined,
      },
    }));
    setSources((p) => [...p, ...queued.map((q) => q.src)]);
    setPasteText("");
    // Each advert is read on its own so contacts never mix between adverts; 4 at a time.
    let next = 0;
    const worker = async () => {
      while (next < queued.length) {
        const { b, src } = queued[next++];
        try {
          const { data, error } = await supabase.functions.invoke("parse-vacancy-text", { body: { text: b.text.slice(0, MAX_ADVERT_CHARS) } });
          finishParse(src.id, data, error);
        } catch (err) {
          patch(src.id, (s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Could not read this advert." }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, queued.length) }, worker));
  };

  const addManual = () => {
    setScan(null);
    setSources((p) => [...p, { id: uid(), kind: "manual", label: "Typed manually", status: "ready", flierUrl: null, risk: { level: "low", flags: [] }, rows: [{ ...mkRow(emptyPreviewVacancy(), "low"), open: true }] }]);
  };

  // ---------- staged rows → engine rows ----------
  const selected = sources.flatMap((s) => (s.status === "ready" ? s.rows.filter((r) => r.selected).map((r) => ({ s, r })) : []));
  const unowned = [...new Set(selected.filter(({ s }) => !s.ownership).map(({ s }) => s.label))];
  const engineRows: PreviewVacancy[] = selected.map(({ s, r }) => {
    const { _key, selected: _sel, open: _o, ...v } = r;
    void _key; void _sel; void _o;
    return {
      ...v,
      source_id: s.id,
      source_type: s.kind === "flier" ? "flier" : s.kind === "text" ? "text" : "manual",
      flier_url: s.kind === "flier" ? s.flierUrl : null,
      ownership: s.ownership,
      risk_level: s.risk.level,
    };
  });
  const problems = identity ? [
    ...validateJoiningDates(engineRows).warnings,
    ...validateContactFormats(engineRows).warnings,
    ...validateAttribution(engineRows, identity.companyName).warnings,
    ...(engineRows.some((r) => r.source_type === "flier" && !r.flier_url) ? ["A flyer's original image is missing — remove it and upload again."] : []),
    ...(unowned.length ? [`Choose "Our vacancy" or "Third-party advert" for: ${unowned.join(", ")}`] : []),
  ] : [];

  const runCheck = async () => {
    if (!identity || !engineRows.length || problems.length) return;
    setChecking(true);
    try { setScan(await scanDuplicates(identity.userId, engineRows, identity.companyName)); }
    catch (e) { toast({ title: "Could not check duplicates", description: (e as Error)?.message || "Nothing was published. Try again.", variant: "destructive" }); }
    finally { setChecking(false); }
  };

  const applyResult = (res: PublishResult, rows: PreviewVacancy[]) => {
    setLastResult(res);
    if (res.status === "uncertain" && res.batchId) {
      const saved = identity ? loadUncertainMarker(identity.userId) : null;
      setUncertain({ batchId: res.batchId, expected: saved?.batchId === res.batchId ? saved.expected : rows.length, message: res.failures[0] || "Publication not confirmed." });
      return;
    }
    setUncertain(null);
    if (res.status === "published") {
      toast({ title: publishSummary(res), description: res.failures.join(" · ") || undefined });
      setSources([]); setScan(null);
      return;
    }
    if (res.failures.length) toast({ title: "Not published", description: res.failures.join(" · "), variant: "destructive" });
  };

  const publish = async () => {
    if (!identity || !scan || publishing || uncertain) return;
    setPublishing(true);
    try {
      const res = await publishVacancyBatch(scan.toPublish, identity, "manual", { skipDuplicateScan: true });
      res.requested = engineRows.length;
      res.duplicatesSkipped = scan.exactDuplicates.length + scan.intraBatchDuplicates.length;
      applyResult(res, scan.toPublish);
    } finally { setPublishing(false); }
  };

  // Re-check is READ-ONLY: it calls reconcileBatch() directly and never publishVacancyBatch().
  const recheck = async () => {
    if (!identity || !uncertain || publishing) return;
    setPublishing(true);
    try {
      const rec = await reconcileBatch(uncertain.batchId, identity.userId, uncertain.expected);
      if (rec.state === "complete") {
        setUncertain(null);
        toast({ title: rec.message });
        setSources([]); setScan(null);
      } else {
        setUncertain({ ...uncertain, message: rec.message });
      }
    } finally { setPublishing(false); }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder?: string, warn?: string | null) => (
    <label className="space-y-1 block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm h-11" />
      {warn && <span className="text-[11px] flex items-center gap-1 text-[#f59e0b]"><AlertTriangle size={12} /> {warn}</span>}
    </label>
  );

  const step = sources.length === 0 ? 1 : scan ? 3 : 2;

  const detected = pasteText.trim() ? splitAdverts(pasteText) : [];

  return (
    <div className="space-y-4 pt-3">
      <ol className="flex gap-2 text-[11px] sm:text-xs" aria-label="Studio steps">
        {["Add adverts", "Review vacancies", "Publish selected"].map((t, i) => (
          <li key={t} className={`flex-1 rounded-full px-3 py-1.5 text-center border ${step === i + 1 ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-border text-muted-foreground"}`}>{i + 1}. {t}</li>
        ))}
      </ol>

      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start">
      {/* ---------- Step 1: Intake ---------- */}
      <section className="rounded-xl bg-card border border-border p-4 space-y-3 lg:col-span-5 lg:sticky lg:top-4" aria-label="Add adverts">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">1. Add adverts</h3>
        <p className="text-[11px] text-muted-foreground">Publishing as <span className="text-foreground font-medium">{identity?.companyName || "—"}</span> (from your approved company profile).</p>

        <button
          type="button"
          onClick={() => fliersUsed < MAX_FLIERS && fileRef.current?.click()}
          disabled={fliersUsed >= MAX_FLIERS}
          className="w-full rounded-xl border-2 border-dashed border-[#D4AF37]/30 bg-secondary/40 flex flex-col items-center justify-center py-5 px-4 gap-1.5 disabled:opacity-50"
        >
          <UploadCloud size={26} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Upload recruitment flyers (JPG, PNG, WEBP)</span>
          <span className="text-[11px] text-muted-foreground">{fliersUsed} of {MAX_FLIERS} flyers · each flyer stays linked to its own vacancies</span>
        </button>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={addFliers} />

        <div className="space-y-2">
          <label htmlFor="studio-paste" className="text-[11px] text-muted-foreground block">
            Paste one or many adverts (WhatsApp / Telegram / email). Long Telegram / WhatsApp chat exports work too — each message and each contact block becomes its own advert. A <strong className="text-foreground">---</strong> line between adverts gives the most reliable split.
          </label>
          <textarea
            id="studio-paste" value={pasteText} onChange={(e) => setPasteText(e.target.value.slice(0, MAX_PASTE_CHARS))} rows={10} maxLength={MAX_PASTE_CHARS}
            className="w-full bg-background text-foreground text-sm rounded-xl px-3 py-2 border border-border outline-none focus:ring-1 focus:ring-primary"
            placeholder={"First advert…\n---\nSecond advert…\n---\nThird advert…"}
          />
          {detected.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {pasteText.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()} characters ·{" "}
              {detected.length} advert{detected.length === 1 ? "" : "s"} detected
              {detected.some((b) => b.uncertain) && <span className="text-[#f59e0b]"> · {detected.filter((b) => b.uncertain).length} need a boundary check</span>}
            </p>
          )}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2">
            <Button className="h-11 flex-1" onClick={addText} disabled={!pasteText.trim()}>
              <FileText size={14} className="mr-1" /> {detected.length > 1 ? `Read ${detected.length} adverts` : "Read this advert"}
            </Button>
            <Button variant="outline" className="h-11 flex-1" onClick={addManual}><Plus size={14} className="mr-1" /> Type a vacancy manually</Button>
          </div>
        </div>
      </section>

      <div className="space-y-4 lg:col-span-7">
      {/* ---------- Step 2: Review (grouped by source) ---------- */}
      {sources.length === 0 && !uncertain && (
        <p className="hidden lg:block rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Vacancies read from your adverts and flyers will appear here for review.</p>
      )}
      {sources.length > 0 && <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">2. Review vacancies</h3>}
      {sources.map((s) => (
        <section key={s.id} className={`rounded-xl bg-card border p-3 space-y-2 ${s.risk.level === "high" ? "border-[#f59e0b]/60" : "border-border"}`} aria-label={`Source ${s.label}`}>
          <div className="flex items-start gap-2">
            {s.kind === "flier" ? <ImageIcon size={16} className="text-[#D4AF37] mt-0.5" /> : <FileText size={16} className="text-[#D4AF37] mt-0.5" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{s.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {s.kind === "flier" ? "Flyer" : s.kind === "text" ? "Pasted advert" : "Manual entry"}
                {s.status === "ready" && ` · ${s.rows.length} vacanc${s.rows.length === 1 ? "y" : "ies"}`}
              </p>
            </div>
            {s.flierUrl && <a href={s.flierUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#D4AF37] underline">View flyer</a>}
            <button aria-label="Remove source" onClick={() => { setScan(null); setSources((p) => p.filter((x) => x.id !== s.id)); }} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
          </div>

          {s.boundary && (
            <p className="text-[11px] rounded-lg p-2 border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b] flex items-start gap-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Check advert boundary: {s.boundary} Its vacancies are not selected until you tick them.
            </p>
          )}
          {s.status === "reading" && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> AI is reading this advert…</p>}
          {s.status === "error" && <p className="text-xs text-[#f59e0b] flex items-center gap-1"><AlertTriangle size={12} /> {s.error}</p>}

          {s.status === "ready" && (
            <>
              <div role="radiogroup" aria-label="Who is recruiting?" className="grid grid-cols-2 gap-2">
                {([["own", "Our vacancy", "Applicants come to your company"], ["third_party", "Third-party advert", "Applicants go to the agency's contacts"]] as [Ownership, string, string][]).map(([v, t, d]) => (
                  <button key={v} role="radio" aria-checked={s.ownership === v} onClick={() => patch(s.id, (x) => ({ ...x, ownership: v }))}
                    className={`rounded-xl border px-3 py-2 text-left min-h-[48px] ${s.ownership === v ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-border"}`}>
                    <span className={`block text-xs font-semibold ${s.ownership === v ? "text-[#D4AF37]" : "text-foreground"}`}>{t}</span>
                    <span className="block text-[10px] text-muted-foreground">{d}</span>
                  </button>
                ))}
              </div>
              {!s.ownership && <p className="text-[11px] text-[#f59e0b]">Please confirm who is recruiting for this advert.</p>}

              {s.risk.level !== "low" && (
                <div className="rounded-lg p-2 text-[11px] border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]">
                  <strong>Risk: {s.risk.level}.</strong> {s.risk.level === "high" && "These vacancies are not selected. Review the warning and tick each one deliberately to publish."}
                  {s.risk.flags.length > 0 && <ul className="mt-1 list-disc pl-4">{s.risk.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
                </div>
              )}

              <ul className="space-y-1.5">
                {s.rows.map((r) => {
                  const wa = checkWhatsapp(r.contact_whatsapp);
                  const emailOk = isValidEmail(r.contact_email);
                  const missingContact = s.ownership === "third_party" && !r.contact_whatsapp && !r.contact_email;
                  const tag = !wa.ok || !emailOk ? "Check contact" : missingContact ? "Missing contact" : s.risk.level === "high" ? "High risk" : "Ready";
                  const set = (k: keyof PreviewVacancy) => (x: string) => patchRow(s.id, r._key, (o) => (k === "positions" ? { ...o, positions: Math.max(parseInt(x.replace(/\D/g, ""), 10) || 1, 1) } : { ...o, [k]: x }));
                  return (
                    <li key={r._key} className="rounded-lg border border-border/60 bg-secondary/40">
                      <div className="flex items-center gap-2 px-2 py-2">
                        <input type="checkbox" className="h-5 w-5" checked={r.selected} aria-label={`Select ${r.rank_required || "vacancy"}`}
                          onChange={() => patchRow(s.id, r._key, (o) => ({ ...o, selected: !o.selected }))} />
                        <button className="flex-1 min-w-0 text-left min-h-[40px]" onClick={() => patchRow(s.id, r._key, (o) => ({ ...o, open: !o.open }))}>
                          <span className="block text-sm font-medium text-foreground truncate">{r.rank_required || "Rank not set"} · {r.vessel_type || "Vessel not set"}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">{r.positions} pos · {r.joining_date || "date not stated"} · {r.monthly_salary || "salary not stated"}</span>
                        </button>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${tag === "Ready" ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-[#f59e0b]/15 text-[#f59e0b]"}`}>{tag}</span>
                        {r.open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </div>
                      {r.open && (
                        <div className="px-2 pb-3 space-y-2">
                          {s.ownership === "third_party" ? (
                            <>
                              {field("Recruiting agency", r.recruiter_name, set("recruiter_name"), "As printed on the advert")}
                              <p className="text-[10px] text-muted-foreground">Recruiter: Extracted from advert — not independently verified.</p>
                            </>
                          ) : s.ownership === "own" ? (
                            <p className="text-[11px] text-muted-foreground">Recruiter: {identity?.companyName} (your approved company)</p>
                          ) : null}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {field("Rank", r.rank_required, set("rank_required"), "e.g. Chief Officer")}
                            {field("Vessel", r.vessel_type, set("vessel_type"), "e.g. Bulk Carrier")}
                            {field("Positions", String(r.positions), set("positions"))}
                            {field("Joining port", r.joining_port, set("joining_port"))}
                            {field("Joining date", r.joining_date, set("joining_date"), "YYYY-MM-DD")}
                            {field("Contract", r.contract_duration, set("contract_duration"), "e.g. 6 months")}
                            {field("Salary", r.monthly_salary, set("monthly_salary"), "Not stated")}
                            {field("Email", r.contact_email, set("contact_email"), "", emailOk ? null : "Email address is not valid.")}
                            {field("WhatsApp", r.contact_whatsapp, set("contact_whatsapp"), "+6512345678", wa.warning)}
                          </div>
                          <label className="space-y-1 block">
                            <span className="text-[11px] text-muted-foreground">Notes</span>
                            <textarea value={r.additional_notes} onChange={(e) => set("additional_notes")(e.target.value)} rows={2}
                              className="w-full bg-background text-foreground text-sm rounded-xl px-3 py-2 border border-border outline-none resize-none" />
                          </label>
                          <button className="text-[11px] text-red-400 underline" onClick={() => patch(s.id, (x) => ({ ...x, rows: x.rows.filter((o) => o._key !== r._key) }))}>Remove this vacancy</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ))}

      {/* ---------- Step 3: Preflight ---------- */}
      {/* Shown whenever a batch is unresolved — even after refresh with no adverts in memory. */}
      {(sources.length > 0 || uncertain) && (
        <section className="rounded-xl border border-[#D4AF37]/30 bg-[#0D1B2A] p-4 space-y-2 sticky bottom-2" aria-label="Publish readiness">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">3. Publish selected</h3>
          {sources.length > 0 && <p className="text-sm font-semibold text-[#D4AF37]">{engineRows.length} vacanc{engineRows.length === 1 ? "y" : "ies"} selected</p>}
          <p className="text-[11px] text-muted-foreground">Vacancies stay live until you mark them filled or archive them. Duplicate check covers your company's active listings only.</p>
          {problems.length > 0 && (
            <ul className="text-[11px] text-[#f59e0b] list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          )}

          {uncertain ? (
            <div className="rounded-lg border border-[#f59e0b]/50 bg-[#f59e0b]/10 p-3 space-y-2" role="alert">
              <p className="text-xs font-semibold text-[#f59e0b]">Publication not confirmed</p>
              <p className="text-[11px] text-foreground">{uncertain.message}</p>
              <p className="text-[11px] text-muted-foreground">The original request may still finish. We will only check this same batch — nothing is sent again.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button className="h-11 flex-1" onClick={recheck} disabled={publishing}>{publishing ? "Checking…" : "Re-check database"}</Button>
                <Button asChild variant="outline" className="h-11 flex-1"><Link to="/manager/dashboard?tab=applicants">Open My Posts</Link></Button>
              </div>
            </div>
          ) : scan ? (
            <div className="space-y-2">
              <ul className="text-[11px] text-foreground space-y-0.5">
                <li>Ready to publish: <strong>{scan.toPublish.length}</strong></li>
                {scan.exactDuplicates.length > 0 && <li>Exact duplicates of your active listings (skipped): {scan.exactDuplicates.length}</li>}
                {scan.intraBatchDuplicates.length > 0 && <li>Repeated in this batch (first kept): {scan.intraBatchDuplicates.length}</li>}
                {scan.similar.length > 0 && <li className="text-[#f59e0b]">Similar active listings found: {scan.similar.length} — kept as separate vacancies.</li>}
              </ul>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="h-11 flex-1" onClick={() => setScan(null)}>Back to review</Button>
                <Button className="h-11 flex-1" onClick={publish} disabled={publishing || scan.toPublish.length === 0}>
                  {publishing ? "Publishing…" : `Publish ${scan.toPublish.length} →`}
                </Button>
              </div>
            </div>
          ) : (
            <Button className="w-full h-11" onClick={runCheck} disabled={checking || !engineRows.length || problems.length > 0 || !identity?.approved || sources.some((s) => s.status === "reading")}>
              {checking ? "Checking…" : "Check & continue →"}
            </Button>
          )}
          {lastResult?.status === "published" && <p className="text-[11px] text-[#22c55e]">{publishSummary(lastResult)}</p>}
        </section>
      )}
      </div>
      </div>
    </div>
  );
};

export default PostVacancy;
