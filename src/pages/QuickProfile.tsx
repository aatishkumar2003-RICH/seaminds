import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAVY = "#0D1B2A";
const CARD = "#112240";
const GOLD = "#D4AF37";
const BORDER = "rgba(212,175,55,0.3)";

const RANKS = [
  "Captain / Master", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer", "ETO / EEO",
  "Bosun", "AB Seaman", "Ordinary Seaman (OS)", "Fitter", "Oiler", "Wiper",
  "Cook", "Chief Cook", "Messman / Steward", "Deck Cadet", "Engine Cadet", "ETO Cadet", "Pumpman",
  "Electrician", "Refrigeration Engineer", "Radio Officer",
  "Trainee Officer (Deck)", "Trainee Officer (Engine)", "Trainee OS", "Trainee Cook",
];

const YEARS_BANDS = ["0–1", "2–4", "5–8", "9–14", "15+"];
const CONTRACT_BANDS = ["0", "1–2", "3–5", "6–10", "10+"];
const CONTRACT_LABEL = (b: string) => (b === "0" ? "0 — first contract" : b);

const SEA_BANDS = ["<2", "2–5", "6–10", "11–15", "15+"];
const FAMILY_TIME = ["<1", "1–3", "3–5", "5+ yr"];

const FAMILIES: { key: string; label: string }[] = [
  { key: "OIL_TANKER", label: "Oil Tanker" },
  { key: "CHEM_TANKER", label: "Chemical Tanker" },
  { key: "LPG", label: "LPG Carrier" },
  { key: "LNG", label: "LNG Carrier" },
  { key: "BULK", label: "Bulk Carrier" },
  { key: "CONTAINER", label: "Container" },
  { key: "GENERAL_CARGO", label: "General Cargo" },
  { key: "RORO_PAX", label: "RORO / Passenger" },
  { key: "PSV_OSV", label: "PSV / OSV" },
  { key: "AHTS", label: "Anchor Handling (AHTS)" },
  { key: "OTHER", label: "Other" },
];

const TANKER = ["OIL_TANKER", "CHEM_TANKER", "LPG", "LNG"];
const DRY = ["BULK", "GENERAL_CARGO", "CONTAINER", "RORO_PAX"];
const OFFSHORE = ["PSV_OSV", "AHTS"];

type Dept = "DECK" | "ENGINE" | "ETO" | "CATERING";

const deptOf = (rank: string): Dept => {
  const r = (rank || "").toLowerCase();
  if (/eto|electr/.test(r)) return "ETO";
  if (/engineer|motorman|oiler|fitter|wiper/.test(r)) return "ENGINE";
  if (/cook|steward|mess/.test(r)) return "CATERING";
  return "DECK";
};

const isRating = (rank: string) => !/officer|master|engineer|mate/i.test(rank || "");

/* ---------- shared UI ---------- */

const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      padding: "9px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
      background: on ? GOLD : "transparent", color: on ? NAVY : "#e5e7eb",
      border: `1px solid ${on ? GOLD : "rgba(148,163,184,0.35)"}`,
    }}
  >
    {label}
  </button>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
);

const Q = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
    <p style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700 }}>{title}</p>
    {children}
  </div>
);

const goldBtn: React.CSSProperties = {
  padding: "13px 18px", borderRadius: 12, cursor: "pointer",
  background: GOLD, color: NAVY, border: "none", fontWeight: 800, fontSize: 14, width: "100%",
};

const QuickProfile = () => {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  // step 1
  const [rank, setRank] = useState("");
  const [yearsBand, setYearsBand] = useState("");
  const [contractsBand, setContractsBand] = useState("");
  const [seaBand, setSeaBand] = useState("");
  const [available, setAvailable] = useState(false);
  const [availableFrom, setAvailableFrom] = useState("");

  // step 2
  const [families, setFamilies] = useState<Record<string, string>>({}); // family -> band (saved rows)
  const [pendingFamilies, setPendingFamilies] = useState<string[]>([]); // selected, awaiting sea time
  const [cadetSkipped, setCadetSkipped] = useState(false);


  // step 3
  const [claims, setClaims] = useState<Record<string, string>>({});

  const [matches, setMatches] = useState<number>(0);

  const selectedFamilies = useMemo(() => Object.keys(families), [families]);
  const hasTanker = selectedFamilies.some((f) => TANKER.includes(f));
  const hasDry = selectedFamilies.some((f) => DRY.includes(f));
  const hasOffshore = selectedFamilies.some((f) => OFFSHORE.includes(f));
  const dept = deptOf(rank);
  const rating = isRating(rank);

  /* ---------- load ---------- */
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) { navigate("/app"); return; }
      if (!active) return;
      setUid(user.id);

      const [{ data: prof }, { data: fam }, { data: cl }] = await Promise.all([
        supabase.from("crew_profiles")
          .select("first_name, rank, role, is_available, years_in_rank_band, contracts_in_rank_band, total_sea_service_band" as any)
          .eq("id", user.id).maybeSingle(),
        supabase.from("crew_vessel_experience" as any).select("vessel_family, sea_time_band").eq("crew_id", user.id),
        supabase.from("crew_claims" as any).select("claim_key, value").eq("crew_id", user.id),
      ]);

      if (!active) return;
      const p: any = prof || {};
      setFirstName(p.first_name || "Sailor");
      setRank(p.rank || p.role || "");
      setYearsBand(p.years_in_rank_band || "");
      setContractsBand(p.contracts_in_rank_band || "");
      setSeaBand(p.total_sea_service_band || "");
      setAvailable(!!p.is_available);
      const fmap: Record<string, string> = {};
      ((fam as any[]) || []).forEach((f) => { fmap[f.vessel_family] = f.sea_time_band; });
      setFamilies(fmap);
      const cmap: Record<string, string> = {};
      ((cl as any[]) || []).forEach((c) => { cmap[c.claim_key] = c.value; });
      setClaims(cmap);
      setReady(true);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- live vacancy counter ---------- */
  useEffect(() => {
    if (!ready) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("count_matching_vacancies" as any, {
          p_rank: rank || null,
          p_families: selectedFamilies,
        });
        if (active && typeof data === "number") setMatches(data);
      } catch { /* counter is decoration only */ }
    })();
    return () => { active = false; };
  }, [ready, rank, selectedFamilies.join(","), selectedFamilies]);

  /* ---------- savers (non-blocking) ---------- */
  const saveProfile = async (patch: Record<string, unknown>) => {
    if (!uid) return;
    try { await supabase.from("crew_profiles").update(patch as any).eq("id", uid); } catch { /* silent */ }
  };

  const setFamily = async (key: string, band: string) => {
    if (!uid) return;
    setFamilies((s) => ({ ...s, [key]: band }));
    try {
      await supabase.from("crew_vessel_experience" as any)
        .upsert({ crew_id: uid, vessel_family: key, sea_time_band: band } as any, { onConflict: "crew_id,vessel_family" });
    } catch { /* silent */ }
  };

  const toggleFamily = async (key: string) => {
    if (!uid) return;
    if (families[key] !== undefined) {
      setFamilies((s) => { const n = { ...s }; delete n[key]; return n; });
      try {
        await supabase.from("crew_vessel_experience" as any).delete().eq("crew_id", uid).eq("vessel_family", key);
      } catch { /* silent */ }
    } else {
      setFamily(key, FAMILY_TIME[0]);
    }
  };

  const setClaim = async (key: string, value: string) => {
    if (!uid) return;
    setClaims((s) => ({ ...s, [key]: value }));
    try {
      await supabase.from("crew_claims" as any)
        .upsert({ crew_id: uid, claim_key: key, value, updated_at: new Date().toISOString() } as any, { onConflict: "crew_id,claim_key" });
    } catch { /* silent */ }
  };

  const toggleMulti = (key: string, option: string) => {
    const cur = (claims[key] || "").split(",").map((s) => s.trim()).filter(Boolean);
    const next = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
    setClaim(key, next.join(","));
  };

  const hasMulti = (key: string, option: string) =>
    (claims[key] || "").split(",").map((s) => s.trim()).includes(option);

  const finish = async () => {
    await saveProfile({ quick_profile_completed_at: new Date().toISOString() });
    setDone(true);
  };

  const yesNo = (key: string, title: string) => (
    <Q key={key} title={title}>
      <Row>
        {["Yes", "No"].map((v) => (
          <Chip key={v} label={v} on={claims[key] === v} onClick={() => setClaim(key, v)} />
        ))}
      </Row>
    </Q>
  );

  const choice = (key: string, title: string, options: string[]) => (
    <Q key={key} title={title}>
      <Row>
        {options.map((v) => (
          <Chip key={v} label={v} on={claims[key] === v} onClick={() => setClaim(key, v)} />
        ))}
      </Row>
    </Q>
  );

  const multi = (key: string, title: string, options: string[]) => (
    <Q key={key} title={title}>
      <Row>
        {options.map((v) => (
          <Chip key={v} label={v} on={hasMulti(key, v)} onClick={() => toggleMulti(key, v)} />
        ))}
      </Row>
    </Q>
  );

  const step3Questions = () => {
    const out: React.ReactNode[] = [];
    if (dept === "DECK" && !rating) {
      out.push(yesNo("ecdis_experience", "ECDIS experience?"));
      if (claims.ecdis_experience === "Yes") {
        out.push(multi("ecdis_types", "Which ECDIS types?", ["Furuno", "JRC", "Wärtsilä/Transas", "Kongsberg", "Maris", "Other"]));
      }
      if (hasTanker) out.push(choice("sire_experience", "SIRE inspections attended?", ["0", "1–2", "3–5", "6+"]));
      if (hasDry) out.push(yesNo("rightship_experience", "RightShip inspection experience?"));
      out.push(choice("psc_experience", "Port State Control inspections attended?", ["None", "1–2", "3–5", "6+"]));
      if (hasOffshore) out.push(choice("dp_qualification", "DP qualification?", ["None", "Induction completed", "Simulator/Advanced completed", "DPO certified"]));
    } else if (dept === "DECK") {
      out.push(yesNo("watchkeeping_lookout", "Watchkeeping / lookout duties?"));
      out.push(yesNo("helmsman", "Helmsman experience?"));
      out.push(yesNo("mooring_experience", "Mooring station experience?"));
      out.push(yesNo("cargo_ops_watch", "Cargo operations watch?"));
      if (hasTanker) out.push(yesNo("tanker_deck_ops", "Tanker deck operations?"));
      if (selectedFamilies.some((f) => ["CONTAINER", "GENERAL_CARGO"].includes(f))) out.push(yesNo("lashing_securing", "Lashing & cargo securing?"));
      if (hasOffshore) out.push(yesNo("anchor_handling_deck", "Anchor handling deck work?"));
    } else if (dept === "ENGINE" && !rating) {
      out.push(multi("propulsion_experience", "Propulsion experience", ["2-stroke conventional", "2-stroke electronic", "Dual-fuel 2-stroke", "4-stroke", "DFDE", "Steam", "Other"]));
      out.push(yesNo("hv_certified", "High Voltage certified?"));
      out.push(yesNo("ums_experience", "UMS (unmanned engine room) experience?"));
      if (hasTanker) {
        out.push(choice("sire_experience", "SIRE inspections attended?", ["0", "1–2", "3+"]));
        out.push(multi("cargo_pumping_systems", "Cargo pumping systems", ["Framo", "Deepwell", "Steam turbine pumps", "Centrifugal", "Other/None"]));
      }
    } else if (dept === "ENGINE") {
      out.push(multi("propulsion_experience", "Propulsion experience", ["2-stroke", "4-stroke"]));
      out.push(yesNo("welding_machining", "Welding / machining skills?"));
      if (hasTanker) out.push(yesNo("tanker_engine_room", "Tanker engine room experience?"));
    } else if (dept === "ETO") {
      out.push(yesNo("hv_certified", "High Voltage certified?"));
      out.push(yesNo("dp_vessel_experience", "DP vessel experience?"));
      out.push(yesNo("hazardous_area_ex", "Hazardous area / Ex equipment experience?"));
      out.push(multi("automation_systems", "Automation systems worked with", ["Kongsberg", "Wärtsilä/SAM", "Praxis", "ABB", "Other"]));
    } else {
      out.push(choice("crew_size_cooked", "Crew size cooked for", ["<15", "15–25", "25+"]));
      out.push(yesNo("multicultural_menus", "Multicultural menus experience?"));
      out.push(yesNo("haccp_trained", "HACCP trained?"));
      if (/chief cook/i.test(rank)) out.push(yesNo("provisioning_budget", "Provisioning & budget responsibility?"));
    }
    return out;
  };

  const step1Done = !!rank && !!yearsBand && !!contractsBand && !!seaBand;
  const step2Done = selectedFamilies.length > 0;

  if (!ready) return <div style={{ minHeight: "100vh", background: NAVY }} />;

  const progress = done ? 100 : step === 1 ? 8 : step === 2 ? 45 : 78;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "14px 14px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "transparent", border: "none", color: GOLD, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: 0, alignSelf: "flex-start" }}
        >
          <ChevronLeft size={18} /> Back
        </button>

        <div>
          <h1 style={{ color: GOLD, fontSize: 21, fontWeight: 800 }}>Quick Sea Profile</h1>
          <p style={{ color: "#94A3B8", fontSize: 12 }}>All taps, no typing — about 2 minutes.</p>
        </div>

        {/* voyage progress */}
        <div style={{ position: "relative", height: 26 }}>
          <div style={{ position: "absolute", top: 16, left: 0, right: 0, borderTop: `2px dashed rgba(212,175,55,0.4)` }} />
          <div style={{ position: "absolute", top: 0, left: `calc(${progress}% - 12px)`, transition: "left .5s ease", fontSize: 18 }}>🚢</div>
        </div>

        {matches > 0 && !done && (
          <p style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>⚓ {matches} live vacancies match your profile</p>
        )}

        {done ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 40 }}>⚓</p>
            <p style={{ color: GOLD, fontSize: 19, fontWeight: 800 }}>Your Sea Profile is ready, {firstName}!</p>
            <p style={{ color: "#e5e7eb", fontSize: 13 }}>You can now apply for jobs and take your SeaMinds assessment.</p>
            <p style={{ color: "#94A3B8", fontSize: 12, lineHeight: 1.6 }}>
              Add your CV and certificates anytime to strengthen your profile and help companies evaluate you faster.
            </p>
            <button style={goldBtn} onClick={() => navigate("/app")}>See my matching jobs →</button>
            <button style={goldBtn} onClick={() => navigate("/app")}>Take the SMC Assessment →</button>
          </div>
        ) : step === 1 ? (
          <>
            <Q title="Your rank">
              <select
                value={rank}
                onChange={(e) => { setRank(e.target.value); saveProfile({ rank: e.target.value }); }}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, fontSize: 14 }}
              >
                <option value="">Select your rank</option>
                {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Q>

            <Q title="Years in this rank">
              <Row>
                {YEARS_BANDS.map((b) => (
                  <Chip key={b} label={b} on={yearsBand === b}
                    onClick={() => { setYearsBand(b); saveProfile({ years_in_rank_band: b }); }} />
                ))}
              </Row>
            </Q>

            <Q title="Contracts completed in this rank">
              <Row>
                {CONTRACT_BANDS.map((b) => (
                  <Chip key={b} label={b} on={contractsBand === b}
                    onClick={() => { setContractsBand(b); saveProfile({ contracts_in_rank_band: b }); }} />
                ))}
              </Row>
            </Q>

            <Q title="Total sea service (years)">
              <Row>
                {SEA_BANDS.map((b) => (
                  <Chip key={b} label={b} on={seaBand === b}
                    onClick={() => { setSeaBand(b); saveProfile({ total_sea_service_band: b }); }} />
                ))}
              </Row>
            </Q>

            <Q title="Available for work now?">
              <Row>
                <Chip label={available ? "Yes — available" : "Not available"} on={available}
                  onClick={() => { const v = !available; setAvailable(v); saveProfile({ is_available: v }); }} />
              </Row>
            </Q>

            <button
              style={{ ...goldBtn, opacity: step1Done ? 1 : 0.5 }}
              onClick={() => { if (!step1Done) return toast("Tap all four answers to continue"); setStep(2); }}
            >
              Continue →
            </button>
          </>
        ) : step === 2 ? (
          <>
            <p style={{ color: "#94A3B8", fontSize: 12 }}>Which vessels have you sailed on? Tap to select, then tap your sea time.</p>
            {FAMILIES.map((f) => {
              const on = families[f.key] !== undefined;
              return (
                <div key={f.key} style={{ background: CARD, border: `1px solid ${on ? GOLD : BORDER}`, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <Chip label={f.label} on={on} onClick={() => toggleFamily(f.key)} />
                  {on && (
                    <Row>
                      {FAMILY_TIME.map((t) => (
                        <Chip key={t} label={t} on={families[f.key] === t} onClick={() => setFamily(f.key, t)} />
                      ))}
                    </Row>
                  )}
                </div>
              );
            })}
            <button
              style={{ ...goldBtn, opacity: step2Done ? 1 : 0.5 }}
              onClick={() => { if (!step2Done) return toast("Select at least one vessel type"); setStep(3); }}
            >
              Continue →
            </button>
            <button onClick={() => setStep(1)} style={{ ...goldBtn, background: "transparent", color: GOLD, border: `1px solid ${GOLD}` }}>Back</button>
          </>
        ) : (
          <>
            <p style={{ color: "#94A3B8", fontSize: 12 }}>A few questions for your rank — all taps.</p>
            {step3Questions()}
            <button style={goldBtn} onClick={finish}>Finish my Sea Profile ⚓</button>
            <button onClick={() => setStep(2)} style={{ ...goldBtn, background: "transparent", color: GOLD, border: `1px solid ${GOLD}` }}>Back</button>
          </>
        )}
      </div>
    </div>
  );
};

export default QuickProfile;
