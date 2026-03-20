import { useNavigate } from "react-router-dom";
import seamindsLogo from "@/assets/seaminds-logo.png";

const HomeFooter = () => {
  const navigate = useNavigate();

  const cols = [
    {
      title: "Platform",
      links: [
        { label: "SMC Score", action: () => navigate("/smc-score") },
        { label: "Wellness", action: () => navigate("/app") },
        { label: "Academy", action: () => navigate("/app") },
        { label: "Jobs", action: () => navigate("/jobs") },
        { label: "Community", action: () => navigate("/app") },
        { label: "Pricing", action: () => navigate("/pricing") },
      ],
    },
    {
      title: "For Companies",
      links: [
        { label: "Hire Crew", action: () => navigate("/for-companies") },
        { label: "Bulk Assessments", action: () => navigate("/for-companies") },
        { label: "Company Login", action: () => navigate("/manager") },
        { label: "Request Demo", action: () => navigate("/for-companies") },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Maritime News", action: () => navigate("/blog") },
        { label: "Safety Reports", action: () => navigate("/app") },
        { label: "MLC 2006", action: () => navigate("/app") },
        { label: "Contact", action: () => navigate("/contact") },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", action: () => navigate("/contact") },
        { label: "Privacy Policy", action: () => navigate("/privacy") },
        { label: "Terms of Service", action: () => navigate("/terms") },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/5 py-12" style={{ background: '#0D1B2A' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={seamindsLogo} alt="SeaMinds" className="w-6 h-6" />
              <span className="font-bold text-foreground">SeaMinds</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Built by a Master Mariner. For the people who keep global trade moving.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-sm mb-3 text-foreground">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <button onClick={l.action} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Built by a Master Mariner. For the people who keep global trade moving. © 2026 SeaMinds. MLC 2006 Compliant.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default HomeFooter;
