import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const REQUEST_OPTIONS = [
  "RPSL / crewing licence number and copy",
  "Company registration certificate (SIUPPAK / incorporation)",
  "Official company website",
  "Corporate email address (company domain)",
  "IMO company number / DOC",
  "Authorisation letter for the person registering",
];

interface Mgr {
  id: string; user_id: string; company_name: string; company_type: string | null;
  full_name: string | null; phone: string | null; designation: string | null;
  country: string | null; admin_approved: boolean; company_verified: boolean;
  approved_at: string | null; created_at: string;
}
interface Compliance {
  manager_user_id: string; status: string; requested_items: string[]; admin_note: string | null;
  requested_at: string | null; license_number: string | null; website: string | null;
  manager_note: string | null; document_paths: string[]; submitted_at: string | null;
}

const notify = async (event: string, manager_user_id: string) => {
  const { data, error } = await supabase.functions.invoke("company-compliance-notify", { body: { event, manager_user_id } });
  if (error || !data?.sent) { toast.warning("Saved, but the email could not be sent."); return false; }
  return true;
};

const statusPill = (c?: Compliance) => {
  if (!c || c.status === "none") return { t: "🟡 Pending review", col: "#f59e0b" };
  if (c.status === "requested") return { t: `🟠 Docs requested ${c.requested_at ? new Date(c.requested_at).toLocaleDateString() : ""}`, col: "#fb923c" };
  if (c.status === "submitted") return { t: "🔵 Docs submitted — ready for review", col: "#60a5fa" };
  return { t: "🟢 Documents verified", col: "#22c55e" };
};

const CompanyApprovalTab = () => {
  const [rows, setRows] = useState<Mgr[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [comp, setComp] = useState<Record<string, Compliance>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reqFor, setReqFor] = useState<Mgr | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: em }, { data: cc }] = await Promise.all([
      supabase.from("manager_profiles").select("*").order("created_at", { ascending: false }),
      supabase.rpc("admin_manager_emails" as never),
      supabase.from("company_compliance" as never).select("*"),
    ]);
    setRows(((data as any[]) || []) as Mgr[]);
    setEmails(Object.fromEntries(((em as any[]) || []).map((r) => [r.user_id, r.email])));
    setComp(Object.fromEntries(((cc as any[]) || []).map((r) => [r.manager_user_id, r])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setFlag = async (m: Mgr, field: "admin_approved" | "company_verified", value: boolean) => {
    setBusy(m.id);
    const patch: any = { [field]: value };
    if (field === "admin_approved") patch.approved_at = value ? new Date().toISOString() : null;
    const { error } = await supabase.from("manager_profiles").update(patch).eq("id", m.id);
    if (error) { setBusy(null); toast.error(error.message); return; }
    if (field === "admin_approved" && value) {
      const ok = await notify("company_approved", m.user_id);
      toast.success(ok ? "Approved — approval email sent" : "Approved");
    } else toast.success(value ? "Updated" : "Removed");
    setBusy(null);
    load();
  };

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("company-documents").createSignedUrl(path, 600);
    if (error || !data) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const markVerified = async (m: Mgr) => {
    setBusy(m.id);
    const { error } = await supabase.rpc("admin_mark_compliance_verified" as never, { p_manager: m.user_id } as never);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Documents marked verified");
    load();
  };

  const sendRequest = async () => {
    if (!reqFor) return;
    const items = [...picked, ...custom.split("\n").map((s) => s.trim()).filter(Boolean)];
    if (items.length === 0) { toast.error("Pick at least one item"); return; }
    setBusy(reqFor.id);
    const { error } = await supabase.rpc("admin_request_company_docs" as never, { p_manager: reqFor.user_id, p_items: items, p_note: note.trim() || null } as never);
    if (error) { setBusy(null); toast.error(error.message); return; }
    const ok = await notify("docs_requested", reqFor.user_id);
    setBusy(null);
    toast.success(ok ? "Request saved and email sent" : "Request saved");
    setReqFor(null); setPicked([]); setCustom(""); setNote("");
    load();
  };

  const pending = rows.filter((r) => !r.admin_approved);
  const approved = rows.filter((r) => r.admin_approved);
  const btn = (bg: string, col: string, border = "none") => ({ padding: "7px 14px", borderRadius: 9, background: bg, color: col, border, fontSize: 12, fontWeight: 700, cursor: "pointer" } as const);

  const Card = ({ m }: { m: Mgr }) => {
    const c = comp[m.user_id];
    const pill = statusPill(c);
    return (
      <div style={{ background: CARD, border: `1px solid ${m.admin_approved ? BORDER : "rgba(245,158,11,0.4)"}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: GOLD, fontWeight: 800, fontSize: 14 }}>{m.company_name}</span>
          {m.company_verified && <span style={{ color: "#22c55e", fontSize: 11 }}>✅ verified</span>}
          <span style={{ color: pill.col, fontSize: 11 }}>{pill.t}</span>
          <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 10 }}>Joined {new Date(m.created_at).toLocaleDateString()}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 4, marginTop: 8, fontSize: 12, color: "#cbd5e1" }}>
          <span>👤 {m.full_name || "—"}{m.designation ? ` · ${m.designation}` : ""}</span>
          <span>🏢 {m.company_type || "—"} · {m.country || "—"}</span>
          <span style={{ wordBreak: "break-all" }}>✉️ {emails[m.user_id] || "—"}</span>
          <span>📞 {m.phone ? <a href={`https://wa.me/${m.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{m.phone}</a> : "—"}</span>
        </div>
        {c && (c.requested_items?.length > 0 || c.license_number || c.website || c.document_paths?.length > 0) && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 9, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, fontSize: 12, color: "#cbd5e1" }}>
            {c.requested_items?.length > 0 && <p><b style={{ color: GOLD }}>Requested:</b> {c.requested_items.join(" · ")}</p>}
            {c.license_number && <p>Licence / registration: <b>{c.license_number}</b></p>}
            {c.website && <p>Website: <a href={/^https?:/.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{c.website}</a></p>}
            {c.manager_note && <p>Company note: {c.manager_note}</p>}
            {c.document_paths?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {c.document_paths.map((p, i) => (
                  <button key={p} onClick={() => openDoc(p)} style={btn("transparent", GOLD, `1px solid ${GOLD}`)}>👁️ Document {i + 1}</button>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
          {!m.admin_approved ? (
            <button disabled={busy === m.id} onClick={() => setFlag(m, "admin_approved", true)} style={btn("#22c55e", "#fff")}>Approve &amp; send email</button>
          ) : (
            <button disabled={busy === m.id} onClick={() => setFlag(m, "admin_approved", false)} style={btn("transparent", "#ef4444", "1px solid rgba(239,68,68,0.5)")}>Revoke approval</button>
          )}
          <button disabled={busy === m.id} onClick={() => { setReqFor(m); setPicked(c?.requested_items?.filter((i) => REQUEST_OPTIONS.includes(i)) || []); }} style={btn(GOLD, "#0D1B2A")}>📋 Request documents</button>
          {c?.status === "submitted" && (
            <button disabled={busy === m.id} onClick={() => markVerified(m)} style={btn("transparent", "#22c55e", "1px solid #22c55e")}>Mark documents verified</button>
          )}
          <button disabled={busy === m.id} onClick={() => setFlag(m, "company_verified", !m.company_verified)} style={btn("transparent", GOLD, `1px solid ${GOLD}`)}>
            {m.company_verified ? "Remove verified badge" : "Give verified badge"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 4 }}>
      <div style={{ background: "rgba(212,175,55,0.07)", border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 12, padding: 13, marginBottom: 16 }}>
        <p style={{ color: GOLD, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Company approval</p>
        <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
          Review what each company submitted. Use “Request documents” to ask for a licence, website or registration — the company is emailed and uploads it in their portal; you get an email when it arrives. Approving also emails the company.
        </p>
      </div>

      {loading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>}
      {!loading && pending.length > 0 && (<>
        <p style={{ color: "#f59e0b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Pending approval ({pending.length})</p>
        {pending.map((m) => <Card key={m.id} m={m} />)}
      </>)}
      {!loading && approved.length > 0 && (<>
        <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, margin: "18px 0 8px" }}>Approved ({approved.length})</p>
        {approved.map((m) => <Card key={m.id} m={m} />)}
      </>)}
      {!loading && rows.length === 0 && <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "30px 0" }}>No company accounts yet.</p>}

      {reqFor && (
        <div onClick={() => setReqFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#0D1B2A", border: `1px solid ${GOLD}55`, borderRadius: 14, padding: 18, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <p style={{ color: GOLD, fontWeight: 800, fontSize: 15 }}>Request documents</p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 10 }}>{reqFor.company_name} · {emails[reqFor.user_id] || "no email"}</p>
            {REQUEST_OPTIONS.map((o) => (
              <label key={o} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#e2e8f0", fontSize: 13, padding: "5px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={picked.includes(o)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, o] : p.filter((x) => x !== o))} />
                {o}
              </label>
            ))}
            <textarea value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Other items (one per line)" rows={2}
              style={{ width: "100%", marginTop: 8, background: CARD, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, fontSize: 12 }} />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Message to the company (optional)" rows={2}
              style={{ width: "100%", marginTop: 8, background: CARD, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, fontSize: 12 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setReqFor(null)} style={btn("transparent", GOLD, `1px solid ${GOLD}`)}>Cancel</button>
              <button disabled={busy === reqFor.id} onClick={sendRequest} style={btn(GOLD, "#0D1B2A")}>{busy === reqFor.id ? "Sending…" : "Save & email company"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyApprovalTab;
