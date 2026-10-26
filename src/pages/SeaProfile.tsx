import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resilientSave, saveErrorMessage } from "@/lib/resilientSave";

const YEARS_BANDS = ["0–1", "2–4", "5–8", "9–14", "15+"];
const CONTRACT_BANDS = ["0", "1–2", "3–5", "6–10", "10+"];
const SEA_BANDS = ["<2", "2–5", "6–10", "11–15", "15+"];

type Form = { rank: string; vessel_type: string; years_in_rank_band: string; contracts_in_rank_band: string; total_sea_service_band: string };
const EMPTY: Form = { rank: "", vessel_type: "", years_in_rank_band: "", contracts_in_rank_band: "", total_sea_service_band: "" };

/** My Sea Profile — editable professional profile. Never touches existing assessments (they keep their frozen snapshot). */
export default function SeaProfile() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ret = params.get("return");
  const [uid, setUid] = useState<string | null>(null);
  const [ranks, setRanks] = useState<{ canonical_rank: string; department_label: string | null }[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "signin">("loading");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("signin"); return; }
      setUid(user.id);
      const [{ data: p }, { data: rt }] = await Promise.all([
        supabase.from("crew_profiles").select("rank, vessel_type, years_in_rank_band, contracts_in_rank_band, total_sea_service_band" as any).eq("id", user.id).maybeSingle(),
        supabase.from("rank_taxonomy" as any).select("canonical_rank, department_label"),
      ]);
      const seen = new Set<string>();
      setRanks(((rt as any[]) || []).filter((r) => !seen.has(r.canonical_rank) && seen.add(r.canonical_rank))
        .sort((a, b) => (a.department_label || "").localeCompare(b.department_label || "") || a.canonical_rank.localeCompare(b.canonical_rank)));
      const pp: any = p || {};
      setForm({ rank: pp.rank || "", vessel_type: pp.vessel_type || "", years_in_rank_band: pp.years_in_rank_band || "",
        contracts_in_rank_band: pp.contracts_in_rank_band || "", total_sea_service_band: pp.total_sea_service_band || "" });
      setState("ready");
    })();
  }, []);

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
    navigate(ret && ret.startsWith("/") ? ret : "/app");
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
        {(state === "ready" || state === "saving") && (
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
