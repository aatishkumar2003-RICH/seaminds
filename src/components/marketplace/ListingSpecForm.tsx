import { ImagePlus, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { MAX_DOCS, MAX_DOC_BYTES, type PhotoSlot, type SpecGroup } from "@/lib/marketplaceSpecs";
import { supabase } from "@/integrations/supabase/client";
import { compressPhoto } from "@/lib/shipMarketplace";

/** Uploads slot photos (compressed, slot-named) and PDFs into the seller's own folder. */
export async function uploadListingMedia(uid: string, photos: Record<string, File>, docs: File[]) {
  const bucket = supabase.storage.from("ship-listings");
  const photoPaths: string[] = [];
  for (const [slot, file] of Object.entries(photos)) {
    const path = `${uid}/${slot}-${crypto.randomUUID()}.webp`;
    const { error } = await bucket.upload(path, await compressPhoto(file), { contentType: "image/webp" });
    if (error) throw error;
    photoPaths.push(path);
  }
  const docPaths: string[] = [];
  for (const d of docs) {
    const path = `${uid}/doc-${crypto.randomUUID()}.pdf`;
    const { error } = await bucket.upload(path, d, { contentType: "application/pdf" });
    if (error) throw error;
    docPaths.push(path);
  }
  return { photoPaths, docPaths };
}

const inp = "w-full rounded-xl border border-primary/30 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

export const SpecFields = ({ groups, spec, onChange }: { groups: SpecGroup[]; spec: Record<string, string>; onChange: (k: string, v: string) => void }) => (
  <div className="space-y-4">
    {groups.map((g) => (
      <section key={g.title} className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-primary">{g.title}</h3>
        <div className="grid grid-cols-2 gap-2">
          {g.fields.map((f) => (
            <label key={f.k} className="space-y-1 text-[11px] text-muted-foreground">
              <span>{f.label}{f.req && <span className="text-primary"> *</span>}</span>
              {f.opts ? (
                <select className={inp} value={spec[f.k] ?? ""} onChange={(e) => onChange(f.k, e.target.value)}>
                  {!f.opts.includes("") && <option value="">Select…</option>}
                  {f.opts.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                </select>
              ) : (
                <input className={inp} type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined}
                  maxLength={120} placeholder={f.ph} value={spec[f.k] ?? ""}
                  onChange={(e) => onChange(f.k, f.type === "number" ? e.target.value.replace(/[^0-9.,]/g, "") : e.target.value)} />
              )}
            </label>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export const PhotoSlots = ({ slots, photos, onChange }: { slots: PhotoSlot[]; photos: Record<string, File>; onChange: (p: Record<string, File>) => void }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-bold uppercase tracking-wide text-primary">Photos ({Object.keys(photos).length}/{slots.length}) · * required</h3>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {slots.map((s) => {
        const f = photos[s.k];
        return (
          <div key={s.k} className="space-y-1">
            {f ? (
              <div className="relative aspect-square overflow-hidden rounded-lg border border-primary/40">
                <img src={URL.createObjectURL(f)} alt={s.label} className="h-full w-full object-cover" />
                <button type="button" aria-label={`Remove ${s.label}`} onClick={() => { const n = { ...photos }; delete n[s.k]; onChange(n); }}
                  className="absolute right-0.5 top-0.5 rounded-full bg-background p-0.5"><X size={12} /></button>
              </div>
            ) : (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/50 text-primary">
                <ImagePlus size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  if (file.size > 15 * 1024 * 1024) return toast.error("Photo too large (max 15 MB before compression).");
                  onChange({ ...photos, [s.k]: file });
                }} />
              </label>
            )}
            <p className="text-center text-[9px] leading-tight text-muted-foreground">{s.label}{s.req ? " *" : ""}</p>
          </div>
        );
      })}
    </div>
    <p className="text-[10px] text-muted-foreground">Photos are compressed automatically. Upload only photos you own.</p>
  </section>
);

export const DocUpload = ({ label, docs, onChange }: { label: string; docs: File[]; onChange: (d: File[]) => void }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-bold uppercase tracking-wide text-primary">{label} (PDF, max {MAX_DOCS} × 10 MB)</h3>
    {docs.map((d, i) => (
      <div key={i} className="flex items-center gap-2 rounded-lg border border-primary/30 px-2 py-1.5 text-xs text-foreground">
        <FileText size={14} className="text-primary" /><span className="flex-1 truncate">{d.name}</span>
        <button type="button" aria-label="Remove document" onClick={() => onChange(docs.filter((_, j) => j !== i))}><X size={12} /></button>
      </div>
    ))}
    {docs.length < MAX_DOCS && (
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary">
        <FileText size={14} />Add PDF
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          if (f.type !== "application/pdf") return toast.error("Only PDF documents.");
          if (f.size > MAX_DOC_BYTES) return toast.error("PDF must be under 10 MB.");
          onChange([...docs, f]);
        }} />
      </label>
    )}
  </section>
);
