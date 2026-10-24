import { useEffect, useRef, useState } from "react";
import { FileDown, Upload, Trash2, Save, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FIELD_OPTIONS, inspectTemplate, fillTemplate, templateValues, type TemplateInspection, type TemplateMapping } from "@/lib/principalTemplates";
import type { MasterRecord } from "@/lib/principalCvPdf";

type SavedTemplate = { id: string; company_name: string; template_name: string; file_path: string; file_type: string; mappings: unknown; photo_path: string | null };
const inputClass = "w-full min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground";
export default function PrincipalTemplateStudio({ record }: { record: MasterRecord | null }) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<TemplateInspection | null>(null);
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [listError, setListError] = useState(false);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("principal_cv_templates").select("*").order("created_at", { ascending: false });
    setLoading(false); setListError(!!error);
    if (error) { toast.error("Could not load your company templates. Please retry."); return; }
    setTemplates(data || []);
  };
  useEffect(() => { if (user) void load(); }, [user?.id]);
  const inspect = async (f?: File) => {
    if (!f) return;
    setBusy(true); setInspection(null); setFile(null); setReviewed(false);
    try {
      const result = inspectTemplate(new Uint8Array(await f.arrayBuffer()), f.name);
      setInspection(result); setFile(f); setName(f.name.replace(/\.(docx|xlsx)$/i, "")); setPhoto(""); setFilter("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read this template."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const mappings = inspection?.targets.filter(t => t.field) || [];
  const save = async () => {
    if (!user || !file || !inspection || !reviewed || !company.trim() || !name.trim() || !mappings.length) return;
    setBusy(true);
    const path = `${user.id}/${crypto.randomUUID()}.${inspection.type}`;
    try {
      const { error: uploadError } = await supabase.storage.from("principal-templates").upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("principal_cv_templates").insert({ company_name: company.trim(), template_name: name.trim(), file_path: path, file_type: inspection.type, mappings, photo_path: photo || null }).select("id").single();
      if (error) {
        // Never delete an object after an uncertain insert: reconcile first.
        const { data: existing, error: readError } = await supabase.from("principal_cv_templates").select("id").eq("file_path", path).maybeSingle();
        if (!existing) { if (!readError) await supabase.storage.from("principal-templates").remove([path]); throw error; }
      }
      toast.success("Company template saved"); setInspection(null); setFile(null); setReviewed(false); await load();
    } catch { toast.error("Template could not be saved. Check your connection and manager approval, then retry."); }
    finally { setBusy(false); }
  };
  const remove = async (template: SavedTemplate) => {
    if (!window.confirm(`Delete ${template.template_name}?`)) return;
    setBusy(true);
    const { error } = await supabase.from("principal_cv_templates").delete().eq("id", template.id);
    if (error) toast.error("Template could not be deleted.");
    else {
      const { error: storageError } = await supabase.storage.from("principal-templates").remove([template.file_path]);
      if (storageError) toast.error("Template removed from the list; its stored file could not be cleaned up.");
      else toast.success("Template deleted");
      if (selected === template.id) setSelected(""); await load();
    }
    setBusy(false);
  };
  const template = templates.find(t => t.id === selected);
  const values = record ? templateValues(record) : {};
  const savedMappings = (template && Array.isArray(template.mappings) ? template.mappings : []) as TemplateMapping[];
  const missing = savedMappings.filter(m => !values[m.field]);
  const download = async () => {
    if (!record || !template || (template.file_type !== "docx" && template.file_type !== "xlsx")) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from("principal-templates").download(template.file_path);
      if (error || !data) throw new Error("The saved template could not be downloaded. Please retry.");
      const bytes = await fillTemplate(new Uint8Array(await data.arrayBuffer()), template.file_type, savedMappings, record, template.photo_path);
      const url = URL.createObjectURL(new Blob([bytes], { type: template.file_type === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `${values.name || "Crew"}_${template.company_name}_CV.${template.file_type}`.replace(/[<>:"/\\|?*]/g, "_"); a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success("Company-format CV downloaded");
    } catch (e) { toast.error(e instanceof Error ? e.message : "CV could not be created."); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold text-primary flex items-center gap-2"><FolderOpen size={18} /> Company templates</h2>
      <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><Upload /> Upload company template</Button>
      <input ref={fileInput} type="file" accept=".docx,.xlsx" className="hidden" aria-label="Upload company template file" onChange={e => void inspect(e.target.files?.[0])} />
    </div>
    <p className="text-xs text-muted-foreground">Blank Word (.docx) or Excel (.xlsx) form · maximum 10 MB. Use a blank photo placeholder, not another candidate’s photograph.</p>
    {busy && <p role="status" className="text-sm text-muted-foreground">Processing…</p>}
    {inspection && <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground space-y-1">Company / principal name<input aria-label="Company / principal name" maxLength={120} className={inputClass} value={company} onChange={e => setCompany(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground space-y-1">Template name<input aria-label="Template name" maxLength={120} className={inputClass} value={name} onChange={e => setName(e.target.value)} /></label>
      </div>
      <p className="text-xs text-muted-foreground">Select the crew field for each answer location. Unmapped text stays unchanged. Review the blank form before saving; do not upload a completed CV.</p>
      <input aria-label="Find template field" placeholder="Find a cell, paragraph or label…" className={inputClass} value={filter} onChange={e => setFilter(e.target.value)} />
      <div className="max-h-80 overflow-y-auto border-y border-border divide-y divide-border">
        {inspection.targets.filter(t => t.label.toLowerCase().includes(filter.toLowerCase())).map(t => <div key={`${t.part}:${t.target}`} className="grid sm:grid-cols-2 gap-2 py-2">
          <span className="text-xs text-foreground break-words">{t.label}</span>
          <select aria-label={`Map ${t.target} ${t.part}`} className={inputClass} value={t.field} onChange={e => { setReviewed(false); setInspection({ ...inspection, targets: inspection.targets.map(other => other === t ? { ...other, field: e.target.value } : other) }); }}>
            <option value="">Keep unchanged</option>{FIELD_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>)}
      </div>
      <label className="block text-xs text-muted-foreground space-y-1">Photo placeholder<select className={inputClass} value={photo} onChange={e => { setPhoto(e.target.value); setReviewed(false); }} aria-label="Photo placeholder">
        <option value="">No photo replacement</option>{inspection.photos.map(p => <option key={p} value={p}>{p}</option>)}
      </select></label>
      <p className="text-xs text-muted-foreground">{mappings.length} fields mapped. {inspection.photos.length === 0 ? "No embedded photo slot found. Add a placeholder image to the original form to include a crew photo." : "Select only the candidate photo slot; company logos must stay unchanged."}</p>
      <label className="flex gap-2 items-start text-xs text-foreground"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I confirm this is an authorized blank form and I have checked every mapped answer location and photo slot.</label>
      <div className="flex gap-2"><Button disabled={busy || !reviewed || !company.trim() || !name.trim() || !mappings.length} onClick={() => void save()}><Save /> Save template</Button><Button variant="ghost" disabled={busy} onClick={() => { setInspection(null); setFile(null); }}>Cancel</Button></div>
    </div>}
    {loading ? <p className="text-sm text-muted-foreground">Loading templates…</p> : listError ? <Button variant="outline" onClick={() => void load()}>Retry loading templates</Button> : templates.length === 0 ? <p className="text-sm text-muted-foreground">No company templates uploaded yet.</p> : <>
      <label className="block text-xs text-muted-foreground space-y-1">Company / template<select aria-label="Company / template" className={inputClass} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select company template…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.company_name} — {t.template_name} ({t.file_type.toUpperCase()})</option>)}</select></label>
      {template && <>
        {record && <div className="max-h-52 overflow-y-auto border-y border-border py-2 space-y-1" aria-label="Mapped CV preview">{savedMappings.map(m => <p key={`${m.part}:${m.target}`} className="text-xs break-words"><span className="text-muted-foreground">{m.target} · {FIELD_OPTIONS.find(([k]) => k === m.field)?.[1]}: </span>{values[m.field] || "Not provided"}</p>)}</div>}
        {record && missing.length > 0 && <p className="text-xs text-muted-foreground">{missing.length} mapped fields are empty. Review the crew record before sending; missing data is never invented.</p>}
        <div className="flex flex-wrap gap-2"><Button disabled={!record || busy || !record.declaration?.acceptedAt} onClick={() => void download()}><FileDown /> Download company CV</Button><Button variant="ghost" disabled={busy} onClick={() => void remove(template)} aria-label="Delete selected template"><Trash2 /></Button></div>
        {record && !record.declaration?.acceptedAt && <p className="text-xs text-destructive">Crew must confirm CV accuracy in their CV Builder before export.</p>}
      </>}
    </>}
    <p className="text-xs text-muted-foreground">Exports retain the original Word or Excel form. Check page breaks, photo placement and missing details in Word or Excel before sending to the principal.</p>
  </section>;
}
