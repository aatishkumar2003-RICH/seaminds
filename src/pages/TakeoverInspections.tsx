import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, Plus, Ship } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SignInGate from "@/components/takeover/SignInGate";
import { TEMPLATE_NAME, TEMPLATE_VERSION, TOTAL_ITEMS } from "@/lib/takeover/template";

const ADMIN_UID = "492ee966-e015-4440-a415-6ad6275a4a9b";

interface Row {
  id: string;
  vessel_name: string;
  imo: string | null;
  flag: string | null;
  started_on: string;
  status: string;
  owner_id: string;
  updated_at: string;
}

export default function TakeoverInspections() {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vessel_name: "",
    imo: "",
    flag: "",
    class_society: "",
    port_of_registry: "",
    inspector_name: "",
    started_on: new Date().toISOString().slice(0, 10),
  });

  const isAdmin = user?.id === ADMIN_UID;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("takeover_inspections" as any)
      .select("id,vessel_name,imo,flag,started_on,status,owner_id,updated_at")
      .order("created_at", { ascending: false });
    const list = ((data as any[]) || []) as Row[];
    setRows(list);
    if (list.length) {
      const { data: ans } = await supabase
        .from("takeover_answers" as any)
        .select("inspection_id")
        .in("inspection_id", list.map((r) => r.id));
      const c: Record<string, number> = {};
      ((ans as any[]) || []).forEach((a) => (c[a.inspection_id] = (c[a.inspection_id] || 0) + 1));
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isReady && user) load();
    else if (isReady) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, user]);

  const create = async () => {
    if (!form.vessel_name.trim()) return toast.error("Vessel name is required");
    if (form.imo.trim() && !/^\d{7}$/.test(form.imo.trim())) return toast.error("IMO number must be 7 digits");
    setBusy(true);
    const { data, error } = await supabase.rpc("takeover_create_inspection" as any, {
      p_vessel_name: form.vessel_name,
      p_imo: form.imo || null,
      p_flag: form.flag || null,
      p_class_society: form.class_society || null,
      p_port_of_registry: form.port_of_registry || null,
      p_inspector_name: form.inspector_name || null,
      p_started_on: form.started_on || null,
    });
    setBusy(false);
    const res = data as any;
    if (error || res?.error) return toast.error(res?.error || error?.message || "Could not create inspection");
    navigate(`/management/inspections/${res.id}`);
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/management/inspections/${id}`);
    toast.success("Link copied — only authorised accounts can open it");
  };

  if (isReady && !user) return <SignInGate />;

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-16">
      <div className="p-4 max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[#D4AF37] min-h-[44px]">
          <ChevronLeft size={20} /> Back
        </button>

        <h1 className="text-xl font-bold text-[#D4AF37] mt-2">Pre-management takeover inspections</h1>
        <p className="text-xs text-[#94A3B8] mb-4">
          {TEMPLATE_NAME} · template v{TEMPLATE_VERSION} · {TOTAL_ITEMS} checklist rows
        </p>

        {isAdmin && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="min-h-[48px] w-full rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold flex items-center justify-center gap-2 mb-4"
          >
            <Plus size={18} /> New inspection
          </button>
        )}

        {creating && (
          <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4 mb-4 space-y-2">
            {[
              ["vessel_name", "Vessel name *"],
              ["imo", "IMO number (optional, 7 digits)"],
              ["flag", "Flag"],
              ["class_society", "Class society"],
              ["port_of_registry", "Port of registry"],
              ["inspector_name", "Inspector"],
            ].map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-[11px] uppercase tracking-wide text-[#94A3B8]">{label}</span>
                <input
                  value={(form as any)[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-[#94A3B8]">Inspection start date</span>
              <input
                type="date"
                value={form.started_on}
                onChange={(e) => setForm((f) => ({ ...f, started_on: e.target.value }))}
                className="w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={create} disabled={busy} className="flex-1 min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold disabled:opacity-60">
                {busy ? "Creating…" : "Create"}
              </button>
              <button onClick={() => setCreating(false)} className="flex-1 min-h-[48px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#94A3B8]">Loading…</p>
        ) : rows.length ? (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4 mb-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Ship size={16} className="text-[#D4AF37]" /> {r.vessel_name}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    IMO {r.imo || "—"} · {r.flag || "—"} · started {r.started_on}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {counts[r.id] || 0} of {TOTAL_ITEMS} items answered
                  </p>
                </div>
                <span
                  className={`h-fit text-[10px] font-bold px-2 py-1 rounded-lg ${
                    r.status === "submitted" ? "bg-green-500/20 text-green-300" : "bg-[#D4AF37]/20 text-[#D4AF37]"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate(`/management/inspections/${r.id}`)}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm"
                >
                  {r.status === "submitted" ? "Open" : "Continue"}
                </button>
                <button onClick={() => copyLink(r.id)} className="min-h-[44px] px-4 rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37]">
                  <Copy size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#94A3B8]">
            No inspections yet.{isAdmin ? " Create one to start." : " You have not been given access to any inspection."}
          </p>
        )}
      </div>
    </div>
  );
}
