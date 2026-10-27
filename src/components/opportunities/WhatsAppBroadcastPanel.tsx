import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  broadcastText, vacancyUrl, whatsappShareUrl, buildDigests, vacanciesCsv, vacanciesPdf, downloadBlob,
  type BroadcastVacancy,
} from "@/lib/whatsappBroadcast";

const btn = "text-[11px] px-2.5 py-1.5 min-h-[32px] rounded-xl border border-[#D4AF37]/60 text-[#D4AF37] font-semibold";
const goldBtn = "flex-1 min-h-[44px] rounded-xl bg-[#D4AF37] px-3 text-sm font-bold text-[#0D1B2A] disabled:opacity-50";

export const copyBroadcast = async (v: BroadcastVacancy, linkOnly = false) => {
  try {
    await navigator.clipboard.writeText(linkOnly ? vacancyUrl(v) : broadcastText(v));
    toast.success(linkOnly ? "Link copied" : "Announcement copied — paste into your channel");
  } catch { toast.error("Could not copy. Long-press to copy manually."); }
};

export const ShareButtons = ({ v }: { v: BroadcastVacancy }) => (
  <>
    <a className={btn} href={whatsappShareUrl(broadcastText(v))} target="_blank" rel="noopener noreferrer">📱 Share to WhatsApp</a>
    <button className={btn} onClick={() => copyBroadcast(v)}>📋 Copy text</button>
    <button className={btn} onClick={() => copyBroadcast(v, true)}>🔗 Copy link</button>
  </>
);

/** Own vacancies with bulk + single WhatsApp sharing and Excel/PDF export. batchId → just-published batch. */
export const WhatsAppBroadcastPanel = ({ batchId, title }: { batchId?: string | null; title: string }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<BroadcastVacancy[] | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [showEach, setShowEach] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      let q = supabase.from("job_postings")
        .select("id, rank_required, vessel_type, joining_port, joining_date, monthly_salary, contract_duration, recruiter_name, contact_whatsapp, contact_email")
        .eq("manager_id", user.id).eq("status", "active").order("created_at", { ascending: true }).limit(100);
      if (batchId) q = q.eq("posting_batch_id", batchId);
      const { data } = await q;
      if (!cancelled) setRows((data as BroadcastVacancy[]) || []);
    })();
    return () => { cancelled = true; };
  }, [batchId, user?.id]);

  const chosen = useMemo(() => (rows || []).filter((r) => !off.has(r.id)), [rows, off]);
  const digests = useMemo(() => buildDigests(chosen), [chosen]);
  const toggle = (id: string) => setOff((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const stamp = new Date().toISOString().slice(0, 10);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(digests.join("\n\n")); toast.success(`${chosen.length} vacancies copied — paste into your group`); }
    catch { toast.error("Could not copy. Use the WhatsApp buttons instead."); }
  };
  const exportCsv = () => downloadBlob(new Blob([vacanciesCsv(chosen)], { type: "text/csv;charset=utf-8" }), `seaminds-vacancies-${stamp}.csv`);
  const exportPdf = async () => {
    try { downloadBlob(await vacanciesPdf(chosen, chosen.find((r) => r.recruiter_name)?.recruiter_name || "Open vacancies"), `seaminds-vacancies-${stamp}.pdf`); }
    catch { toast.error("PDF could not be created. Try the Excel download."); }
  };

  return (
    <div className="rounded-xl border border-[#D4AF37]/30 bg-[#112240] p-3 space-y-3">
      <p className="text-sm font-bold text-[#D4AF37]">{title}</p>
      {rows === null ? <p className="text-xs text-muted-foreground">Loading…</p>
        : rows.length === 0 ? <p className="text-xs text-muted-foreground">No active vacancies yet.</p>
        : (
          <>
            <div className="rounded-xl border border-[#D4AF37]/50 bg-[#0D1B2A] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">📢 {chosen.length} of {rows.length} selected</p>
                <button className="text-[11px] text-[#D4AF37] underline" onClick={() => setOff(off.size ? new Set() : new Set(rows.map((r) => r.id)))}>
                  {off.size ? "Select all" : "Clear all"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                All selected vacancies go in {digests.length <= 1 ? "one WhatsApp message" : `${digests.length} WhatsApp messages (WhatsApp limits message length)`} — no need to share them one by one.
              </p>
              <div className="flex flex-col gap-2">
                {digests.map((d, i) => (
                  <a key={i} className={`${goldBtn} flex items-center justify-center`} href={whatsappShareUrl(d)} target="_blank" rel="noopener noreferrer">
                    📱 {digests.length > 1 ? `Send part ${i + 1} of ${digests.length} to WhatsApp` : `Send all ${chosen.length} to WhatsApp`}
                  </a>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button className={btn} disabled={!chosen.length} onClick={copyAll}>📋 Copy all</button>
                <button className={btn} disabled={!chosen.length} onClick={exportCsv}>📊 Excel</button>
                <button className={btn} disabled={!chosen.length} onClick={exportPdf}>📄 PDF</button>
              </div>
            </div>
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {rows.map((v) => (
                <li key={v.id}>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" checked={!off.has(v.id)} onChange={() => toggle(v.id)} className="h-4 w-4 accent-[#D4AF37]" />
                    <span className="truncate">{[v.rank_required, v.vessel_type, v.joining_port].filter(Boolean).join(" · ") || "Vacancy"}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button className="text-[11px] text-[#D4AF37] underline" onClick={() => setShowEach((x) => !x)}>
              {showEach ? "Hide single-vacancy sharing" : "Share a single vacancy instead"}
            </button>
            {showEach && rows.map((v) => (
              <div key={v.id} className="border-t border-border/50 pt-2">
                <p className="text-xs font-semibold text-foreground">{[v.rank_required, v.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5"><ShareButtons v={v} /></div>
              </div>
            ))}
          </>
        )}
    </div>
  );
};
