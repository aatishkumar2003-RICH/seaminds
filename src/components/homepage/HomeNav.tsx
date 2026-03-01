import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import seamindsLogo from "@/assets/seaminds-logo.png";

const navLinks = [
  { label: "For Seafarers", path: "/app" },
  { label: "For Companies", path: "/companies" },
  { label: "SMC Score", path: "/app" },
  { label: "Wellness", path: "/app" },
  { label: "Academy", path: "/app" },
  { label: "Jobs", path: "/app" },
  { label: "Pricing", path: "/pricing" },
];

const HomeNav = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const goTo = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 nav-glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src={seamindsLogo} alt="SeaMinds" className="w-8 h-8" />
            <span className="text-lg font-bold text-foreground gold-glow">SeaMinds</span>
          </div>

          <div className="hidden lg:flex items-center gap-5">
            {navLinks.map((l) => (
              <button key={l.label} onClick={() => goTo(l.path)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get Your Score
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/auth")}>
              Company Login
            </Button>
          </div>

          <button className="lg:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-card border-t border-border px-4 pb-4 space-y-2">
          {navLinks.map((l) => (
            <button key={l.label} onClick={() => goTo(l.path)} className="block w-full text-left py-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              {l.label}
            </button>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="flex-1" onClick={() => { setMobileOpen(false); navigate("/auth"); }}>
              Get Your Score
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setMobileOpen(false); navigate("/auth"); }}>
              Company Login
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default HomeNav;
