import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { UploadCloud, CheckCircle, Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  type PreviewVacancy,
  type SimilarVacancy,
  type ManagerIdentity,
  toPreviewVacancy,
  emptyPreviewVacancy,
  loadManagerIdentity,
  checkWhatsapp,
  scanDuplicates,
  publishVacancyBatch,
  publishSummary,
} from "@/lib/managerVacancies";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const PostVacancy = () => {
  const [identity, setIdentity] = useState<ManagerIdentity | null>(null);
  const [previews, setPreviews] = useState<PreviewVacancy[]>([]);
  const [risk, setRisk] = useState<{ level: string; flags: string[] } | null>(null);
  const [aiReading, setAiReading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [aiSuccess, setAiSuccess] = useState(false);
  const [sourceType, setSourceType] = useState<"flier" | "manual">("manual");
  const [publishing, setPublishing] = useState(false);
  const [similar, setSimilar] = useState<SimilarVacancy[] | null>(null);
  const [pendingRows, setPendingRows] = useState<PreviewVacancy[] | null>(null);
  const [pendingSkipped, setPendingSkipped] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadManagerIdentity().then(setIdentity); }, []);

  const primaryEmail = previews.find((p) => p.contact_email)?.contact_email || "";
  const primaryWhatsapp = previews.find((p) => p.contact_whatsapp)?.contact_whatsapp || "";
  const blockingRows = previews
    .map((p, i) => ({ i, p, check: checkWhatsapp(p.contact_whatsapp) }))
    .filter((r) => !r.check.ok);
  const publishBlocked = blockingRows.length > 0;

  const downscaleImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that image"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read that image"));
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Could not read that image")); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type.toLowerCase())) {
      toast({ title: "Unsupported file", description: "Please upload a JPG, PNG or WEBP image.", variant: "destructive" });
      return;
    }

    setUploadedFileName(file.name);
    setAiReading(true);
    setAiSuccess(false);
    try {
      const image_base64 = await downscaleImage(file);
      const { data, error } = await supabase.functions.invoke("parse-vacancy-text", { body: { image_base64 } });
      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 403) toast({ title: "Pending approval", description: "Your company account is pending approval.", variant: "destructive" });
        else if (status === 429) toast({ title: "Daily limit reached", description: "Please try again tomorrow.", variant: "destructive" });
        else if (status === 401) toast({ title: "Please sign in again", variant: "destructive" });
        else toast({ title: "Could not read that flier", variant: "destructive" });
        return;
      }
      const res = data as { ok?: boolean; error?: string; vacancies?: Record<string, unknown>[]; risk?: { level: string; flags: string[] } };
      if (!res?.ok) {
        toast({ title: "Could not read that flier", description: res?.error || undefined, variant: "destructive" });
        return;
      }
      const list = (res.vacancies || []).map(toPreviewVacancy);
      setPreviews(list);
      setRisk(res.risk || null);
      setSourceType("flier");
      setAiSuccess(true);
      toast({ title: `AI found ${list.length} ${list.length === 1 ? "vacancy" : "vacancies"}`, description: "Review and edit before publishing." });
    } catch (err) {
      toast({ title: "Could not read that flier", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setAiReading(false);
    }
  };

  const update = (i: number, key: keyof PreviewVacancy, value: string) => {
    setPreviews((prev) => prev.map((p, idx) => {
      if (idx !== i) return p;
      if (key === "positions") {
        const n = parseInt(value.replace(/[^0-9]/g, ""), 10);
        return { ...p, positions: Number.isFinite(n) && n >= 1 ? n : 1 };
      }
      return { ...p, [key]: value };
    }));
  };

  const removeRow = (i: number) => setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => { setPreviews((prev) => [...prev, emptyPreviewVacancy()]); if (previews.length === 0) setSourceType("manual"); };

  const reset = () => {
    setPreviews([]); setRisk(null); setAiSuccess(false); setUploadedFileName("");
    setSimilar(null); setPendingRows(null); setPendingSkipped(0);
  };

  const runPublish = async (rows: PreviewVacancy[], skipped: number) => {
    if (!identity) return;
    setPublishing(true);
    try {
      const result = await publishVacancyBatch(rows, identity, sourceType, { skipDuplicateScan: true });
      result.requested = previews.length;
      result.duplicatesSkipped = skipped;
      if (result.failures.length > 0) {
        toast({ title: "Publish failed", description: result.failures.join(" · "), variant: "destructive" });
        return;
      }
      toast({ title: publishSummary(result) });
      reset();
    } finally {
      setPublishing(false);
      setSimilar(null); setPendingRows(null);
    }
  };

  const handlePublish = async () => {
    if (!identity?.approved) {
      toast({ title: "Pending approval", description: "Only approved company accounts can publish vacancies.", variant: "destructive" });
      return;
    }
    if (previews.length === 0) return;
    if (publishBlocked) {
      toast({ title: "Country code required", description: "Fix or clear the WhatsApp number before publishing.", variant: "destructive" });
      return;
    }
    setPublishing(true);
    const scan = await scanDuplicates(identity.userId, previews);
    setPublishing(false);

    if (scan.toPublish.length === 0) {
      toast({ title: `0 of ${previews.length} published · ${scan.exactDuplicates.length} exact duplicates skipped` });
      return;
    }
    if (scan.similar.length > 0) {
      setPendingRows(scan.toPublish);
      setPendingSkipped(scan.exactDuplicates.length);
      setSimilar(scan.similar);
      return;
    }
    await runPublish(scan.toPublish, scan.exactDuplicates.length);
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    </div>
  );

  return (
    <div className="space-y-4 pt-3">
      <div className="rounded-xl bg-card border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Post Vacancies</h3>

        {/* Flier Upload */}
        <div
          onClick={() => !aiReading && fileInputRef.current?.click()}
          className="rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-5 px-4 gap-2 transition-colors"
          style={{ borderColor: "#1a3a5c", background: "rgba(26, 58, 92, 0.15)" }}
        >
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileUpload} />
          {aiReading ? (
            <>
              <Loader2 size={28} className="text-green-400 animate-spin" />
              <p className="text-green-400 text-sm font-medium">AI reading your flier…</p>
              <p className="text-muted-foreground text-[11px]">{uploadedFileName}</p>
            </>
          ) : aiSuccess ? (
            <>
              <CheckCircle size={28} className="text-green-400" />
              <p className="text-green-400 text-sm font-medium">AI found {previews.length} {previews.length === 1 ? "vacancy" : "vacancies"}</p>
              <p className="text-muted-foreground text-[11px]">{uploadedFileName}</p>
            </>
          ) : (
            <>
              <UploadCloud size={28} className="text-muted-foreground" />
              <p className="text-foreground text-sm font-medium">Upload your recruitment flyer (JPG, PNG or WEBP)</p>
              <p className="text-muted-foreground text-[11px]">AI reads every rank on the flyer and creates one vacancy per rank</p>
            </>
          )}
        </div>

        {/* Company identity (read-only) */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Company Name (verified)</label>
          <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))" }}>
            {identity?.companyName || "—"}
          </div>
          <p className="text-[10px] text-muted-foreground">Taken from your approved company profile and cannot be edited here.</p>
        </div>

        {risk && risk.level !== "low" && (
          <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b" }}>
            <strong>Risk: {risk.level}</strong>
            {risk.flags.length > 0 && <ul className="mt-1 list-disc pl-4">{risk.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          </div>
        )}

        {/* Preview cards */}
        {previews.map((v, i) => {
          const check = checkWhatsapp(v.contact_whatsapp);
          return (
            <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "#D4AF37" }}>Vacancy {i + 1}</span>
                <button type="button" onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {field("Rank", v.rank_required, (x) => update(i, "rank_required", x), "e.g. Chief Officer")}
                {field("Vessel", v.vessel_type, (x) => update(i, "vessel_type", x), "e.g. Bulk Carrier")}
                {field("Positions", String(v.positions), (x) => update(i, "positions", x))}
                {field("Joining port", v.joining_port, (x) => update(i, "joining_port", x))}
                {field("Joining date", v.joining_date, (x) => update(i, "joining_date", x), "YYYY-MM-DD")}
                {field("Contract", v.contract_duration, (x) => update(i, "contract_duration", x), "e.g. 6 months")}
                {field("Salary", v.monthly_salary, (x) => update(i, "monthly_salary", x), "as printed")}
                {field("Email", v.contact_email, (x) => update(i, "contact_email", x))}
              </div>
              {field("WhatsApp", v.contact_whatsapp, (x) => update(i, "contact_whatsapp", x), "+6512345678")}
              {!check.ok && (
                <p className="text-[11px] flex items-center gap-1" style={{ color: "#f59e0b" }}>
                  <AlertTriangle size={12} /> {check.warning}
                </p>
              )}
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Notes</label>
                <textarea
                  value={v.additional_notes}
                  onChange={(e) => update(i, "additional_notes", e.target.value)}
                  rows={2}
                  className="w-full bg-background text-foreground text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          );
        })}

        <Button variant="outline" className="w-full" onClick={addRow}>
          <Plus size={14} className="mr-1" /> Add vacancy manually
        </Button>

        {previews.length > 0 && (
          <>
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.3)" }}>
              <p className="font-semibold" style={{ color: "#D4AF37" }}>Applications will go to</p>
              <p className="text-foreground">Email: {primaryEmail || "—"}</p>
              <p className="text-foreground">WhatsApp: {primaryWhatsapp || "—"}</p>
              {publishBlocked && (
                <p className="flex items-center gap-1" style={{ color: "#f59e0b" }}>
                  <AlertTriangle size={12} /> Country code required — add +XX before publishing.
                </p>
              )}
            </div>

            <Button className="w-full" onClick={handlePublish} disabled={publishing || publishBlocked || !identity?.approved}>
              {publishing ? "Publishing…" : `Publish ${previews.length} ${previews.length === 1 ? "vacancy" : "vacancies"} →`}
            </Button>
          </>
        )}
      </div>

      {/* Similar vacancies — ONE batch-level review step */}
      {similar && pendingRows && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
            <h3 className="text-base font-bold text-foreground">Similar active vacancies already exist.</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {similar.map((s) => (
                <div key={s.id} className="text-xs rounded-lg p-2" style={{ background: "hsl(var(--secondary))" }}>
                  <span className="text-foreground font-medium">{s.rank_required}</span>
                  <span className="text-muted-foreground"> · {s.vessel_type} · {s.joining_port}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setSimilar(null); setPendingRows(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-muted-foreground"
                style={{ background: "hsl(var(--muted))" }}
              >
                Cancel
              </button>
              <button
                onClick={() => runPublish(pendingRows, pendingSkipped)}
                disabled={publishing}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "#D4AF37", color: "#0D1B2A" }}
              >
                {publishing ? "Publishing…" : "Publish Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostVacancy;
