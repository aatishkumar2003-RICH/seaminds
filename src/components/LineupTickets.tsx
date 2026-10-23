import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LINEUP_CATEGORIES, LineupRole, canEscalate, categoryLabel, lineupErrorText } from "@/lib/lineupTickets";

interface Ticket {
  id: string; ticket_ref: string; category: string; statement: string; status: string;
  raised_by_role: string; created_at: string;
}
interface Msg { id: string; ticket_id: string; author_role: string; body: string; created_at: string }

const STATUS: Record<string, string> = {
  open: "Open", in_dialogue: "In discussion", mutually_resolved: "Resolved", escalated: "With SeaMinds team", closed: "Closed",
};

/** Two-way issue tickets for one joining (application). Used by crew and company. */
const LineupTickets = ({ applicationId, role, compact }: { applicationId: string; role: LineupRole; compact?: boolean }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [statement, setStatement] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("lineup_tickets").select("id,ticket_ref,category,statement,status,raised_by_role,created_at")
      .eq("application_id", applicationId).order("created_at", { ascending: false });
    const list = (data as Ticket[]) || [];
    setTickets(list);
    if (list.length) {
      const { data: m } = await supabase.from("lineup_ticket_messages").select("id,ticket_id,author_role,body,created_at")
        .in("ticket_id", list.map((t) => t.id)).order("created_at");
      setMsgs((m as Msg[]) || []);
    }
  }, [applicationId]);
  useEffect(() => { load(); }, [load]);

  const call = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc(fn as any, args as any);
    setBusy(false);
    const r = data as { ok?: boolean; error?: string } | null;
    if (error || !r?.ok) { toast.error(lineupErrorText(r?.error)); return false; }
    toast.success(ok); load(); return true;
  };

  const submit = async () => {
    if (await call("raise_lineup_ticket", { p_application_id: applicationId, p_category: category, p_statement: statement },
      "Issue raised. The other side has 48 hours to reply.")) { setOpen(false); setCategory(""); setStatement(""); }
  };

  const other = role === "crew" ? "Company" : "Crew";
  return (
    <div className={compact ? "w-full space-y-2" : "w-full space-y-2 mt-2"}>
      {tickets.map((t) => {
        const live = ["open", "in_dialogue", "escalated"].includes(t.status);
        return (
          <div key={t.id} className="rounded-xl border border-[#D4AF37]/30 bg-[#112240] p-3 text-left text-xs text-[#E2E8F0] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[#D4AF37]">⚖️ {t.ticket_ref} · {categoryLabel(t.category)}</span>
              <span className="rounded-full bg-[#0D1B2A] px-2 py-0.5 text-[10px] text-[#94A3B8]">{STATUS[t.status] || t.status}</span>
            </div>
            <p><b>{t.raised_by_role === role ? "You" : other}:</b> {t.statement}</p>
            {msgs.filter((m) => m.ticket_id === t.id).map((m) => (
              <p key={m.id} className="text-[#CBD5E1]"><b>{m.author_role === role ? "You" : m.author_role === "admin" ? "SeaMinds" : other}:</b> {m.body}</p>
            ))}
            {live && (
              <div className="space-y-2">
                <textarea value={reply[t.id] || ""} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} maxLength={2000}
                  placeholder="Reply…" rows={2} className="w-full rounded-lg border border-[#D4AF37]/30 bg-[#0D1B2A] p-2 text-xs text-white" />
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy || !(reply[t.id] || "").trim()} onClick={async () => { if (await call("reply_lineup_ticket", { p_ticket_id: t.id, p_body: reply[t.id] }, "Reply sent")) setReply({ ...reply, [t.id]: "" }); }}
                    className="rounded-xl bg-[#D4AF37] px-3 py-1.5 font-bold text-[#0D1B2A] disabled:opacity-50">Send</button>
                  <button disabled={busy} onClick={() => window.confirm("Mark this issue as resolved by agreement?") && call("set_lineup_ticket_status", { p_ticket_id: t.id, p_action: "resolve" }, "Marked resolved")}
                    className="rounded-xl border border-[#22c55e]/60 px-3 py-1.5 font-bold text-[#22c55e]">Resolved</button>
                  {canEscalate(t, role) && (
                    <button disabled={busy} onClick={() => window.confirm("Ask the SeaMinds team to review this fairly?") && call("set_lineup_ticket_status", { p_ticket_id: t.id, p_action: "escalate" }, "Sent to the SeaMinds team")}
                      className="rounded-xl border border-[#f59e0b]/60 px-3 py-1.5 font-bold text-[#f59e0b]">Ask SeaMinds to review</button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded-lg border border-[#D4AF37]/50 px-2.5 py-1.5 text-[11px] font-semibold text-[#D4AF37]">
          ⚖️ Report an issue
        </button>
      ) : (
        <div className="rounded-xl border border-[#D4AF37]/30 bg-[#112240] p-3 space-y-2 text-left">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Reason"
            className="w-full rounded-lg border border-[#D4AF37]/30 bg-[#0D1B2A] p-2 text-xs text-white">
            <option value="">Choose a reason…</option>
            {LINEUP_CATEGORIES[role].map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={2000} rows={3}
            placeholder="Describe what happened, with dates." className="w-full rounded-lg border border-[#D4AF37]/30 bg-[#0D1B2A] p-2 text-xs text-white" />
          <p className="text-[10px] text-[#94A3B8]">Both sides see this. Be factual — the other side gets 48 hours to reply before SeaMinds reviews it.</p>
          <div className="flex gap-2">
            <button disabled={busy || !category || statement.trim().length < 10} onClick={submit}
              className="rounded-xl bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-[#0D1B2A] disabled:opacity-50">Submit</button>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-[#D4AF37]/50 px-3 py-1.5 text-xs font-bold text-[#D4AF37]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LineupTickets;
