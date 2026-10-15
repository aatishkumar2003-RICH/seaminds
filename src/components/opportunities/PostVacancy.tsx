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
  reconcileBatch, loadUncertainMarker, splitVesselTypes,
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
  /** Original pasted advert text, kept so a failed read can be retried without re-pasting. */
  text?: string;
  /** Rows before "Expand by vessel type", kept so the manager can undo. */
  collapsed?: Row[];
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
  if (status === 429) return "Too many adverts at once — wait a few minutes, then retry this one.";
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
        boundary: b.uncertain ? b.reason : undefined, text: b.text,
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

  const retryText = async (s: Source) => {
    if (!s.text || !ready()) return;
    patch(s.id, (x) => ({ ...x, status: "reading", error: undefined }));
    try {
      const { data, error } = await supabase.functions.invoke("parse-vacancy-text", { body: { text: s.text.slice(0, MAX_ADVERT_CHARS) } });
      finishParse(s.id, data, error);
    } catch (err) {
      patch(s.id, (x) => ({ ...x, status: "error", error: err instanceof Error ? err.message : "Could not read this advert." }));
    }
  };

  const addManual = () => {
    setScan(null);
    setSources((p) => [...p, { id: uid(), kind: "manual", label: "Typed manually", status: "ready", flierUrl: null, risk: { level: "low", flags: [] }, rows: [{ ...mkRow(emptyPreviewVacancy(), "low"), open: true }] }]);
  };

  // ---------- staged rows → engine rows ----------
  // ---------- batch contact intelligence (derived; toggle off reverts) ----------
  const contactCandidates = (() => {
    const m = new Map<string, { key: string; name: string; email: string; whatsapp: string; count: number }>();
    for (const s of sources) if (s.status === "ready") for (const r of s.rows) {
      const email = (r.contact_email || "").trim().toLowerCase();
      const whatsapp = (r.contact_whatsapp || "").replace(/[^\d+]/g, "");
      if (!email && !whatsapp) continue;
      const key = `${email}|${whatsapp}`;
      const c = m.get(key) || { key, name: r.recruiter_name || "", email, whatsapp, count: 0 };
      c.count++; if (!c.name && r.recruiter_name) c.name = r.recruiter_name;
      m.set(key, c);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  })();
  const [fillKey, setFillKey] = useState<string | null>(null);
  // Until the manager touches the toggle: ON when one recruiter is found, OFF when several (avoids mixing agencies).
  const [autoPicked, setAutoPicked] = useState(false);
  const singleKey = contactCandidates.length === 1 ? contactCandidates[0].key : null;
  useEffect(() => {
    if (!autoPicked) { if (fillKey !== singleKey) setFillKey(singleKey); return; }
    if (fillKey && !contactCandidates.some((c) => c.key === fillKey)) setFillKey(null);
  }, [contactCandidates, fillKey, autoPicked, singleKey]);
  const chooseFill = (k: string | null) => { setScan(null); setAutoPicked(true); setFillKey(k); };
  const fill = contactCandidates.find((c) => c.key === fillKey) || null;
  const [batchCc, setBatchCc] = useState("+62");
  const [batchAgency, setBatchAgency] = useState("");
  const [view, setView] = useState<"all" | "ready" | "fix">("all");
  const isPlaceholder = (v?: string) => /^(null|undefined|none|n\/?a|nil|-+)$/i.test((v || "").trim());
  const blank = (v?: string) => !v?.trim() || isPlaceholder(v);
  const needsContact = (r: Row) => blank(r.contact_email) && blank(r.contact_whatsapp);
  const digitsOf = (w?: string) => (w || "").replace(/\D/g, "").replace(/^00/, "");
  const withCc = (w: string) => {
    const c = w.replace(/[\s()\-.]/g, "");
    if (!c || c.startsWith("+") || c.startsWith("00") || !batchCc) return w;
    return /^0\d{6,14}$/.test(c) ? `${batchCc}${c.slice(1)}` : w;
  };
  const effective = (r: Row): Row => {
    let o: Row = { ...r, contact_email: blank(r.contact_email) ? "" : r.contact_email, contact_whatsapp: blank(r.contact_whatsapp) ? "" : r.contact_whatsapp };
    if (fill && needsContact(o)) {
      o = { ...o, contact_email: fill.email, contact_whatsapp: fill.whatsapp, recruiter_name: o.recruiter_name || fill.name };
    } else {
      // Same group: one channel matches a detected recruiter → complete the missing channel and name from that group.
      const em = (o.contact_email || "").trim().toLowerCase();
      const wd = digitsOf(o.contact_whatsapp);
      const g = contactCandidates.find((c) => (em && c.email === em) || (wd.length >= 7 && digitsOf(c.whatsapp) === wd));
      if (g) o = { ...o, contact_email: o.contact_email || g.email, contact_whatsapp: o.contact_whatsapp || g.whatsapp, recruiter_name: o.recruiter_name || g.name };
    }
    const w = withCc(o.contact_whatsapp || "");
    if (w !== (o.contact_whatsapp || "")) o = { ...o, contact_whatsapp: w };
    // Either a valid email or a valid WhatsApp is enough: the unusable other channel is dropped.
    const idLandline = /^\+?62[2-7]/.test((o.contact_whatsapp || "").replace(/[^\d+]/g, "")); // Indonesian office landline, not WhatsApp
    const waOk = !!o.contact_whatsapp && !idLandline && checkWhatsapp(o.contact_whatsapp).ok;
    const emOk = !!o.contact_email && isValidEmail(o.contact_email);
    if (!waOk && emOk) o = { ...o, contact_whatsapp: "" };
    if (!emOk && waOk) o = { ...o, contact_email: "" };
    if (!o.recruiter_name?.trim() && batchAgency.trim()) o = { ...o, recruiter_name: batchAgency.trim() };
    return o;
  };
  const missingCount = sources.reduce((n, s) => n + (s.status === "ready" ? s.rows.filter((r) => r.selected && needsContact(r)).length : 0), 0);

  const resetStudio = () => {
    if (sources.length && !window.confirm(`Discard all ${sources.length} staged source(s) and start fresh?`)) return;
    setSources([]); setScan(null); setFillKey(null); setAutoPicked(false);
  };
  const setAllOwnership = (o: Ownership) => { setScan(null); setSources((p) => p.map((s) => (s.status === "ready" ? { ...s, ownership: o } : s))); };

  const toEngine = (s: Source, r: Row): PreviewVacancy => {
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
  };
  /** First reason this vacancy cannot be published yet, or null when it is ready. */
  const rowIssue = (s: Source, er: Row): string | null => {
    if (!identity) return "Loading account…";
    if (!s.ownership) return `Choose "Our vacancy" or "Third-party advert"`;
    const v = [toEngine(s, er)];
    if (s.kind === "flier" && !s.flierUrl) return "Flyer image missing — upload again";
    if (s.ownership === "third_party" && !er.contact_email?.trim() && !er.contact_whatsapp?.trim()) return "Needs an email or WhatsApp";
    return validateContactFormats(v).warnings[0] || validateJoiningDates(v).warnings[0] || validateAttribution(v, identity.companyName).warnings[0] || null;
  };
  const allRows = sources.flatMap((s) => (s.status === "ready" ? s.rows.map((r) => ({ s, r })) : []));
  const readyRows = allRows.filter(({ s, r }) => !rowIssue(s, effective(r)));
  const selectWhere = (on: boolean) => {
    setScan(null);
    setSources((p) => p.map((s) => (s.status !== "ready" ? s : { ...s, rows: s.rows.map((r) => ({ ...r, selected: on ? !rowIssue(s, effective(r)) : false })) })));
  };
  // Valid vacancies publish now; the rest stay in the studio to fix or remove.
  const selected = sources.flatMap((s) => (s.status === "ready" ? s.rows.filter((r) => r.selected).map((r) => ({ s, r, er: effective(r) })) : []));
  const validSel = selected.filter(({ s, er }) => !rowIssue(s, er));
  const heldCount = selected.length - validSel.length;
  const engineRows: PreviewVacancy[] = validSel.map(({ s, er }) => toEngine(s, er));
  const problems: string[] = [];

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
      toast({ title: publishSummary(res), description: [heldCount ? `${heldCount} vacanc${heldCount === 1 ? "y" : "ies"} still need attention below.` : "", ...res.failures].filter(Boolean).join(" · ") || undefined });
      dropPublished();
      return;
    }
    if (res.failures.length) toast({ title: "Not published", description: res.failures.join(" · "), variant: "destructive" });
  };

  // Remove only the vacancies that were sent; vacancies needing attention stay for the manager.
  const sentKeys = useRef<Set<string>>(new Set());
  const dropPublished = () => {
    const keys = sentKeys.current;
    setScan(null);
    setSources((p) => p.map((s) => (s.status === "ready" ? { ...s, rows: s.rows.filter((r) => !keys.has(r._key)) } : s)).filter((s) => s.status !== "ready" || s.rows.length > 0));
  };

  const publish = async () => {
    if (!identity || !scan || publishing || uncertain) return;
    sentKeys.current = new Set(validSel.map(({ r }) => r._key));
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
        dropPublished();
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">1. Add adverts</h3>
          {sources.length > 0 && (
            <button onClick={resetStudio} className="rounded-lg border border-[#D4AF37]/40 px-2.5 py-1.5 text-[11px] text-[#D4AF37] hover:bg-[#D4AF37]/10">↺ Reset studio</button>
          )}
        </div>
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
      {sources.some((s) => s.status === "ready") && (
        <section className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 p-3 space-y-3" aria-label="Batch settings">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]">Who is recruiting? (all adverts)</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {([["own", "Our vacancy"], ["third_party", "Third-party advert"]] as [Ownership, string][]).map(([v, t]) => {
                const on = sources.every((s) => s.status !== "ready" || s.ownership === v);
                return (
                  <button key={v} onClick={() => setAllOwnership(v)} className={`rounded-xl border px-3 py-2 text-xs font-semibold min-h-[44px] ${on ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]" : "border-border text-foreground"}`}>{t}</button>
                );
              })}
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]">AI-detected contact for this batch</p>
            {contactCandidates.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">No email or WhatsApp found in any advert yet. Add the agency's flyer to this batch, or type the contact into one vacancy — it will appear here.</p>
            ) : (
              <>
                <div className="mt-1.5 space-y-1.5" role="radiogroup" aria-label="Batch contact">
                  {contactCandidates.slice(0, 4).map((c) => (
                    <button key={c.key} role="radio" aria-checked={fillKey === c.key} onClick={() => chooseFill(fillKey === c.key ? null : c.key)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${fillKey === c.key ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-border"}`}>
                      <span className="block text-xs font-semibold text-foreground truncate">{c.name || "Recruiter (name not stated)"} <span className="font-normal text-muted-foreground">· found in {c.count} vacanc{c.count === 1 ? "y" : "ies"}</span></span>
                      <span className="block text-[11px] text-muted-foreground truncate">{[c.email, c.whatsapp].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                  <span className="text-[11px] text-foreground">Fill vacancies with no contact using the selected recruiter</span>
                  <input type="checkbox" className="h-5 w-5 accent-[#D4AF37]" checked={!!fill} onChange={() => chooseFill(fill ? null : contactCandidates[0].key)} />
                </label>
                {!autoPicked && contactCandidates.length > 1 && (
                  <p className="mt-1 text-[10px] text-[#f59e0b]">Several recruiters found — fill is off so agencies don't get mixed. Turn it on if all adverts are from one company.</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {fill ? "Only vacancies with no email and no WhatsApp are filled; contacts already in an advert are never changed." : `${missingCount} selected vacanc${missingCount === 1 ? "y has" : "ies have"} no contact.`} Extracted from advert — not independently verified.
                </p>
              </>
            )}
          </div>
          <div className="border-t border-border pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]">WhatsApp country code (all adverts)</span>
              <select value={batchCc} onChange={(e) => { setScan(null); setBatchCc(e.target.value); }}
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                {[["+62", "🇮🇩 Indonesia +62"], ["+91", "🇮🇳 India +91"], ["+63", "🇵🇭 Philippines +63"], ["+84", "🇻🇳 Vietnam +84"], ["+60", "🇲🇾 Malaysia +60"], ["+65", "🇸🇬 Singapore +65"], ["+971", "🇦🇪 UAE +971"], ["+380", "🇺🇦 Ukraine +380"], ["+7", "🇷🇺 Russia +7"], ["+86", "🇨🇳 China +86"], ["+880", "🇧🇩 Bangladesh +880"], ["+94", "🇱🇰 Sri Lanka +94"], ["+44", "🇬🇧 UK +44"], ["", "Don't add a code"]].map(([v, t]) => <option key={t} value={v}>{t}</option>)}
              </select>
              <span className="block text-[10px] text-muted-foreground">Local numbers like 0813… become {batchCc || "+XX"}813…</span>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]">Recruiting company (all adverts)</span>
              <Input value={batchAgency} onChange={(e) => { setScan(null); setBatchAgency(e.target.value); }} placeholder="e.g. PT. Diva Marina Indonesia" className="h-11 text-sm" />
              <span className="block text-[10px] text-muted-foreground">Used only where an advert has no company name. Optional for your own vacancies.</span>
            </label>
            <p className="sm:col-span-2 text-[10px] text-muted-foreground">An email or a WhatsApp number is enough to publish — all other details are optional.</p>
          </div>
        </section>
      )}
      {sources.some((s) => s.status === "ready") && (
        <section className="rounded-xl border border-border bg-card p-3 space-y-2" aria-label="Quick select">
          <div className="grid grid-cols-3 gap-2">
            {([["all", `All (${allRows.length})`], ["ready", `Ready (${readyRows.length})`], ["fix", `Needs fix (${allRows.length - readyRows.length})`]] as ["all" | "ready" | "fix", string][]).map(([v, t]) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-lg border px-2 py-2 text-[11px] font-semibold min-h-[40px] ${view === v ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]" : "border-border text-foreground"}`}>{t}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button className="h-10 flex-1" onClick={() => selectWhere(true)} disabled={!readyRows.length}>✓ Select all ready ({readyRows.length})</Button>
            <Button variant="outline" className="h-10 flex-1" onClick={() => selectWhere(false)}>Clear selection</Button>
          </div>
        </section>
      )}
      {sources.filter((s) => view === "all" || s.status !== "ready" || s.rows.some((r) => (view === "ready") === !rowIssue(s, effective(r)))).map((s) => (
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
            <button aria-label={s.kind === "flier" ? "Discard flyer" : "Discard advert"} onClick={() => { setScan(null); setSources((p) => p.filter((x) => x.id !== s.id)); }} className="flex items-center gap-1 rounded-lg border border-destructive/40 px-2 py-1.5 text-[11px] text-destructive hover:bg-destructive/10"><Trash2 size={12} /> Discard</button>
          </div>

          {s.status === "ready" && (s.collapsed || s.rows.some((r) => splitVesselTypes(r.vessel_type).length > 1)) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-2 text-[11px]">
              {s.collapsed ? (
                <>
                  <span className="text-muted-foreground flex-1">Split into one vacancy per vessel type.</span>
                  <button onClick={() => patch(s.id, (x) => ({ ...x, rows: x.collapsed!, collapsed: undefined }))} className="rounded-lg border border-[#D4AF37] px-2 py-1 font-semibold text-[#D4AF37]">Undo expansion</button>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground flex-1">Some vacancies list several vessel types.</span>
                  <button onClick={() => patch(s.id, (x) => ({ ...x, collapsed: x.rows, rows: x.rows.flatMap((r) => { const vs = splitVesselTypes(r.vessel_type); return vs.length > 1 ? vs.map((v) => ({ ...r, vessel_type: v, _key: uid(), open: false })) : [r]; }) }))} className="rounded-lg bg-[#D4AF37] px-2 py-1 font-bold text-[#0D1B2A]">Expand by vessel type</button>
                </>
              )}
            </div>
          )}
          {s.boundary && (
            <p className="text-[11px] rounded-lg p-2 border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b] flex items-start gap-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Check advert boundary: {s.boundary} Its vacancies are not selected until you tick them.
            </p>
          )}
          {s.status === "reading" && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> AI is reading this advert…</p>}
          {s.status === "error" && (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-[#f59e0b] flex items-center gap-1"><AlertTriangle size={12} /> {s.error}</p>
              {s.kind === "text" && s.text && (
                <button onClick={() => retryText(s)} className="rounded-lg border border-[#D4AF37] px-2 py-1.5 text-[11px] font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10">Retry reading</button>
              )}
            </div>
          )}

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
                {s.rows.filter((r) => view === "all" || (view === "ready") === !rowIssue(s, effective(r))).map((r) => {
                  const er = effective(r);
                  const inherited = er.contact_email !== r.contact_email || er.contact_whatsapp !== r.contact_whatsapp;
                  const wa = checkWhatsapp(er.contact_whatsapp);
                  const emailOk = isValidEmail(er.contact_email);
                  const missingContact = s.ownership === "third_party" && !er.contact_whatsapp && !er.contact_email;
                  const issue = rowIssue(s, er);
                  const tag = !wa.ok || !emailOk ? "Check contact" : missingContact ? "Missing contact" : issue ? "Needs fix" : s.risk.level === "high" ? "High risk" : inherited ? "Batch contact" : "Ready";
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
                          {issue && <p className="text-[11px] text-[#f59e0b] flex items-center gap-1"><AlertTriangle size={12} /> {issue}</p>}
                          {s.ownership === "third_party" ? (
                            <>
                              {field("Recruiting agency (optional)", r.recruiter_name, set("recruiter_name"), "Leave blank if not disclosed")}
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
          {sources.length > 0 && <p className="text-sm font-semibold text-[#D4AF37]">{engineRows.length} ready to publish{heldCount > 0 && <span className="text-[#f59e0b] font-normal"> · {heldCount} need attention (stay here to fix or remove)</span>}</p>}
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
              {checking ? "Checking…" : heldCount > 0 ? `Check & publish ${engineRows.length} ready →` : "Check & continue →"}
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
