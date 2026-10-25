import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizePhone, extractLeadsFromText, type ExtractedLead } from "@/lib/phoneNormalize";
import { isSpreadsheet, readXlsxCv } from "@/lib/xlsxCv";

const gold = "#D4AF37";
const card = { background: "#112240", border: "1px solid rgba(212,175,55,0.3)" };
type Staged = ExtractedLead & { key: string; keep: boolean; flag: "ready" | "dup_batch" | "existing" | "invalid" };
type Lead = { id: string; name: string | null; phone_e164: string; rank_detected: string | null; audience: string; batch_tag: string | null; status: string; last_error: string | null };

async function compress(file: File): Promise<{ b64: string; mime: string }> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { b64: c.toDataURL("image/jpeg", 0.85).split(",")[1], mime: "image/jpeg" };
}

export default function WhatsAppLeadsStudio() {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [audience, setAudience] = useState<"agent" | "crew">("crew");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("whatsapp_crew_leads").select("*").order("created_at", { ascending: false }).limit(1000);
    setLeads((data as Lead[]) || []);
  };
  useEffect(() => { load(); }, []);

  const stage = (rows: ExtractedLead[], source: string) => {
    const known = new Set(leads.map((l) => l.phone_e164));
    setStaged((prev) => {
      const seen = new Set(prev.map((p) => p.phone_e164).filter(Boolean));
      const next = rows.map((r, i) => {
        const e = r.phone_e164;
        const flag: Staged["flag"] = !e ? "invalid" : known.has(e) ? "existing" : seen.has(e) ? "dup_batch" : "ready";
        if (e) seen.add(e);
        return { ...r, key: `${source}-${Date.now()}-${i}`, keep: flag === "ready", flag };
      });
      return [...prev, ...next];
    });
    toast.success(`${rows.length} numbers found`);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        if (f.type.startsWith("image/")) {
          setPreview(URL.createObjectURL(f));
          const { b64, mime } = await compress(f);
          const { data, error } = await supabase.functions.invoke("whatsapp-leads", { body: { action: "extract", imageBase64: b64, mimeType: mime } });
          if (error || data?.error) { toast.error(data?.error || "Could not read screenshot"); continue; }
          stage((data.rows || []).map((r: any) => ({ name: r.name || null, phone_raw: String(r.phone || ""), phone_e164: normalizePhone(String(r.phone || "")), rank: r.rank || null })), "img");
        } else if (isSpreadsheet(f)) {
          const { text } = await readXlsxCv(f);
          stage(extractLeadsFromText(text), "xlsx");
        } else {
          stage(extractLeadsFromText(await f.text()), "csv");
        }
      } catch { toast.error(`Could not read ${f.name}`); }
    }
    setBusy(false);
  };

  const approve = async () => {
    const rows = staged.filter((s) => s.keep && s.phone_e164).map((s) => ({
      name: s.name, phone_e164: s.phone_e164!, phone_raw: s.phone_raw, rank_detected: s.rank,
      audience, batch_tag: tag || null, source: "studio", status: "approved",
    }));
    if (!rows.length) return toast.error("Nothing selected");
    const { error } = await supabase.from("whatsapp_crew_leads").upsert(rows, { onConflict: "phone_e164", ignoreDuplicates: true });
    if (error) return toast.error("Save failed");
    toast.success(`${rows.length} leads saved`);
    setStaged([]); setPreview(null); load();
  };

  const dispatch = async () => {
    const queue = leads.filter((l) => l.status === "approved" && l.audience === "crew");
    if (!queue.length) return toast.error("No approved crew contacts to send");
    if (!confirm(`Send the Seafarer Welcome WhatsApp to ${queue.length} crew, one every 3 seconds?`)) return;
    stopRef.current = false;
    setProgress({ done: 0, total: queue.length });
    let ok = 0;
    for (let i = 0; i < queue.length && !stopRef.current; i++) {
      const { data } = await supabase.functions.invoke("whatsapp-leads", { body: { action: "send", lead_id: queue[i].id, template: "crew_welcome" } });
      if (data?.ok) ok++;
      setProgress({ done: i + 1, total: queue.length });
      await new Promise((r) => setTimeout(r, 3000));
    }
    setProgress(null);
    toast.success(`${ok} messages accepted by WhatsApp`);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("whatsapp_crew_leads").update({ status }).eq("id", id); load();
  };

  const badge: Record<Staged["flag"], [string, string]> = {
    ready: ["Ready", "#22c55e"], dup_batch: ["Duplicate", "#f59e0b"], existing: ["Already saved", "#60a5fa"], invalid: ["Invalid", "#ef4444"],
  };
  const counts = leads.reduce<Record<string, number>>((a, l) => ({ ...a, [l.status]: (a[l.status] || 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={card}>
        <h2 className="text-lg font-bold" style={{ color: gold }}>WhatsApp Studio</h2>
        <p className="text-sm" style={{ color: "#94A3B8" }}>Drop screenshots, Excel/CSV lists, or paste text. Numbers are cleaned (0812… → +62812…), checked for duplicates, then sent from the official SeaMinds WhatsApp line using only Meta-approved messages.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <input ref={fileRef} type="file" multiple accept="image/*,.xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <button disabled={busy} onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl font-bold text-sm" style={{ background: gold, color: "#0D1B2A" }}>{busy ? "Reading…" : "Upload screenshots / files"}</button>
          <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="px-3 py-2 rounded-xl text-sm" style={{ background: "#0D1B2A", color: "#fff", border: "1px solid rgba(212,175,55,0.3)" }}>
            <option value="crew">Seafarers (Crew)</option>
            <option value="agent">Agencies / Managers</option>
          </select>
          <input placeholder="Batch tag e.g. Jakarta Agents Oct" value={tag} onChange={(e) => setTag(e.target.value)} className="px-3 py-2 rounded-xl text-sm bg-transparent" style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#fff" }} />
        </div>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Or paste names and numbers here…" rows={3} className="w-full mt-3 p-2 rounded-xl text-sm bg-transparent" style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#fff" }} />
        <button onClick={() => { stage(extractLeadsFromText(paste), "paste"); setPaste(""); }} disabled={!paste.trim()} className="mt-2 px-4 py-2 rounded-xl text-sm font-bold" style={{ border: `1px solid ${gold}`, color: gold }}>Extract from text</button>
      </div>

      {staged.length > 0 && (
        <div className="rounded-xl p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" style={card}>
          {preview ? <img src={preview} alt="Uploaded screenshot" className="rounded-lg max-h-[600px] w-full object-contain" /> : <div className="text-sm" style={{ color: "#94A3B8" }}>Text / spreadsheet source</div>}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm" style={{ color: "#e2e8f0" }}>{staged.filter((s) => s.keep).length} of {staged.length} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setStaged([])} className="px-3 py-1 rounded-xl text-xs" style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#94A3B8" }}>Clear</button>
                <button onClick={approve} className="px-3 py-1 rounded-xl text-xs font-bold" style={{ background: gold, color: "#0D1B2A" }}>Save selected</button>
              </div>
            </div>
            <div className="max-h-[560px] overflow-auto space-y-1">
              {staged.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 text-sm p-2 rounded-lg" style={{ background: "#0D1B2A" }}>
                  <input type="checkbox" checked={s.keep} disabled={!s.phone_e164} onChange={(e) => setStaged((p) => p.map((x, j) => j === i ? { ...x, keep: e.target.checked } : x))} />
                  <input value={s.name || ""} onChange={(e) => setStaged((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name" className="flex-1 min-w-0 bg-transparent" style={{ color: "#fff" }} />
                  <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{s.phone_e164 || s.phone_raw}</span>
                  <span className="text-xs px-2 rounded" style={{ color: badge[s.flag][1], border: `1px solid ${badge[s.flag][1]}` }}>{badge[s.flag][0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl p-4" style={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold" style={{ color: gold }}>Saved WhatsApp Numbers ({leads.length})</h3>
            <div className="text-sm" style={{ color: "#e2e8f0" }}>approved {counts.approved || 0} · sent {counts.sent || 0} · failed {counts.failed || 0} · opted out {counts.opt_out || 0}</div>
          </div>
          {progress ? (
            <button onClick={() => { stopRef.current = true; }} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ border: "1px solid #ef4444", color: "#ef4444" }}>Stop ({progress.done}/{progress.total})</button>
          ) : (
            <button onClick={dispatch} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: gold, color: "#0D1B2A" }}>Send to approved crew</button>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Sending works only after Meta approves the Seafarer Welcome message. Mark anyone who replies STOP as "opt out" — they will never be messaged again.</p>
        <div className="mt-3 max-h-[480px] overflow-auto space-y-1">
          {leads.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm p-2 rounded-lg" style={{ background: "#0D1B2A", color: "#e2e8f0" }}>
              <span className="flex-1 min-w-0 truncate">{l.name || "—"} <span className="text-xs" style={{ color: "#94A3B8" }}>{l.batch_tag}</span></span>
              <span className="font-mono text-xs">{l.phone_e164}</span>
              <span className="text-xs" style={{ color: "#94A3B8" }}>{l.audience}</span>
              <span className="text-xs" style={{ color: l.status === "sent" ? "#22c55e" : l.status === "failed" ? "#ef4444" : gold }} title={l.last_error || ""}>{l.status}</span>
              {l.status !== "opt_out" && <button onClick={() => setStatus(l.id, "opt_out")} className="text-xs underline" style={{ color: "#94A3B8" }}>opt out</button>}
              {l.status === "failed" && <button onClick={() => setStatus(l.id, "approved")} className="text-xs underline" style={{ color: gold }}>retry</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
