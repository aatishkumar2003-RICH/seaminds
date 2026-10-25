import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { broadcastText, vacancyUrl, whatsappShareUrl, type BroadcastVacancy } from "@/lib/whatsappBroadcast";

const btn = "text-[11px] px-2.5 py-1.5 min-h-[32px] rounded-xl border border-[#D4AF37]/60 text-[#D4AF37] font-semibold";

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

/** Own vacancies with WhatsApp share actions. batchId → just-published batch; else recent active ones. */
export const WhatsAppBroadcastPanel = ({ batchId, title }: { batchId?: string | null; title: string }) => {
  const [rows, setRows] = useState<BroadcastVacancy[] | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setRows([]); return; }
      let q = supabase.from("job_postings")
        .select("id, rank_required, vessel_type, joining_port, joining_date, monthly_salary, contract_duration")
        .eq("manager_id", u.user.id).eq("status", "active").order("created_at", { ascending: false }).limit(30);
      if (batchId) q = q.eq("posting_batch_id", batchId);
      const { data } = await q;
      if (!off) setRows((data as BroadcastVacancy[]) || []);
    })();
    return () => { off = true; };
  }, [batchId]);

  return (
    <div className="rounded-xl border border-[#D4AF37]/30 bg-[#112240] p-3 space-y-2">
      <p className="text-sm font-bold text-[#D4AF37]">{title}</p>
      <p className="text-[11px] text-muted-foreground">Post to your WhatsApp channel or group. Each link opens the public vacancy on seaminds.life.</p>
      {rows === null ? <p className="text-xs text-muted-foreground">Loading…</p>
        : rows.length === 0 ? <p className="text-xs text-muted-foreground">No active vacancies yet.</p>
        : rows.map((v) => (
          <div key={v.id} className="border-t border-border/50 pt-2">
            <p className="text-xs font-semibold text-foreground">{[v.rank_required, v.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5"><ShareButtons v={v} /></div>
          </div>
        ))}
    </div>
  );
};
