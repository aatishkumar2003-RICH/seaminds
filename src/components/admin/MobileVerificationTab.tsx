import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, RefreshCw, Search } from "lucide-react";

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string;
  verification_token: string;
  email_verified: boolean;
  verification_status: string;
  created_at: string;
};

const NAVY = "#0D1B2A";
const GOLD = "#D4AF37";

export default function MobileVerificationTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mobile_verifications")
      .select("id, full_name, email, phone_number, verification_token, email_verified, verification_status, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const decide = async (row: Row, status: "verified" | "rejected") => {
    await supabase
      .from("mobile_verifications")
      .update({
        verification_status: status,
        verified_at: status === "verified" ? new Date().toISOString() : null,
        verified_by: "admin",
      })
      .eq("id", row.id);
    setNote(`${row.phone_number} marked ${status}.`);
    load();
  };

  const visible = rows.filter(r => {
    if (filter !== "all" && r.verification_status !== filter) return false;
    if (!q) return true;
    const hay = `${r.full_name || ""} ${r.email || ""} ${r.phone_number} ${r.verification_token}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const badge = (s: string) =>
    s === "verified" ? "🟢 Verified" : s === "rejected" ? "🔴 Rejected" : "🟡 Pending";

  return (
    <div style={{ background: NAVY, border: `1px solid ${GOLD}33`, borderRadius: 12, padding: 16 }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 style={{ color: GOLD }} className="text-lg font-bold">📱 Mobile Verification</h2>
        <button onClick={load} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md"
          style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2 px-2 rounded-md" style={{ border: `1px solid ${GOLD}55` }}>
          <Search size={13} color={GOLD} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, phone, token"
            className="bg-transparent text-white text-xs py-2 outline-none w-64" />
        </div>
        {(["all", "pending", "verified", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className="text-xs px-3 py-1.5 rounded-md capitalize"
            style={filter === f ? { background: GOLD, color: NAVY } : { border: `1px solid ${GOLD}`, color: GOLD }}>
            {f}
          </button>
        ))}
      </div>

      {note && <p className="text-xs mb-3" style={{ color: GOLD }}>{note}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead style={{ color: GOLD }}>
            <tr>
              {["Name", "Email", "Phone", "Token", "Email ✓", "WhatsApp", "Submitted", "Actions"].map(h => (
                <th key={h} className="py-2 pr-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-200">
            {loading && <tr><td colSpan={8} className="py-4 text-gray-400">Loading…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-gray-400">No verification requests yet.</td></tr>
            )}
            {visible.map(r => (
              <tr key={r.id} style={{ borderTop: "1px solid #1e3a5f" }}>
                <td className="py-2 pr-3 whitespace-nowrap">{r.full_name || "—"}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{r.email || "—"}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{r.phone_number}</td>
                <td className="py-2 pr-3 whitespace-nowrap font-mono">{r.verification_token}</td>
                <td className="py-2 pr-3">{r.email_verified ? "✅" : "—"}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{badge(r.verification_status)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => decide(r, "verified")} className="px-2 py-1 rounded"
                      style={{ background: GOLD, color: NAVY }}>Approve</button>
                    <button onClick={() => decide(r, "rejected")} className="px-2 py-1 rounded"
                      style={{ border: "1px solid #ef4444", color: "#ef4444" }}>Reject</button>
                    <button onClick={() => { navigator.clipboard?.writeText(r.verification_token); setNote("Token copied."); }}
                      className="px-2 py-1 rounded flex items-center gap-1" style={{ border: `1px solid ${GOLD}55`, color: GOLD }}>
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
