import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Ship, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SignInGate from "@/components/takeover/SignInGate";
import StaffApprovals from "@/components/fleet/StaffApprovals";
import TakeoverInspections from "@/pages/TakeoverInspections";

const TABS = [
  { id: "fleet", label: "🚢 Ships" }, { id: "staff", label: "👥 Staff & Access" }, { id: "pms", label: "🛠 PMS" },
  { id: "inspections", label: "📋 Inspections" }, { id: "safety", label: "🦺 Safety" }, { id: "spares", label: "📦 Spares" }, { id: "crew", label: "🧑‍✈️ Crew" },
];
const SOON: Record<string, string> = { pms: "Planned Maintenance (PMS)", safety: "Safety & Permits", spares: "Spares & Procurement", crew: "Crew & Payroll" };

interface Cell { id: string; name: string; superintendent: string | null }
interface Vessel {
  id: string; name: string; imo: string | null; flag: string | null; vessel_type: string | null;
  owner_company: string | null; cell_id: string | null; status: string; inspection_id: string | null;
}
interface Period { vessel_id: string; starts_on: string; status: string }

const db = supabase as any;
const input = "w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100";
const STATUS_LABEL: Record<string, string> = { active: "Under management", prospect: "Takeover pending", handed_over: "Handed over" };

export default function FleetHome() {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [cells, setCells] = useState<Cell[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [periods, setPeriods] = useState<Record<string, Period>>({});
  const [cellFilter, setCellFilter] = useState("all");
  const [selected, setSelected] = useState<string>(() => localStorage.getItem("fleet_vessel") || "");
  const [adding, setAdding] = useState<"" | "vessel" | "cell">("");
  const [form, setForm] = useState({ name: "", imo: "", flag: "", vessel_type: "Bulk carrier", owner_company: "", cell_id: "", status: "active" });
  const [cellForm, setCellForm] = useState({ name: "", superintendent: "" });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "fleet");

  const load = async () => {
    const [c, v, p] = await Promise.all([
      db.from("fleet_cells").select("id,name,superintendent").order("name"),
      db.from("fleet_vessels").select("*").order("name"),
      db.from("management_periods").select("vessel_id,starts_on,status").eq("status", "active"),
    ]);
    setCells(c.data || []);
    setVessels(v.data || []);
    const map: Record<string, Period> = {};
    (p.data || []).forEach((r: Period) => (map[r.vessel_id] = r));
    setPeriods(map);
    setLoading(false);
  };

  useEffect(() => { if (isReady && user) load(); else if (isReady) setLoading(false); }, [isReady, user]);

  const pick = (id: string) => { setSelected(id); localStorage.setItem("fleet_vessel", id); };

  const addVessel = async () => {
    if (!form.name.trim()) return toast.error("Ship name is required");
    if (form.imo && !/^\d{7}$/.test(form.imo.trim())) return toast.error("IMO number must be 7 digits");
    const { data, error } = await db.from("fleet_vessels").insert({
      ...form, imo: form.imo || null, flag: form.flag || null, owner_company: form.owner_company || null, cell_id: form.cell_id || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Ship added to fleet");
    setAdding(""); setForm({ ...form, name: "", imo: "", flag: "", owner_company: "" });
    pick(data.id); load();
  };

  const addCell = async () => {
    if (!cellForm.name.trim()) return toast.error("Group name is required");
    const { error } = await db.from("fleet_cells").insert({ name: cellForm.name, superintendent: cellForm.superintendent || null });
    if (error) return toast.error(error.message);
    toast.success("Fleet group created"); setAdding(""); setCellForm({ name: "", superintendent: "" }); load();
  };

  if (isReady && !user) return <SignInGate />;

  const shown = vessels.filter((v) => cellFilter === "all" || v.cell_id === cellFilter || (cellFilter === "none" && !v.cell_id));
  const current = vessels.find((v) => v.id === selected);
  const cellName = (id: string | null) => cells.find((c) => c.id === id)?.name || "No group";

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-16">
      {/* Fleet switcher bar */}
      <div className="sticky top-0 z-10 bg-[#0D1B2A]/95 backdrop-blur border-b border-[rgba(212,175,55,0.3)]">
        <div className="max-w-4xl mx-auto p-3 flex items-center gap-2">
          <button onClick={() => navigate("/admin")} className="flex items-center text-[#D4AF37] min-h-[44px] pr-1" aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <Ship size={18} className="text-[#D4AF37] shrink-0" />
          <select value={selected} onChange={(e) => pick(e.target.value)} className={input + " flex-1"}>
            <option value="">Whole fleet ({vessels.length} ships)</option>
            {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-[#D4AF37]">Fleet & PMS Workspace</h1>
        <p className="text-xs text-[#94A3B8] mb-3">One command centre for every ship under management</p>

        <div className="flex gap-2 overflow-x-auto mb-4 -mx-1 px-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 min-h-[40px] px-3 rounded-xl text-xs font-bold border ${tab === t.id ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)] text-[#D4AF37]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {current && (
          <div className="rounded-2xl bg-[#112240] border border-[#D4AF37] p-4 mb-4">
            <p className="text-[11px] uppercase tracking-wide text-[#D4AF37]">Selected ship</p>
            <p className="text-lg font-bold text-slate-100">{current.name}</p>
            <p className="text-xs text-[#94A3B8]">
              IMO {current.imo || "—"} · {current.flag || "—"} · {current.vessel_type || "—"} · Owner {current.owner_company || "—"}
            </p>
            <p className="text-xs text-[#94A3B8]">
              {cellName(current.cell_id)} · {STATUS_LABEL[current.status]}
              {periods[current.id] && ` since ${periods[current.id].starts_on}`}
            </p>
          </div>
        )}

        {tab === "staff" && <StaffApprovals cells={cells} vessels={vessels} />}
        {tab === "inspections" && <TakeoverInspections embedded />}
        {SOON[tab] && (
          <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-6 text-center">
            <ClipboardCheck className="mx-auto text-[#D4AF37] mb-2" size={28} />
            <p className="text-sm font-bold text-slate-100">{SOON[tab]}</p>
            <p className="text-xs text-[#94A3B8] mt-1">This module is being built in the next workspace phases.</p>
          </div>
        )}

        {tab === "fleet" && <>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setAdding("vessel")} className="flex-1 min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold flex items-center justify-center gap-2">
            <Plus size={18} /> Add ship
          </button>
          <button onClick={() => setAdding("cell")} className="flex-1 min-h-[48px] rounded-xl border border-[#D4AF37] text-[#D4AF37] font-bold">
            + Fleet group
          </button>
        </div>

        {adding === "vessel" && (
          <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4 mb-4 space-y-2">
            <input placeholder="Ship name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <input placeholder="IMO number (7 digits)" inputMode="numeric" value={form.imo} onChange={(e) => setForm({ ...form, imo: e.target.value })} className={input} />
            <input placeholder="Flag" value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} className={input} />
            <input placeholder="Owner company" value={form.owner_company} onChange={(e) => setForm({ ...form, owner_company: e.target.value })} className={input} />
            <select value={form.vessel_type} onChange={(e) => setForm({ ...form, vessel_type: e.target.value })} className={input}>
              {["Bulk carrier", "Oil tanker", "Chemical tanker", "Container", "General cargo", "LPG/LNG", "Other"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={form.cell_id} onChange={(e) => setForm({ ...form, cell_id: e.target.value })} className={input}>
              <option value="">No fleet group</option>
              {cells.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={input}>
              <option value="active">Under management now</option>
              <option value="prospect">Takeover pending</option>
            </select>
            <div className="flex gap-2">
              <button onClick={addVessel} className="flex-1 min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold">Save</button>
              <button onClick={() => setAdding("")} className="flex-1 min-h-[48px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold">Cancel</button>
            </div>
          </div>
        )}

        {adding === "cell" && (
          <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4 mb-4 space-y-2">
            <input placeholder="Group name (e.g. Bulk Cell A) *" value={cellForm.name} onChange={(e) => setCellForm({ ...cellForm, name: e.target.value })} className={input} />
            <input placeholder="Superintendent" value={cellForm.superintendent} onChange={(e) => setCellForm({ ...cellForm, superintendent: e.target.value })} className={input} />
            <div className="flex gap-2">
              <button onClick={addCell} className="flex-1 min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold">Save</button>
              <button onClick={() => setAdding("")} className="flex-1 min-h-[48px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto mb-3">
          {[{ id: "all", name: "All" }, ...cells, { id: "none", name: "No group" }].map((c) => (
            <button key={c.id} onClick={() => setCellFilter(c.id)}
              className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-bold border ${cellFilter === c.id ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)] text-[#D4AF37]"}`}>
              {c.name}
            </button>
          ))}
        </div>

        {loading ? <p className="text-sm text-[#94A3B8]">Loading…</p> : shown.length ? shown.map((v) => (
          <button key={v.id} onClick={() => pick(v.id)}
            className={`w-full text-left rounded-2xl bg-[#112240] border p-4 mb-3 ${v.id === selected ? "border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)]"}`}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-100">{v.name}</p>
                <p className="text-[11px] text-[#94A3B8]">{v.vessel_type || "—"} · {v.owner_company || "Owner —"} · {cellName(v.cell_id)}</p>
              </div>
              <span className={`h-fit text-[10px] font-bold px-2 py-1 rounded-lg ${v.status === "active" ? "bg-green-500/20 text-green-300" : v.status === "prospect" ? "bg-amber-500/20 text-amber-300" : "bg-slate-500/20 text-slate-300"}`}>
                {STATUS_LABEL[v.status]}
              </span>
            </div>
          </button>
        )) : <p className="text-sm text-[#94A3B8]">No ships yet. Tap "Add ship" to start your fleet.</p>}
        </>}
      </div>
    </div>
  );
}
