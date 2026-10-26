import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Users, Wrench, ArrowRight } from "lucide-react";

type Tab = "crew" | "technical";

const CREW = [
  { title: "Roster & Master Records", desc: "Your crew list, joining status and consent-gated master CVs.", to: "/manager/crew-desk", live: true },
  { title: "Principal CV Studio", desc: "Upload any principal's blank Word/Excel CV form once, name it yourself, then fill it from the master CV.", to: "/manager/crew-desk?tab=cv", live: true },
  { title: "Joining Issues (Tickets)", desc: "Private two-way threads with crew about a joining.", to: "/manager/dashboard?tab=applicants", live: true },
  { title: "Contracts (SEA) & Portage Bill", desc: "Signed contracts, monthly wages, advances, allotments and payslips.", to: "/manager/crew-desk?tab=portage", live: true },
  { title: "Appraisals & Training", desc: "Post-voyage appraisals, re-employment verdicts and training needs.", to: "/manager/crew-desk?tab=appraisals", live: true },
];

const TECH = [
  { title: "Ship Inspections", desc: "Takeover and condition inspections with photos and findings.", to: "/management/inspections", live: true },
  { title: "Pre-Vetting / SIRE 2.0 Readiness", desc: "Self-check before oil-major or port-state inspections — in preparation.", live: false },
  { title: "Planned Maintenance (PMS)", desc: "Running hours, jobs due and defect log — in preparation.", live: false },
  { title: "Vessel Certificates Radar", desc: "Statutory and class certificate expiry — in preparation.", live: false },
];

const FleetWorkspace = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "technical" ? "technical" : "crew";
  const items = tab === "crew" ? CREW : TECH;

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 pb-bottom-nav space-y-5">
      <button onClick={() => navigate("/manager/dashboard")} className="flex items-center gap-1 text-sm text-primary">
        <ChevronLeft size={18} /> Dashboard
      </button>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-primary">🚢 Fleet Workspace</h1>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-primary text-primary">Pro suite</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Complimentary during the SeaMinds launch for admin-approved companies.</p>
      </div>

      <div className="grid grid-cols-2 gap-1 bg-secondary rounded-xl p-1">
        {([["crew", "Crew Management", Users], ["technical", "Technical Management", Wrench]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setParams({ tab: key }, { replace: true })}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold min-h-[44px] transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((it) => (
          <button key={it.title} disabled={!it.live} onClick={() => it.to && navigate(it.to)}
            className="text-left rounded-2xl border border-primary/40 bg-secondary p-4 hover:border-primary transition-colors disabled:opacity-60 disabled:hover:border-primary/40">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-primary text-sm">{it.title}</p>
              {it.live ? <ArrowRight size={16} className="text-primary shrink-0" /> : <span className="text-[10px] text-muted-foreground shrink-0">Coming soon</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{it.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FleetWorkspace;
