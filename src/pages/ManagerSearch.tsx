import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { generateCvPdf } from "@/lib/cvPdf";
import { resolveNationality, manningStatus, STATUS_META, type ManningStatus } from "@/lib/crewManning";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAVY = "#0D1B2A";
const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";


const RANKS = [
  "Captain / Master", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer", "ETO / EEO",
  "Bosun", "AB Seaman", "Ordinary Seaman (OS)", "Fitter", "Oiler", "Wiper",
  "Cook", "Messman / Steward", "Deck Cadet", "Engine Cadet", "ETO Cadet", "Pumpman",
  "Electrician", "Refrigeration Engineer", "Radio Officer",
  "Trainee Officer (Deck)", "Trainee Officer (Engine)", "Trainee OS", "Trainee Cook",
];

const VESSEL_TYPES = [
  "Bulk Carrier", "Container Ship", "Oil Tanker", "Chemical Tanker",
  "LNG Carrier", "LPG Carrier", "RORO", "General Cargo", "Offshore Supply Vessel",
  "Platform Supply Vessel", "Anchor Handling Vessel", "Passenger / Cruise Ship",
  "Dredger", "Tug / Towage", "Car Carrier", "Reefer", "Other",
];

const NATIONALITIES = [
  "Indian", "Filipino", "Indonesian", "Vietnamese", "Chinese", "Bangladeshi",
  "Pakistani", "Sri Lankan", "Myanmar", "Ukrainian", "Russian", "Romanian",
  "Polish", "Croatian", "Turkish", "Greek", "Egyptian", "Nigerian", "Ghanaian",
  "Brazilian", "British", "Other",
];

interface CrewResult {
  user_id: string;
  crewId?: string;
  cv_uid: string | null;
  name: string;
  rank: string;
  nationality: string;
  vessel_type: string;
  whatsapp_number: string | null;
  email?: string | null;
  is_available: boolean;
  available_from: string | null;
  years_at_sea: string | null;
  email_verified: boolean;
  whatsapp_verified: boolean;
  smc_score: number | null;
  smc_band: string | null;
  has_cv: boolean;
  years_in_rank_band?: string | null;
  contracts_in_rank_band?: string | null;
  total_sea_service_band?: string | null;
  quick_profile_done?: boolean;
  english_avg?: number | null;
  active_talks?: number;
  pipeline_status?: "open" | "in_talks" | "high_demand" | "offer_pending" | "paused";
  priority_boost?: boolean;
  is_unlocked?: boolean;
  placed_until?: string | null;
}

const RANK_PILLS: [string, string][] = [
  ["Master", "Captain / Master"], ["Ch Off", "Chief Officer"], ["2/O", "2nd Officer"], ["3/O", "3rd Officer"],
  ["C/E", "Chief Engineer"], ["2/E", "2nd Engineer"], ["3/E", "3rd Engineer"], ["ETO", "ETO / EEO"],
  ["Bosun", "Bosun"], ["AB", "AB Seaman"], ["Oiler", "Oiler"], ["Cook", "Cook"],
];
const VESSEL_PILLS: [string, string][] = [
  ["Oil Tanker", "Oil Tanker"], ["Chemical", "Chemical Tanker"], ["LNG", "LNG Carrier"], ["LPG", "LPG Carrier"],
  ["Bulk", "Bulk Carrier"], ["Container", "Container Ship"], ["Gen Cargo", "General Cargo"], ["Offshore", "Offshore Supply Vessel"],
];
const natOf = (r: CrewResult) => resolveNationality({
  nationality: r.nationality && r.nationality !== "—" ? r.nationality : null,
  whatsapp_number: r.whatsapp_number, email: r.email,
});
const statusOf = (r: CrewResult): ManningStatus => manningStatus({
  is_available: r.is_available, placed_until: r.placed_until, available_from: r.available_from,
});

const REFILL_MAILTO = "mailto:admin@seaminds.life?subject=Credit%20refill%20request";

const FAMILY_LABELS: Record<string, string> = {
  OIL_TANKER: "Oil Tanker", CHEM_TANKER: "Chemical Tanker", LPG: "LPG", LNG: "LNG",
  BULK: "Bulk Carrier", CONTAINER: "Container", GENERAL_CARGO: "General Cargo",
  RORO_PAX: "RoRo/Pax", PSV_OSV: "PSV/OSV", AHTS: "AHTS", OTHER: "Other",
};

const CLAIM_LABELS: Record<string, string> = {
  sire_experience: "SIRE", rightship_experience: "RightShip", psc_experience: "PSC",
  ecdis_experience: "ECDIS", ecdis_types: "ECDIS types", dp_qualification: "DP",
  mooring_experience: "Mooring", watchkeeping_lookout: "Watchkeeping", helmsman: "Helmsman",
  cargo_ops_watch: "Cargo watch", tanker_deck_ops: "Tanker deck ops",
  lashing_securing: "Lashing", anchor_handling_deck: "Anchor handling",
  propulsion_experience: "Propulsion", cargo_pumping_systems: "Cargo pumps",
  hv_certified: "HV certified", ums_experience: "UMS", welding_machining: "Welding",
  tanker_engine_room: "Tanker E/R", dp_vessel_experience: "DP vessel",
  hazardous_area_ex: "Ex equipment", automation_systems: "Automation",
  crew_size_cooked: "Crew size", multicultural_menus: "Multicultural menus",
  haccp_trained: "HACCP", provisioning_budget: "Provisioning",
};

function QuickProfileLine({ crewId, rank, bands }: {
  crewId: string;
  rank: string;
  bands: { years_in_rank_band?: string | null; contracts_in_rank_band?: string | null; total_sea_service_band?: string | null };
}) {
  const [claims, setClaims] = useState<any[]>([]);
  const [vessels, setVessels] = useState<any[]>([]);

  useEffect(() => { document.title = "SeaMinds Crew Search"; }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, v] = await Promise.all([
          supabase.from("crew_claims" as any).select("claim_key, value, status").eq("crew_id", crewId),
          supabase.from("crew_vessel_experience" as any).select("vessel_family, sea_time_band").eq("crew_id", crewId),
        ]);
        if (!alive) return;
        setClaims(Array.isArray(c.data) ? (c.data as any[]) : []);
        setVessels(Array.isArray(v.data) ? (v.data as any[]) : []);
      } catch { /* silently hidden */ }
    })();
    return () => { alive = false; };
  }, [crewId]);

  const skip = new Set(["no", "none", "0", ""]);
  const badges = claims
    .filter((c) => !skip.has(String(c?.value ?? "").trim().toLowerCase()))
    .slice(0, 5);
  const line1Parts = [
    rank,
    bands?.total_sea_service_band ? `${bands.total_sea_service_band} yrs sea` : null,
    bands?.years_in_rank_band ? `${bands.years_in_rank_band} yrs in rank` : null,
    bands?.contracts_in_rank_band ? `${bands.contracts_in_rank_band} contracts` : null,
  ].filter(Boolean);

  const hasBands = !!(bands?.total_sea_service_band || bands?.years_in_rank_band || bands?.contracts_in_rank_band);
  if (!hasBands && !badges.length && !vessels.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(212,175,55,0.15)", paddingTop: 8 }}>
      {hasBands && (
        <div style={{ fontSize: 11.5, color: "#cbd5e1" }}>{line1Parts.join(" · ")}</div>
      )}
      {!!badges.length && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {badges.map((c) => {
            const st = String(c.status || "CLAIMED");
            const color = st === "ASSESSED" ? GOLD : st === "VERIFIED" ? "#22c55e" : "#94A3B8";
            const tag = st === "ASSESSED" ? "✓ Assessed" : st === "VERIFIED" ? "✔ Verified" : "Claimed";
            const label = CLAIM_LABELS[c.claim_key] || String(c.claim_key).replace(/_/g, " ");
            return (
              <span key={c.claim_key} style={{
                fontSize: 10.5, color, border: `1px solid ${color}55`, borderRadius: 999,
                padding: "2px 7px", whiteSpace: "nowrap",
              }}>{label} — {tag}</span>
            );
          })}
        </div>
      )}
      {!!vessels.length && (
        <div style={{ fontSize: 11, color: "#94A3B8" }}>
          {vessels.map((v) => `${FAMILY_LABELS[v.vessel_family] || v.vessel_family} ${v.sea_time_band}y`).join(" · ")}
        </div>
      )}
    </div>
  );
}


const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, fontSize: 14,
};

const label: React.CSSProperties = {
  color: "#9CA3AF", fontSize: 11, textTransform: "uppercase",
  letterSpacing: 0.6, marginBottom: 6, display: "block",
};

const goldBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 8, cursor: "pointer",
  background: GOLD, color: NAVY, border: "none", fontWeight: 700, fontSize: 13,
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 8, cursor: "pointer",
  background: "transparent", color: GOLD, border: `1px solid ${GOLD}`,
  fontWeight: 600, fontSize: 13,
};

const callFn = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("manager-search", { body: payload });
  let payloadData: any = data;
  if (error && (error as any).context?.json) {
    try { payloadData = await (error as any).context.json(); } catch { /* ignore */ }
  }
  if (payloadData?.pending_approval) {
    const err: any = new Error(payloadData.error || "Awaiting approval");
    err.pendingApproval = true;
    throw err;
  }
  if (payloadData?.error === "reveal_required") {
    const err: any = new Error(payloadData.message || "Reveal this seafarer contact first to open the full CV.");
    err.revealRequired = true;
    throw err;
  }
  if (error) throw new Error(error.message || "Could not reach the crew directory");
  if (!payloadData?.success) throw new Error(payloadData?.error || "Request failed");
  return payloadData;
};

const isAuthError = (msg: string) => /sign in|not registered|session/i.test(msg || "");


const ManagerSearch = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [rank, setRank] = useState(() => {
    const r = new URLSearchParams(window.location.search).get("rank") || "";
    return RANKS.includes(r) ? r : "";
  });
  const [nationality, setNationality] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [availability, setAvailability] = useState<"all" | "available">("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [minScore, setMinScore] = useState("");
  const [minEnglish, setMinEnglish] = useState("");
  const [results, setResults] = useState<CrewResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [revealBusy, setRevealBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"find" | "roster">("find");
  const [view, setView] = useState<"table" | "cards">(() => (window.innerWidth >= 900 ? "table" : "cards"));
  const [natPick, setNatPick] = useState("");
  const [statusPick, setStatusPick] = useState<ManningStatus | "">("");
  const [quick, setQuick] = useState<CrewResult | null>(null);
  const [confirmRow, setConfirmRow] = useState<CrewResult | null>(null);
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, { email: string | null; whatsapp: string | null }>>({});

  // Platform is free during the growth phase: access is gated by admin approval only (server-enforced).
  const subscribed = true;

  const loadBalance = async () => {
    const { data } = await supabase.rpc("get_my_credit_balance" as any);
    const bal = (data as any)?.balance;
    if (typeof bal === "number") { setBalance(bal); return bal; }
    setBalance(0);
    return 0;
  };

  const search = async (bypassGate = false, which: "find" | "roster" = tab) => {
    if (!bypassGate && !subscribed) { setPlanOpen(true); return; }

    setLoading(true);
    try {
      const data = await callFn({
        action: which === "roster" ? "unlocked" : "search",
        filters: { rank, nationality, vesselType, availability, minScore, minEnglish },
        page: 0,
        pageSize: 50,
      });

      setResults(data.results || []);
      setTotal(data.total ?? (data.results || []).length);
      if (which === "roster") setRosterCount(data.total ?? (data.results || []).length);
      setPage(0);
      setPending(false);
      setSearched(true);
    } catch (e: any) {
      if (e?.pendingApproval) { setPending(true); setResults([]); setSearched(true); return; }
      const msg = e?.message || "Search failed";
      if (isAuthError(msg)) { navigate("/manager"); return; }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const data = await callFn({
        action: tab === "roster" ? "unlocked" : "search",
        filters: { rank, nationality, vesselType, availability, minScore, minEnglish },
        page: next,
        pageSize: 50,
      });
      setResults((prev) => [...prev, ...((data.results || []) as CrewResult[])]);
      setTotal(data.total ?? total);
      setPage(next);
    } catch (e: any) {
      toast.error(e?.message || "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const revealContact = async (row: CrewResult) => {
    const crewId = row.crewId || row.user_id;
    setRevealBusy(crewId);
    try {
      const { data, error } = await supabase.rpc("reveal_contact" as any, { p_crew_id: crewId });
      if (error) { toast.error(error.message); return; }
      const res: any = data;
      if (res?.ok) {
        setRevealed((prev) => ({ ...prev, [crewId]: { email: res.email ?? null, whatsapp: res.whatsapp ?? null } }));
        const patch = (x: CrewResult) => (x.crewId || x.user_id) === crewId
          ? { ...x, is_unlocked: true, email: res.email ?? x.email, whatsapp_number: res.whatsapp ?? x.whatsapp_number } : x;
        setResults((prev) => prev.map(patch));
        setQuick((q) => (q ? patch(q) : q));
        if (res.charged) setRosterCount((n) => (n == null ? n : n + 1));
        if (typeof res.balance === "number") setBalance(res.balance);
        toast.success(res.charged ? "Unlocked — added to My Unlocked Candidates" : "Already in your roster — no credit used");
      } else if (res?.error === "no_credits") {
        toast.error("Monthly reveal limit reached", {
          description: "Ask SeaMinds Admin to extend your free access.",
          action: { label: "Email admin", onClick: () => window.open(REFILL_MAILTO) },
        });
      } else {
        toast.error(res?.error || "Could not reveal contact");
      }
    } finally {
      setRevealBusy(null);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data?.user) { navigate("/manager"); return; }
      setReady(true);
      await loadBalance();
      if (!active) return;
      search(true);
      callFn({ action: "unlocked", filters: {}, page: 0, pageSize: 1 })
        .then((d) => active && setRosterCount(d.total ?? 0)).catch(() => {});
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const viewFullCv = async (row: CrewResult) => {
    setPdfBusy(row.user_id);
    try {
      const data = await callFn({ action: "cv", userId: row.user_id });

      if (!data.cv) {
        toast.error("This crew member has not built a CV yet");
        return;
      }
      await generateCvPdf({
        name: row.name,
        cvUid: row.cv_uid || undefined,
        rank: row.rank,
        nationality: row.nationality,
        email: data.profile?.email,
        whatsapp: row.whatsapp_number || undefined,
        cv: data.cv,
        footer: `SeaMinds Manager Crew Search • ${new Date().toLocaleString()}`,
      });
    } catch (e: any) {
      if (e?.pendingApproval) { setPending(true); return; }
      if (e?.revealRequired) {
        toast.error("Reveal required", {
          description: "Tap Reveal contact on this seafarer to open the full CV.",
        });
        return;
      }
      const msg = e?.message || "Could not generate CV PDF";
      if (isAuthError(msg)) { navigate("/manager"); return; }
      toast.error(msg);
    } finally {
      setPdfBusy(null);
    }
  };


  const contactWhatsApp = (row: CrewResult) => {
    const crewId = row.crewId || row.user_id;
    const revealedWa = revealed[crewId]?.whatsapp || (row.is_unlocked ? row.whatsapp_number : null);
    if (!revealedWa) return toast.error("Reveal the contact first");
    const digits = revealedWa.replace(/[^\d]/g, "");
    if (!digits) return toast.error("No WhatsApp number on file");
    const msg = encodeURIComponent(
      `Hello ${row.name}, we found your SeaMinds profile (${row.cv_uid || "CV"}) and would like to discuss a ${row.rank} opportunity.`,
    );
    window.open(`https://wa.me/${digits}?text=${msg}`, "_blank");
  };

  // Rank / vessel pills and tab switches re-query the server immediately.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (ready) search(true, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rank, vesselType, tab, availability]);

  const askUnlock = (r: CrewResult) => {
    if (r.is_unlocked || revealed[r.crewId || r.user_id]) { revealContact(r); return; }
    setConfirmRow(r);
  };

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "24px 16px" }}>
      {planOpen && (
        <div
          onClick={() => setPlanOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(5,10,20,0.78)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: CARD, border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 16, padding: 22, maxWidth: 420, width: "100%" }}
          >
            <p style={{ fontSize: 30, marginBottom: 8 }}>🔐</p>
            <h2 style={{ color: GOLD, fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Subscription required</h2>
            <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              Searching seafarers and filtering by nationality is part of the company plan.
              Subscribe to reach our five-star verified maritime network with assessed competency profiles.
            </p>
            <ul style={{ color: "#94A3B8", fontSize: 12.5, lineHeight: 1.8, marginBottom: 16, paddingLeft: 16 }}>
              <li>Full crew search by rank, vessel, nationality and availability</li>
              <li>Verified Sea Profiles and SeaMinds Score</li>
              <li>Direct contact once approved</li>
            </ul>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => navigate("/pricing")} style={{ ...goldBtn, borderRadius: 12, padding: "12px 16px" }}>
                View subscription plans
              </button>
              <a
                href="mailto:admin@seaminds.life?subject=SeaMinds%20company%20subscription"
                style={{ ...ghostBtn, borderRadius: 12, padding: "12px 16px", textAlign: "center", textDecoration: "none" }}
              >
                Talk to our team
              </a>
              <button
                onClick={() => setPlanOpen(false)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", fontSize: 12, cursor: "pointer", padding: 4 }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/manager/dashboard"); }}
              style={{ background: "transparent", border: "none", color: GOLD, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: 0 }}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <div>
              <h1 style={{ color: GOLD, fontSize: 22, fontWeight: 700 }}>Crew Search</h1>
              <p style={{ color: "#9CA3AF", fontSize: 13 }}>
                {searched ? "★★★★★ Verified matches · totals remain private" : "★★★★★ Verified maritime network"}
              </p>
            </div>
          </div>
        </header>

        {pending ? (
        <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 14, padding: 20, textAlign: "center", maxWidth: 460, margin: "40px auto" }}>
          <p style={{ fontSize: 34, marginBottom: 10 }}>🔒</p>
          <p style={{ color: GOLD, fontSize: 16, fontWeight: 800, marginBottom: 8 }}>This feature needs approval</p>
          <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            To protect seafarers' personal data, SeaMinds Admin verifies every company before opening Crew Search.
            Access is free for verified ship managers and manning agencies.
          </p>
          <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
            You can still post vacancies, create company posts and arrange interviews while you wait.
          </p>
          <a href="mailto:admin@seaminds.life?subject=Crew%20Search%20access%20approval%20request&body=Company%20name%3A%0AYour%20name%3A%0APhone%2FWhatsApp%3A%0A"
            style={{ display: "inline-block", marginTop: 16, background: "#D4AF37", color: "#0D1B2A", borderRadius: 10, padding: "11px 20px", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            Request approval by email
          </a>
        </div>
        ) : (
        <>
        {/* Workspace tabs + wallet */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 4 }}>
            {([["find", "🔍 Find New Crew"], ["roster", `📂 My Unlocked Candidates${rosterCount != null ? ` (${rosterCount})` : ""}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setTab(k); setNatPick(""); setStatusPick(""); }}
                style={{ padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                  background: tab === k ? GOLD : "transparent", color: tab === k ? NAVY : "#cbd5e1" }}>{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: GOLD, fontWeight: 800, fontSize: 13, border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 999, padding: "6px 12px" }}>
              🪙 {balance ?? "…"} credits
            </span>
            <button onClick={() => navigate("/manager/credits")} style={{ ...ghostBtn, padding: "6px 12px", borderRadius: 999 }}>Refill</button>
          </div>
        </div>
        <p style={{ color: "#94A3B8", fontSize: 12, marginTop: -8 }}>
          {tab === "find"
            ? "Browsing and Quick CV are free. Unlocking contact + full CV costs 1 credit, once per seafarer — never charged twice."
            : "Crew you have already unlocked. Contacts and full CVs stay open for you at no extra cost."}
        </p>

        {/* Manning filter ribbon */}
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {(() => {
            const pill = (on: boolean, color = GOLD): React.CSSProperties => ({
              padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${on ? color : "rgba(212,175,55,0.3)"}`, background: on ? color : "transparent", color: on ? NAVY : "#cbd5e1",
            });
            const natCounts: Record<string, { n: number; flag: string }> = {};
            results.forEach((r) => { const x = natOf(r); (natCounts[x.name] ||= { n: 0, flag: x.flag }).n++; });
            const nats = Object.entries(natCounts).sort((a, b) => b[1].n - a[1].n);
            const stCounts: Record<string, number> = {};
            results.filter((r) => !natPick || natOf(r).name === natPick).forEach((r) => { const k = statusOf(r); stCounts[k] = (stCounts[k] || 0) + 1; });
            const row = (t: string, children: React.ReactNode) => (
              <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", paddingBottom: 2 }}>
                <span style={{ ...label, marginBottom: 0, minWidth: 74 }}>{t}</span>{children}
              </div>
            );
            return (<>
              {row("⚓ Rank", <>
                <button style={pill(!rank)} onClick={() => setRank("")}>All</button>
                {RANK_PILLS.map(([s, v]) => <button key={v} style={pill(rank === v)} onClick={() => setRank(rank === v ? "" : v)}>{s}</button>)}
                <select value={RANK_PILLS.some(([, v]) => v === rank) ? "" : rank} onChange={(e) => setRank(e.target.value)} style={{ ...input, width: 150, padding: "5px 8px", fontSize: 12 }}>
                  <option value="">More ranks…</option>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </>)}
              {row("🚢 Vessel", <>
                <button style={pill(!vesselType)} onClick={() => setVesselType("")}>All</button>
                {VESSEL_PILLS.map(([s, v]) => <button key={v} style={pill(vesselType === v)} onClick={() => setVesselType(vesselType === v ? "" : v)}>{s}</button>)}
              </>)}
              {row("🌍 Nationality", <>
                <button style={pill(!natPick)} onClick={() => setNatPick("")}>All ({results.length})</button>
                {nats.map(([n, x]) => <button key={n} style={pill(natPick === n)} onClick={() => setNatPick(natPick === n ? "" : n)}>{x.flag} {n} ({x.n})</button>)}
              </>)}
              {row("🟢 Status", <>
                <button style={pill(!statusPick)} onClick={() => setStatusPick("")}>All</button>
                {(Object.keys(STATUS_META) as ManningStatus[]).map((k) => (
                  <button key={k} style={pill(statusPick === k, STATUS_META[k].color)} onClick={() => setStatusPick(statusPick === k ? "" : k)}>
                    {STATUS_META[k].label} ({stCounts[k] || 0})
                  </button>
                ))}
                <button style={pill(freeOnly, "#22c55e")} onClick={() => setFreeOnly(!freeOnly)}>Not in other talks</button>
              </>)}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {tab === "find" && (
                  <select value={availability} onChange={(e) => setAvailability(e.target.value as any)} style={{ ...input, width: 170, padding: "6px 8px", fontSize: 12 }}>
                    <option value="all">All crew (incl. on board)</option>
                    <option value="available">Available now only</option>
                  </select>
                )}
                <select value={minScore} onChange={(e) => setMinScore(e.target.value)} style={{ ...input, width: 170, padding: "6px 8px", fontSize: 12 }}>
                  <option value="">Any competency score</option>
                  <option value="4">Score 4.00+</option>
                  <option value="3.5">Score 3.50+</option>
                  <option value="3">Score 3.00+</option>
                </select>
                <select value={minEnglish} onChange={(e) => setMinEnglish(e.target.value)} style={{ ...input, width: 170, padding: "6px 8px", fontSize: 12 }}>
                  <option value="">Any English level</option>
                  <option value="85">English 85%+</option>
                  <option value="70">English 70%+</option>
                  <option value="50">English 50%+</option>
                </select>
                <button onClick={() => search()} disabled={loading} style={{ ...goldBtn, padding: "7px 14px", opacity: loading ? 0.6 : 1 }}>{loading ? "Searching…" : "Apply"}</button>
                <button onClick={() => { setRank(""); setVesselType(""); setNatPick(""); setStatusPick(""); setFreeOnly(false); setMinScore(""); setMinEnglish(""); setAvailability("all"); }} style={{ ...ghostBtn, padding: "7px 12px" }}>Clear</button>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {(["table", "cards"] as const).map((v) => (
                    <button key={v} onClick={() => setView(v)} style={pill(view === v)}>{v === "table" ? "☷ Table" : "⊞ Cards"}</button>
                  ))}
                </div>
              </div>
            </>);
          })()}
        </div>

        {(() => {
          const shown = results.filter((r) =>
            (!freeOnly || (r.pipeline_status || "open") === "open")
            && (!natPick || natOf(r).name === natPick)
            && (!statusPick || statusOf(r) === statusPick));
          const unlockedOf = (r: CrewResult) => !!(r.is_unlocked || revealed[r.crewId || r.user_id]);
          const statusChip = (r: CrewResult) => { const m = STATUS_META[statusOf(r)]; return <span style={{ color: m.color, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>● {m.label}</span>; };
          const unlockBtn = (r: CrewResult, compact = false) => unlockedOf(r)
            ? <button onClick={() => contactWhatsApp(r)} style={{ ...goldBtn, padding: compact ? "5px 10px" : "8px 10px", fontSize: 12 }}>💬 WhatsApp</button>
            : <button onClick={() => askUnlock(r)} disabled={revealBusy === (r.crewId || r.user_id)} style={{ ...goldBtn, padding: compact ? "5px 10px" : "8px 10px", fontSize: 12 }}>🔓 Unlock · 1 cr</button>;
          if (!loading && searched && shown.length === 0) return (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: "center", color: "#94A3B8" }}>
              {tab === "roster" ? "You haven't unlocked any crew yet. Use Find New Crew, open a Quick CV and unlock the right candidate." : "No crew match these filters."}
            </div>
          );
          if (view === "table") return (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
                <thead><tr style={{ color: "#94A3B8", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
                  {["Seafarer", "Rank", "Nationality", "Experience", "Vessel", "Score / English", "Status", "Pipeline", ""].map((h) => <th key={h} style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {shown.map((r) => { const n = natOf(r); const s = r.pipeline_status || "open"; return (
                    <tr key={r.user_id} onClick={() => setQuick(r)} style={{ cursor: "pointer", borderBottom: `1px solid ${BORDER}`, color: "#e5e7eb" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700 }}>{r.priority_boost && <span title="Priority berth seeker">⚡ </span>}{r.name}</div>
                        <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 11 }}>{r.cv_uid || "ID pending"} {unlockedOf(r) && <span style={{ color: "#22c55e" }}>· ✓ In your roster</span>}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>{r.rank}</td>
                      <td style={{ padding: "10px 12px" }}>{n.flag} {n.name}{n.source !== "declared" && n.source !== "none" && <span style={{ color: "#64748b", fontSize: 10 }}> (auto)</span>}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>{[r.total_sea_service_band && `${r.total_sea_service_band}y sea`, r.years_in_rank_band && `${r.years_in_rank_band}y rank`].filter(Boolean).join(" · ") || r.years_at_sea || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>{r.vessel_type}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: GOLD }}>{r.smc_score != null ? r.smc_score : "—"} / {r.english_avg != null ? `${r.english_avg}%` : "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{statusChip(r)}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: s === "open" ? "#22c55e" : "#f59e0b" }}>{s === "open" ? "Free" : s === "paused" ? "Paused" : s === "offer_pending" ? "Offer pending" : `${r.active_talks} in talks`}</td>
                      <td style={{ padding: "10px 12px" }} onClick={(e) => e.stopPropagation()}>{unlockBtn(r, true)}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          );
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {shown.map((r) => { const n = natOf(r); return (
                <article key={r.user_id} onClick={() => setQuick(r)} style={{ cursor: "pointer", background: CARD, border: `1px solid ${unlockedOf(r) ? "#22c55e66" : BORDER}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {r.priority_boost && <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, background: GOLD, borderRadius: 8, padding: "3px 8px" }}>⚡ PRIORITY BERTH SEEKER</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700 }}>{r.name}</div>
                      <div style={{ color: GOLD, fontSize: 12 }}>{r.rank} · {n.flag} {n.name}</div>
                    </div>
                    {statusChip(r)}
                  </div>
                  <div style={{ color: "#94A3B8", fontSize: 12 }}>{r.vessel_type} · {r.total_sea_service_band ? `${r.total_sea_service_band}y sea` : "sea time on CV"}</div>
                  {unlockedOf(r) && <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>✓ In your roster · {r.whatsapp_number || r.email || "contact on CV"}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setQuick(r)} style={{ ...ghostBtn, flex: 1, padding: "8px 10px", fontSize: 12 }}>Quick CV</button>
                    <div style={{ flex: 1, display: "flex" }}>{unlockBtn(r)}</div>
                  </div>
                </article>
              ); })}
            </div>
          );
        })()}

        {total > results.length && results.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button onClick={loadMore} disabled={loadingMore} style={{ ...ghostBtn, opacity: loadingMore ? 0.6 : 1 }}>
              {loadingMore ? "Loading…" : "Load more verified profiles"}
            </button>
          </div>
        )}

        {/* Quick CV drawer — free need-to-know screening */}
        <Sheet open={!!quick} onOpenChange={(o) => !o && setQuick(null)}>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" style={{ background: NAVY, borderColor: "rgba(212,175,55,0.3)", color: "#e5e7eb" }}>
            {quick && (() => { const r = quick; const n = natOf(r); const un = !!(r.is_unlocked || revealed[r.crewId || r.user_id]); const rv = revealed[r.crewId || r.user_id]; return (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SheetHeader>
                  <SheetTitle style={{ color: GOLD }}>Quick CV</SheetTitle>
                </SheetHeader>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{r.name}</div>
                  <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 12 }}>{r.cv_uid || "ID pending"}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
                    <span>{r.rank}</span><span>{n.flag} {n.name}</span>{(() => { const m = STATUS_META[statusOf(r)]; return <span style={{ color: m.color, fontWeight: 700 }}>● {m.label}</span>; })()}
                  </div>
                  {r.available_from && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Available from {new Date(r.available_from).toLocaleDateString()}</div>}
                </div>
                <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, background: CARD, borderRadius: 10, padding: 12 }}>
                  <div><dt style={{ color: "#94A3B8" }}>Total sea time</dt><dd>{r.total_sea_service_band ? `${r.total_sea_service_band} yrs` : r.years_at_sea || "—"}</dd></div>
                  <div><dt style={{ color: "#94A3B8" }}>Time in rank</dt><dd>{r.years_in_rank_band ? `${r.years_in_rank_band} yrs` : "—"}</dd></div>
                  <div><dt style={{ color: "#94A3B8" }}>Contracts in rank</dt><dd>{r.contracts_in_rank_band || "—"}</dd></div>
                  <div><dt style={{ color: "#94A3B8" }}>Vessel type</dt><dd>{r.vessel_type}</dd></div>
                  <div><dt style={{ color: "#94A3B8" }}>Competency Score</dt><dd style={{ color: GOLD, fontWeight: 700 }}>{r.smc_score != null ? `${r.smc_score}${r.smc_band ? ` · ${r.smc_band}` : ""}` : "Not assessed"}</dd></div>
                  <div><dt style={{ color: "#94A3B8" }}>Maritime English</dt><dd style={{ color: GOLD, fontWeight: 700 }}>{r.english_avg != null ? `${r.english_avg}%` : "No practice yet"}</dd></div>
                </dl>
                <QuickProfileLine crewId={r.crewId || r.user_id} rank={r.rank} bands={{ years_in_rank_band: r.years_in_rank_band, contracts_in_rank_band: r.contracts_in_rank_band, total_sea_service_band: r.total_sea_service_band }} />
                <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                  {r.email_verified && "✅ Email verified  "}{r.whatsapp_verified && "🟢 WhatsApp verified  "}{!r.has_cv && <span style={{ color: "#f59e0b" }}>No full CV built yet</span>}
                </div>
                <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 10, padding: 12, fontSize: 12, fontFamily: "monospace" }}>
                  <div>📧 {rv?.email ?? r.email ?? "•••••"}</div>
                  <div>📱 {rv?.whatsapp ?? r.whatsapp_number ?? "•••••"}</div>
                  {!un && <div style={{ color: "#94A3B8", fontFamily: "inherit", marginTop: 6 }}>Unlock once (1 credit) to see contact and full CV — it stays open for you forever.</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {un ? (<>
                    <button onClick={() => contactWhatsApp(r)} style={goldBtn}>💬 Contact via WhatsApp</button>
                    <button onClick={() => viewFullCv(r)} disabled={pdfBusy === r.user_id} style={ghostBtn}>{pdfBusy === r.user_id ? "Preparing…" : "📄 Download full CV (free — already unlocked)"}</button>
                  </>) : (
                    <button onClick={() => askUnlock(r)} style={goldBtn}>🔓 Unlock contact & full CV · 1 credit</button>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#64748b" }}>Wellness and private chat data are never shared with companies.</p>
              </div>
            ); })()}
          </SheetContent>
        </Sheet>

        {/* Unlock confirmation */}
        {confirmRow && (
          <div onClick={() => setConfirmRow(null)} style={{ position: "fixed", inset: 0, background: "rgba(5,10,20,0.78)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, border: "1px solid rgba(212,175,55,0.3)", borderRadius: 16, padding: 20, maxWidth: 400, width: "100%" }}>
              <h2 style={{ color: GOLD, fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Unlock {confirmRow.name}?</h2>
              <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                {confirmRow.rank} · {natOf(confirmRow).name}. You will see their WhatsApp, email and full CV, and they join <b>My Unlocked Candidates</b> permanently — you will never be charged for them again.
              </p>
              <div style={{ margin: "12px 0", fontSize: 13, color: "#e5e7eb", background: NAVY, borderRadius: 10, padding: 10 }}>
                Cost: <b style={{ color: GOLD }}>1 credit</b> · Balance after: <b>{balance != null ? Math.max(0, balance - 1) : "…"}</b>
              </div>
              {balance != null && balance < 1 ? (
                <button onClick={() => window.open(REFILL_MAILTO)} style={{ ...goldBtn, width: "100%" }}>Not enough credits — request refill</button>
              ) : (
                <button onClick={() => { const r = confirmRow; setConfirmRow(null); revealContact(r); }} style={{ ...goldBtn, width: "100%", borderRadius: 12 }}>Confirm unlock · 1 credit</button>
              )}
              <button onClick={() => setConfirmRow(null)} style={{ background: "transparent", border: "none", color: "#94A3B8", width: "100%", marginTop: 8, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default ManagerSearch;
