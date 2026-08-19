import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n";

const NAVY = "#0D1B2A";
const PANEL = "#112240";
const GOLD = "#D4AF37";
const GREEN = "#22c55e";
const BORDER = "rgba(212,175,55,0.3)";

const RANKS = ["Master", "C/O", "2/O", "3/O", "C/E", "2/E", "3/E", "4/E", "ETO", "Bosun", "AB", "Cook", "Other"];

const RANK_TERMS: Record<string, string[]> = {
  Master: ["master", "captain"],
  "C/O": ["chief officer", "c/o", "chief mate"],
  "2/O": ["2nd officer", "second officer", "2/o"],
  "3/O": ["3rd officer", "third officer", "3/o"],
  "C/E": ["chief engineer", "c/e"],
  "2/E": ["2nd engineer", "second engineer", "2/e"],
  "3/E": ["3rd engineer", "third engineer", "3/e"],
  "4/E": ["4th engineer", "fourth engineer", "4/e"],
  ETO: ["eto", "electro", "electrician"],
  Bosun: ["bosun", "boatswain"],
  AB: ["able seaman", "ab seaman", "ab"],
  Cook: ["cook", "chef", "steward"],
  Other: [],
};

const VESSELS = ["LNG", "LPG", "Oil Tanker", "Chemical", "Bulk", "Container", "General Cargo", "Offshore/OSV", "RoRo/Pax"];

const VESSEL_TERMS: Record<string, string[]> = {
  LNG: ["lng"],
  LPG: ["lpg"],
  "Oil Tanker": ["oil", "crude", "product tanker"],
  Chemical: ["chemical"],
  Bulk: ["bulk"],
  Container: ["container"],
  "General Cargo": ["general cargo", "multipurpose"],
  "Offshore/OSV": ["offshore", "osv", "psv", "ahts", "rig"],
  "RoRo/Pax": ["roro", "ro-ro", "passenger", "ferry", "cruise"],
};

// Maps this page's vessel labels to QuickProfile vessel_family keys
const VESSEL_FAMILY: Record<string, string> = {
  LNG: "LNG",
  LPG: "LPG",
  "Oil Tanker": "OIL_TANKER",
  Chemical: "CHEM_TANKER",
  Bulk: "BULK",
  Container: "CONTAINER",
  "General Cargo": "GENERAL_CARGO",
  "Offshore/OSV": "PSV_OSV",
  "RoRo/Pax": "RORO_PAX",
};

const AVAILABILITY = [
  { key: "Now", tk: "psAvailNow" },
  { key: "7 days", tk: "psAvail7" },
  { key: "30 days", tk: "psAvail30" },
  { key: "Later", tk: "psAvailLater" },
] as const;

const orFilter = (col: string, terms: string[]) => terms.map((t) => `${col}.ilike.%${t}%`).join(",");

const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className="rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors"
    style={{
      border: `1px solid ${on ? GOLD : "rgba(255,255,255,0.12)"}`,
      background: on ? GOLD : "transparent",
      color: on ? NAVY : "#E2E8F0",
    }}
  >
    {label}
  </button>
);

const ProfileStart = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t } = useT();

  const [step, setStep] = useState(1);
  const [rank, setRank] = useState("");
  const [vessels, setVessels] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");
  const [counts, setCounts] = useState<{ rank: number; vessel: number; new24: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-select rank passed from "Matching now" chips
  useEffect(() => {
    const r = params.get("rank");
    if (!r) return;
    const low = r.toLowerCase();
    const hit = RANKS.find((k) => (RANK_TERMS[k] || []).some((t) => low.includes(t)));
    if (hit) setRank(hit);
  }, [params]);

  const toggleVessel = (v: string) =>
    setVessels((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const finish = async (avail: string) => {
    setAvailability(avail);
    localStorage.setItem(
      "sm_prestart",
      JSON.stringify({ rank, vessels, families: vessels.map((v) => VESSEL_FAMILY[v]).filter(Boolean), availability: avail, at: Date.now() })
    );
    setStep(4);
    setLoading(true);

    const nowIso = new Date().toISOString();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const rankTerms = RANK_TERMS[rank] || [];
    const vesselTerms = vessels.flatMap((v) => VESSEL_TERMS[v] || []);

    const base = () =>
      supabase.from("external_vacancies").select("id", { count: "exact", head: true }).gt("expires_at", nowIso);

    try {
      const rankQ = rankTerms.length ? base().or(orFilter("rank_required", rankTerms)) : base();
      const vesselQ = vesselTerms.length ? base().or(orFilter("vessel_type", vesselTerms)) : base();
      const newQ = rankTerms.length
        ? base().gt("first_seen_at", dayAgo).or(orFilter("rank_required", rankTerms))
        : base().gt("first_seen_at", dayAgo);

      const [r1, r2, r3] = await Promise.all([rankQ, vesselQ, newQ]);
      setCounts({ rank: r1.count || 0, vessel: r2.count || 0, new24: r3.count || 0 });
    } catch {
      setCounts({ rank: 0, vessel: 0, new24: 0 });
    }
    setLoading(false);
  };

  const anyLive = !!counts && counts.rank + counts.vessel + counts.new24 > 0;

  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      <Helmet>
        <title>Start Your Sea Profile — Maritime Jobs | SeaMinds</title>
        <meta name="description" content="Three taps to see how active your maritime market is: pick your rank, vessel types and availability, then activate your free Sea Profile." />
      </Helmet>

      <header className="flex items-center gap-2 px-4 h-14 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <button type="button" aria-label={t("back")} onClick={() => (step > 1 && step < 4 ? setStep(step - 1) : navigate("/"))}>
          <ChevronLeft className="w-6 h-6" style={{ color: GOLD }} />
        </button>
        <span className="text-sm font-bold text-foreground">{t("psTitle")}</span>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        {step < 4 && (
          <p className="font-mono text-[11px] text-muted-foreground mb-4">{t("psStep")} {step} {t("psOf")} 3</p>
        )}

        {step === 1 && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">{t("psQ1")}</h1>
            <div className="flex flex-wrap gap-2">
              {RANKS.map((r) => (
                <Chip key={r} on={rank === r} label={r} onClick={() => { setRank(r); setStep(2); }} />
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">{t("psQ2")}</h1>
            <div className="flex flex-wrap gap-2 mb-6">
              {VESSELS.map((v) => (
                <Chip key={v} on={vessels.includes(v)} label={v} onClick={() => toggleVessel(v)} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full rounded-xl h-12 font-bold"
              style={{ background: GOLD, color: NAVY }}
            >
              {t("continue")}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">{t("psQ3")}</h1>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY.map((a) => (
                <Chip key={a.key} on={availability === a.key} label={t(a.tk)} onClick={() => finish(a.key)} />
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <div className="rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
            <h1 className="text-xl font-bold mb-3" style={{ color: GOLD }}>{t("psRewardTitle")}</h1>

            {loading && <p className="text-xs text-muted-foreground mb-4">{t("psChecking")}</p>}

            {!loading && counts && (
              anyLive ? (
                <div className="space-y-1.5 mb-5 font-mono text-sm">
                  {rank && <p className="text-foreground">{counts.rank} {t("psLiveFor")} <span style={{ color: GOLD }}>{rank}</span></p>}
                  {vessels.length > 0 && <p className="text-foreground">{counts.vessel} {t("psOnVessels")}</p>}
                  <p style={{ color: GREEN }}>+{counts.new24} {t("psAddedIn24h")}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-5">{t("psQuiet")}</p>
              )
            )}

            <button
              type="button"
              onClick={() => navigate("/join?next=%2Fquick-profile")}
              className="w-full rounded-xl h-12 font-bold mb-3"
              style={{ background: GOLD, color: NAVY }}
            >
              {t("psActivate")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/app?tab=jobs")}
              className="w-full rounded-xl h-12 font-bold"
              style={{ border: `1px solid ${GOLD}`, color: GOLD, background: "transparent" }}
            >
              {t("psSeeJobs")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfileStart;
