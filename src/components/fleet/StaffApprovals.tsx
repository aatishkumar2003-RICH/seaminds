import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const db = supabase as any;
const ROLES: [string, string, string][] = [
  ["technical_manager", "Technical Manager", "Technical"],
  ["technical_superintendent", "Technical Superintendent", "Technical"],
  ["marine_superintendent", "Marine Superintendent / DPA", "QHSE"],
  ["purchasing_officer", "Purchasing Officer", "Procurement"],
  ["accounts_officer", "Accounts Officer", "Accounts"],
  ["crewing_officer", "Crewing Officer", "Crewing"],
  ["crewing_manager", "Crewing Manager", "Crewing"],
  ["ship_master", "Master (onboard)", "Shipboard"],
  ["chief_engineer", "Chief Engineer (onboard)", "Shipboard"],
  ["vessel_owner", "Vessel Owner", "Owner"],
  ["approval_admin", "Approval Admin", "Admin"],
];
const DEFAULT_LIMIT: Record<string, number> = {
  technical_manager: 25000, technical_superintendent: 5000, crewing_manager: 10000,
  ship_master: 2500, chief_engineer: 1000, approval_admin: 100000,
};
const LIMITS = [0, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 999999999];
const fmt = (n: number) => (n >= 999999999 ? "Unlimited" : n === 0 ? "$0 (prepare only)" : "$" + n.toLocaleString());
const label = (r?: string | null) => ROLES.find(([k]) => k === r)?.[1] || r || "—";
const inp = "w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100";
const GATES: [string, string][] = [
  ["can_approve_salaries", "Approve crew salaries"],
  ["can_approve_travel", "Approve crew travel"],
  ["can_approve_permits", "Sign high-risk permits"],
  ["can_approve_staff", "Approve new staff logins"],
];

interface Props { cells: { id: string; name: string }[]; vessels: { id: string; name: string }[] }

export default function StaffApprovals({ cells, vessels }: Props) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState<"pending" | "approved" | "other">("pending");
  const [edit, setEdit] = useState<any | null>(null);

  const load = async () => {
    const { data } = await db.from("fleet_staff_members").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => {
    if (!user) return;
    db.rpc("is_admin", { _user_id: user.id }).then(({ data }: any) => { setIsAdmin(!!data); if (data) load(); });
  }, [user]);
  if (!isAdmin) return null;

  const open = (r: any) => {
    const role = r.approved_role || r.requested_role;
    setEdit({
      ...r, approved_role: role,
      department: r.department || ROLES.find(([k]) => k === role)?.[2] || "",
      approval_limit_usd: r.status === "approved" ? Number(r.approval_limit_usd) : DEFAULT_LIMIT[role] ?? 0,
    });
  };

  const save = async (status: string) => {
    const e = edit;
    if (status === "approved" && ["ship_master", "chief_engineer", "vessel_owner"].includes(e.approved_role) && !e.vessel_ids.length)
      return toast.error("Pick at least one ship for this person");
    const { error } = await db.from("fleet_staff_members").update({
      status, approved_role: e.approved_role, department: e.department,
      approval_limit_usd: e.approval_limit_usd, cell_ids: e.cell_ids, vessel_ids: e.vessel_ids,
      can_approve_salaries: e.can_approve_salaries, can_approve_travel: e.can_approve_travel,
      can_approve_permits: e.can_approve_permits, can_approve_staff: e.can_approve_staff,
      approved_by: user!.id, approved_at: new Date().toISOString(),
    }).eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Access approved" : status === "rejected" ? "Request rejected" : "Access paused");
    setEdit(null); load();
  };

  const toggle = (key: "cell_ids" | "vessel_ids", id: string) =>
    setEdit({ ...edit, [key]: edit[key].includes(id) ? edit[key].filter((x: string) => x !== id) : [...edit[key], id] });

  const list = rows.filter((r) => (tab === "pending" ? r.status === "pending" : tab === "approved" ? r.status === "approved" : ["rejected", "suspended"].includes(r.status)));
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4 mb-4">
      <p className="text-base font-bold text-[#D4AF37]">👥 Staff approvals & authority</p>
      <p className="text-xs text-[#94A3B8] mb-3">Approve who can enter, their job, spending limit and ships.</p>
      <div className="flex gap-2 mb-3">
        {([["pending", `Waiting (${pendingCount})`], ["approved", "Approved"], ["other", "Rejected / paused"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold ${tab === k ? "bg-[#D4AF37] text-[#0D1B2A]" : "border border-[#D4AF37] text-[#D4AF37]"}`}>{l}</button>
        ))}
      </div>
      {list.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-4">Nobody here.</p>}
      {list.map((r) => (
        <button key={r.id} onClick={() => open(r)} className="w-full text-left rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] p-3 mb-2">
          <p className="font-bold text-slate-100 text-sm">{r.full_name || r.email}</p>
          <p className="text-xs text-[#94A3B8]">{r.email}{r.company ? ` · ${r.company}` : ""}</p>
          <p className="text-xs text-[#D4AF37]">
            {r.status === "approved" ? `${label(r.approved_role)} · limit ${fmt(Number(r.approval_limit_usd))} · ${r.vessel_ids.length} ships, ${r.cell_ids.length} groups` : `Asked for: ${label(r.requested_role)}`}
          </p>
        </button>
      ))}

      {edit && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setEdit(null)}>
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] p-5 space-y-3" onClick={(ev) => ev.stopPropagation()}>
            <p className="text-base font-bold text-[#D4AF37]">{edit.full_name || edit.email}</p>
            <p className="text-xs text-[#94A3B8] -mt-2">Asked for: {label(edit.requested_role)}</p>
            <label className="block text-xs text-[#94A3B8]">Job (role)
              <select className={inp} value={edit.approved_role} onChange={(e) => {
                const role = e.target.value;
                setEdit({ ...edit, approved_role: role, department: ROLES.find(([k]) => k === role)?.[2] || "", approval_limit_usd: DEFAULT_LIMIT[role] ?? 0 });
              }}>
                {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <p className="text-xs text-[#94A3B8]">Department: <b className="text-slate-100">{edit.department}</b></p>
            <label className="block text-xs text-[#94A3B8]">Spending limit (can approve up to)
              <select className={inp} value={edit.approval_limit_usd} onChange={(e) => setEdit({ ...edit, approval_limit_usd: Number(e.target.value) })}>
                {LIMITS.map((n) => <option key={n} value={n}>{fmt(n)}</option>)}
              </select>
            </label>
            <div>
              <p className="text-xs text-[#94A3B8] mb-1">Special approvals</p>
              {GATES.map(([k, l]) => (
                <label key={k} className="flex items-center justify-between text-sm text-slate-100 min-h-[36px]">
                  {l}<input type="checkbox" className="w-5 h-5 accent-[#D4AF37]" checked={!!edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.checked })} />
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs text-[#94A3B8] mb-1">Fleet groups they look after</p>
              {cells.length === 0 && <p className="text-xs text-[#94A3B8]">No groups yet.</p>}
              <div className="flex flex-wrap gap-2">
                {cells.map((c) => (
                  <button key={c.id} onClick={() => toggle("cell_ids", c.id)} className={`px-3 min-h-[36px] rounded-xl text-xs ${edit.cell_ids.includes(c.id) ? "bg-[#D4AF37] text-[#0D1B2A] font-bold" : "border border-[rgba(212,175,55,0.3)] text-slate-200"}`}>{c.name}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8] mb-1">Ships they can see</p>
              {vessels.length === 0 && <p className="text-xs text-[#94A3B8]">No ships yet.</p>}
              <div className="flex flex-wrap gap-2">
                {vessels.map((v) => (
                  <button key={v.id} onClick={() => toggle("vessel_ids", v.id)} className={`px-3 min-h-[36px] rounded-xl text-xs ${edit.vessel_ids.includes(v.id) ? "bg-[#D4AF37] text-[#0D1B2A] font-bold" : "border border-[rgba(212,175,55,0.3)] text-slate-200"}`}>{v.name}</button>
                ))}
              </div>
            </div>
            <button onClick={() => save("approved")} className="w-full min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold">
              {edit.status === "approved" ? "Save changes" : "Approve access"}
            </button>
            <div className="flex gap-2">
              {edit.status === "approved"
                ? <button onClick={() => save("suspended")} className="flex-1 min-h-[44px] rounded-xl border border-[#f59e0b] text-[#f59e0b] text-sm font-bold">Pause access</button>
                : <button onClick={() => save("rejected")} className="flex-1 min-h-[44px] rounded-xl border border-red-400 text-red-400 text-sm font-bold">Reject</button>}
              <button onClick={() => setEdit(null)} className="flex-1 min-h-[44px] rounded-xl border border-[#D4AF37] text-[#D4AF37] text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
