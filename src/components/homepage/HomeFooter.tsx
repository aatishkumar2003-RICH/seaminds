import { useState } from "react";
import { useNavigate } from "react-router-dom";
import seamindsLogo from "@/assets/seaminds-logo.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const ADMIN_PIN = "215151";
const LS_KEY = "sm_admin_auth";

const HomeFooter = () => {
  const navigate = useNavigate();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      localStorage.setItem(LS_KEY, ADMIN_PIN);
      setShowPin(false);
      setPin("");
      setError("");
      navigate("/admin");
    } else {
      setError("Incorrect PIN");
    }
  };

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
        <div className="border-t border-white/5 pt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            © 2026 SeaMinds. MLC 2006 Compliant.
          </p>
          <button
            onClick={() => { setShowPin(true); setPin(""); setError(""); }}
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            Admin
          </button>
        </div>
      </div>

      {/* Admin PIN Dialog */}
      <Dialog open={showPin} onOpenChange={setShowPin}>
        <DialogContent className="sm:max-w-xs border-border bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Lock className="w-4 h-4 text-primary" />
              Admin Access
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="Enter 6-digit PIN"
                className="text-center tracking-[0.3em] text-lg"
                autoFocus
              />
              {error && <p className="text-destructive text-xs text-center mt-2">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={pin.length < 6}>
              Unlock
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </footer>
  );
};

export default HomeFooter;
