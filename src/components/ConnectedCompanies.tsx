import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, ChevronLeft, ShieldCheck } from "lucide-react";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "rgba(212,175,55,0.3)";
type Co = { manager_uid: string; company: string; since: string; kinds: string[] };
const KIND: Record<string, string> = { roster: "Company crew list", training: "Training", fleet: "Fleet", cadet: "Cadet Academy" };

/** Top-panel strip: which companies can see this seafarer, with one-tap disconnect. */
export default function ConnectedCompanies() {
  const [list, setList] = useState<Co[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("crew_my_companies" as any);
    if (!error) setList(((data as any) || []) as Co[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const disconnect = async (c: Co) => {
    if (!confirm(`Disconnect from ${c.company}?\n\nThey will no longer see you in their crew list. Your CV, certificates and documents stay in your SeaMinds account.`)) return;
    setBusy(c.manager_uid);
    const { data, error } = await supabase.rpc("crew_disconnect_company" as any, { p_manager_uid: c.manager_uid });
    setBusy(null);
    if (error || !(data as any)?.ok) return toast.error("Could not disconnect. Please try again.");
    toast.success(`Disconnected from ${c.company}. Your documents stay with you.`);
    void load();
  };

  if (!list) return null;
  const n = list.length;
  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full mb-2.5 flex items-center gap-2 rounded-xl px-3 py-2.5 text-left"
        style={{ background: "rgba(13,27,42,0.7)", border: `1px solid ${n ? "rgba(34,197,94,0.4)" : BORDER}`, cursor: "pointer" }}>
        <Building2 size={16} style={{ color: n ? "#22c55e" : GOLD }} />
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Connected companies</span>
          <span className="block text-[13px] font-extrabold truncate" style={{ color: n ? "#22c55e" : GOLD }}>
            {n === 0 ? "None — independent seafarer" : n === 1 ? list[0].company : `${list[0].company} +${n - 1} more`}
          </span>
        </span>
        <span className="text-[11px] font-bold" style={{ color: GOLD }}>Manage ›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl p-5 pb-8" style={{ background: CARD, borderTop: `1px solid ${GOLD}` }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="flex items-center gap-1 text-sm mb-2" style={{ color: GOLD, background: "none", border: "none" }}><ChevronLeft size={18} /> Back</button>
            <p className="text-base font-extrabold" style={{ color: GOLD }}>My connected companies</p>
            <p className="text-[12px] mt-1 mb-3" style={{ color: "#94A3B8" }}>These companies can see your profile, sea service and certificates. They never see your wellness chats or mood check-ins.</p>
            {n === 0 && <p className="text-[13px] py-3" style={{ color: "#e2e8f0" }}>You are not connected to any company.</p>}
            {list.map(c => (
              <div key={c.manager_uid} className="rounded-xl p-3 mb-2" style={{ background: NAVY, border: `1px solid ${BORDER}` }}>
                <p className="text-[14px] font-extrabold" style={{ color: "#e2e8f0" }}>🏢 {c.company}</p>
                <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                  Since {new Date(c.since).toLocaleDateString()} · {(c.kinds || []).map(k => KIND[k] || k).join(", ")}
                </p>
                <button onClick={() => disconnect(c)} disabled={busy === c.manager_uid} className="mt-2 w-full rounded-xl py-2 text-[13px] font-bold"
                  style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, cursor: "pointer" }}>
                  {busy === c.manager_uid ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ))}
            <p className="mt-3 flex gap-2 text-[11px]" style={{ color: "#94A3B8" }}>
              <ShieldCheck size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
              Disconnecting removes you from that company's crew list. Your CV, certificates and documents always stay in your SeaMinds account.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
