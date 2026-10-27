import { ensureCrewProfileRow, MANAGER_ACCOUNT_MSG } from "@/lib/crewProfileRow";
import { markProfileDone } from "@/lib/applyMessage";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resilientSave, saveErrorMessage } from "@/lib/resilientSave";

const YEARS_BANDS = ["0–1", "2–4", "5–8", "9–14", "15+"];
const CONTRACT_BANDS = ["0", "1–2", "3–5", "6–10", "10+"];
const SEA_BANDS = ["<2", "2–5", "6–10", "11–15", "15+"];

type Form = { rank: string; vessel_type: string; years_in_rank_band: string; contracts_in_rank_band: string; total_sea_service_band: string };
const EMPTY: Form = { rank: "", vessel_type: "", years_in_rank_band: "", contracts_in_rank_band: "", total_sea_service_band: "" };

/** My Sea Profile — editable professional profile. Never touches existing assessments (they keep their frozen snapshot). */
export default function SeaProfile() {
  const navigate = useNavigate();
  const { user: authUser, isReady: authReady } = useAuth();
  const [params] = useSearchParams();
  const ret = params.get("return");
  const [uid, setUid] = useState<string | null>(null);
  const [ranks, setRanks] = useState<{ canonical_rank: string; department_label: string | null }[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "signin">("loading");
  const [editing, setEditing] = useState(!!ret);
  const [info, setInfo] = useState<any>({});
  const [avail, setAvail] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!authReady) return;
      const user = authUser;
      if (!user) { setState("signin"); return; }
      setUid(user.id);
      const [{ data: p }, { data: rt }, { data: vx }] = await Promise.all([
        supabase.from("crew_profiles").select("first_name, last_name, crew_unique_id, nationality, whatsapp_number, email, email_verified, whatsapp_verified, is_available, availability_status, placed_until, rank, vessel_type, years_in_rank_band, contracts_in_rank_band, total_sea_service_band" as any).eq("id", user.id).maybeSingle(),
        supabase.from("rank_taxonomy" as any).select("canonical_rank, department_label"),
        supabase.from("crew_vessel_experience" as any).select("vessel_family, sea_time_band").eq("crew_id", user.id),
      ]);
      const seen = new Set<string>();
      setRanks(((rt as any[]) || []).filter((r) => !seen.has(r.canonical_rank) && seen.add(r.canonical_rank))
        .sort((a, b) => (a.department_label || "").localeCompare(b.department_label || "") || a.canonical_rank.localeCompare(b.canonical_rank)));
      const pp: any = p || {};
      const VLABEL: Record<string, string> = { OIL_TANKER: "Oil Tanker", CHEM_TANKER: "Chemical Tanker", LPG: "LPG Carrier", LNG: "LNG Carrier", BULK: "Bulk Carrier", CONTAINER: "Container", GENERAL_CARGO: "General Cargo", RORO_PAX: "RORO / Passenger", PSV_OSV: "PSV / OSV", AHTS: "AHTS", OTHER: "Other" };
      const vesselList = ((vx as any[]) || []).map((v) => `${VLABEL[v.vessel_family] || v.vessel_family}${v.sea_time_band ? ` (${v.sea_time_band}${/yr/.test(v.sea_time_band) ? "" : " yr"})` : ""}`).join(", ");
      setInfo(pp);
      const placed = pp.placed_until && new Date(pp.placed_until) > new Date();
      setAvail(pp.availability_status || (placed ? "joined" : pp.is_available ? "ready" : "not_available"));
      setForm({ rank: pp.rank || "", vessel_type: vesselList || pp.vessel_type || "", years_in_rank_band: pp.years_in_rank_band || "",
        contracts_in_rank_band: pp.contracts_in_rank_band || "", total_sea_service_band: pp.total_sea_service_band || "" });
      setState("ready");
    })();
  }, [authReady, authUser?.id]);

  const setAvailability = async (v: string) => {
    if (!uid || v === avail) return;
    const prev = avail; setAvail(v);
    const ensured = await ensureCrewProfileRow();
    if (ensured === "manager") { setAvail(prev); toast.error(MANAGER_ACCOUNT_MSG); return; }
    const { data, error } = await supabase.from("crew_profiles").update({ availability_status: v } as any).eq("id", uid).select("availability_status").maybeSingle();
    if (error || (data as any)?.availability_status !== v) { setAvail(prev); toast.error("Could not update availability. Please try again."); return; }
    toast.success(v === "ready" ? "You're marked Ready to join." : v === "joined" ? "Marked as Joined (onboard)." : "Marked Not available.");
  };

  const save = async () => {
    if (!uid) return;
    if (!ranks.some((r) => r.canonical_rank === form.rank)) { toast.error("Choose your official rank from the list."); return; }
    setState("saving");
    const ensured = await ensureCrewProfileRow();
    if (ensured === "manager") { setState("ready"); toast.error(MANAGER_ACCOUNT_MSG); return; }
    const { error } = await resilientSave("sea_profile", () => supabase.from("crew_profiles").update(form as any).eq("id", uid));
    // Verify the save actually landed before claiming success
    const { data: check } = await supabase.from("crew_profiles").select("rank").eq("id", uid).maybeSingle();
    setState("ready");
    if (error || (check as any)?.rank !== form.rank) {
      toast.error(error ? saveErrorMessage(error) : "Your profile could not be saved. Please check your connection and tap Save again.");
      return;
    }
    markProfileDone(uid);
    toast.success("Sea Profile saved. Earlier scores are unchanged.");
    if (ret && ret.startsWith("/")) navigate(ret); else setEditing(false);
  };

  const back = () => (ret && ret.startsWith("/") ? navigate(ret) : navigate("/app"));
  const chip = (active: boolean) => ({ background: active ? "#D4AF37" : "transparent", color: active ? "#0D1B2A" : "#D4AF37", border: "1px solid rgba(212,175,55,0.5)" });
  const Bands = ({ k, opts, label }: { k: keyof Form; opts: string[]; label: string }) => (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold" style={{ color: "#94A3B8" }}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o} type="button" aria-pressed={form[k] === o} onClick={() => setForm((f) => ({ ...f, [k]: o }))}
            className="px-3 py-1.5 rounded-xl text-sm font-bold" style={chip(form[k] === o)}>{o}</button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="min-h-screen" style={{ background: "#0D1B2A" }}>
      <div className="max-w-md mx-auto px-5 py-5 space-y-5">
        <button onClick={back} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#D4AF37" }} aria-label="Back">
          <ChevronLeft size={18} /> Back
        </button>
        <div>
          <p className="text-[10px] font-extrabold tracking-widest" style={{ color: "#D4AF37" }}>MY SEA PROFILE</p>
          <h1 className="text-xl font-bold text-white mt-1">Your professional details</h1>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Used for new assessments. Finished and in-progress assessments keep the details they started with.</p>
        </div>
        {state === "loading" && <Loader2 className="animate-spin mx-auto" style={{ color: "#D4AF37" }} />}
        {state === "signin" && (
          <button onClick={() => navigate("/app")} className="w-full py-3 rounded-xl font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>Sign in to edit your profile</button>
        )}
        {state === "ready" && !editing && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}>
              <div>
                <p className="text-lg font-bold text-white">{[info.first_name, info.last_name].filter(Boolean).join(" ") || "Seafarer"}</p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>{[info.crew_unique_id, info.nationality].filter(Boolean).join(" · ")}</p>
              </div>
              {[["Rank", form.rank], ["Vessel type", form.vessel_type], ["Years in rank", form.years_in_rank_band],
                ["Contracts in rank", form.contracts_in_rank_band], ["Total sea service", form.total_sea_service_band],
                ["WhatsApp", info.whatsapp_number ? `${info.whatsapp_number}${info.whatsapp_verified ? " ✅" : " (not verified)"}` : ""],
                ["Email", info.email ? `${info.email}${info.email_verified ? " ✅" : " (not verified)"}` : ""]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-sm">
                  <span style={{ color: "#94A3B8" }}>{k}</span>
                  <span className="text-white font-semibold text-right break-all">{v || <span style={{ color: "#f59e0b" }}>Not set</span>}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-4 space-y-2" style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}>
              <p className="text-xs font-semibold" style={{ color: "#94A3B8" }}>My availability</p>
              <div className="grid grid-cols-3 gap-2">
                {[["ready", "🟢 Ready to join"], ["joined", "🚢 Joined"], ["not_available", "⏸️ Not available"]].map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={avail === v} onClick={() => setAvailability(v)}
                    className="px-2 py-2 rounded-xl text-xs font-bold" style={chip(avail === v)}>{l}</button>
                ))}
              </div>
            </div>
            <button onClick={() => navigate(`/quick-profile?edit=1&next=${encodeURIComponent("/profile")}`)} className="w-full py-3 rounded-xl font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>✏️ Edit full profile (Quick Profile tour)</button>
            <button onClick={() => setEditing(true)} className="w-full py-3 rounded-xl font-bold" style={{ background: "transparent", color: "#D4AF37", border: "1px solid #D4AF37" }}>Quick edit rank &amp; sea service</button>
          </div>
        )}
        {(state === "ready" || state === "saving") && editing && (
          <div className="rounded-2xl p-4 space-y-5" style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Official rank</span>
              <select value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}
                className="w-full rounded-xl px-3 py-3 text-sm text-white" style={{ background: "#0D1B2A", border: "1px solid rgba(212,175,55,0.3)" }}>
                <option value="">Select your rank…</option>
                {ranks.map((r) => <option key={r.canonical_rank} value={r.canonical_rank}>{r.canonical_rank}{r.department_label ? ` — ${r.department_label}` : ""}</option>)}
              </select>
              {form.rank && !ranks.some((r) => r.canonical_rank === form.rank) && (
                <span className="text-xs" style={{ color: "#f59e0b" }}>“{form.rank}” is not an official rank. Please pick one from the list.</span>
              )}
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Current / last vessel type</span>
              <input value={form.vessel_type} onChange={(e) => setForm((f) => ({ ...f, vessel_type: e.target.value }))} maxLength={80}
                className="w-full rounded-xl px-3 py-3 text-sm text-white" style={{ background: "#0D1B2A", border: "1px solid rgba(212,175,55,0.3)" }} placeholder="e.g. LNG Carrier" />
            </label>
            <Bands k="years_in_rank_band" opts={YEARS_BANDS} label="Years in this rank" />
            <Bands k="contracts_in_rank_band" opts={CONTRACT_BANDS} label="Contracts in this rank" />
            <Bands k="total_sea_service_band" opts={SEA_BANDS} label="Total sea service (years)" />
            <button onClick={save} disabled={state === "saving"} className="w-full py-3 rounded-xl font-bold" style={{ background: "#D4AF37", color: "#0D1B2A", opacity: state === "saving" ? 0.6 : 1 }}>
              {state === "saving" ? "Saving…" : ret ? "Save and return to assessment" : "Save Sea Profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
