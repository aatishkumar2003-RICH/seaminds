import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";

interface Mgr {
  id: string; user_id: string; company_name: string; company_type: string | null;
  full_name: string | null; phone: string | null; designation: string | null;
  country: string | null; admin_approved: boolean; company_verified: boolean;
  approved_at: string | null; created_at: string;
}

const CompanyApprovalTab = () => {
  const [rows, setRows] = useState<Mgr[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("manager_profiles").select("*").order("created_at", { ascending: false });
    setRows(((data as any[]) || []) as Mgr[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setFlag = async (m: Mgr, field: "admin_approved" | "company_verified", value: boolean) => {
    setBusy(m.id);
    const patch: any = { [field]: value };
    if (field === "admin_approved") patch.approved_at = value ? new Date().toISOString() : null;
    const { error } = await supabase.from("manager_profiles").update(patch).eq("id", m.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(value ? "Approved" : "Approval removed");
    load();
  };

  const pending = rows.filter((r) => !r.admin_approved);
  const approved = rows.filter((r) => r.admin_approved);

  const Card = ({ m }: { m: Mgr }) => (
    <div style={{ background: CARD, border: `1px solid ${m.admin_approved ? BORDER : "rgba(245,158,11,0.4)"}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: GOLD, fontWeight: 800, fontSize: 14 }}>{m.company_name}</span>
        {m.company_verified && <span style={{ color: "#22c55e", fontSize: 11 }}>✅ verified</span>}
        {!m.admin_approved && <span style={{ color: "#f59e0b", fontSize: 11 }}>pending</span>}
        <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 10 }}>{new Date(m.created_at).toLocaleDateString()}</span>
      </div>
      <p style={{ color: "#cbd5e1", fontSize: 12, marginTop: 6 }}>
        {[m.full_name, m.designation, m.company_type, m.country].filter(Boolean).join(" · ") || "No details given"}
      </p>
      {m.phone && <p style={{ color: "#94a3b8", fontSize: 11.5, marginTop: 3 }}>📞 {m.phone}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
        {!m.admin_approved ? (
          <button disabled={busy === m.id} onClick={() => setFlag(m, "admin_approved", true)}
            style={{ padding: "7px 14px", borderRadius: 9, background: "#22c55e", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Approve — release crew data
          </button>
        ) : (
          <button disabled={busy === m.id} onClick={() => setFlag(m, "admin_approved", false)}
            style={{ padding: "7px 14px", borderRadius: 9, background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Revoke approval
          </button>
        )}
        <button disabled={busy === m.id} onClick={() => setFlag(m, "company_verified", !m.company_verified)}
          style={{ padding: "7px 14px", borderRadius: 9, background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {m.company_verified ? "Remove verified badge" : "Mark verified"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 4 }}>
      <div style={{ background: "rgba(212,175,55,0.07)", border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 12, padding: 13, marginBottom: 16 }}>
        <p style={{ color: GOLD, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Company approval</p>
        <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
          Only approved companies can search crew and open CVs. Verify the company is real before approving —
          seafarers trust SeaMinds with their contact details.
        </p>
      </div>

      {loading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>}

      {!loading && pending.length > 0 && (
        <>
          <p style={{ color: "#f59e0b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Pending approval ({pending.length})
          </p>
          {pending.map((m) => <Card key={m.id} m={m} />)}
        </>
      )}

      {!loading && approved.length > 0 && (
        <>
          <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, margin: "18px 0 8px" }}>
            Approved ({approved.length})
          </p>
          {approved.map((m) => <Card key={m.id} m={m} />)}
        </>
      )}

      {!loading && rows.length === 0 && (
        <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "30px 0" }}>No company accounts yet.</p>
      )}
    </div>
  );
};

export default CompanyApprovalTab;
