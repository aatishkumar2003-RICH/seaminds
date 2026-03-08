import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import seamindsLogo from "@/assets/seaminds-logo.png";

const navLinks = [
  { label: "For Seafarers", href: "#seafarers" },
  { label: "For Companies", href: "#companies" },
  { label: "SMC Score", href: "#smc" },
  { label: "Jobs", href: "#jobs" },
  { label: "Pricing", path: "/pricing" },
  { label: "Colleges", path: "/colleges" },
];

const HomeNav = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (link: typeof navLinks[0]) => {
    setMobileOpen(false);
    if ('path' in link && link.path) {
      navigate(link.path);
    } else if ('href' in link && link.href) {
      const el = document.querySelector(link.href);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 nav-glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src={seamindsLogo} alt="SeaMinds" className="w-8 h-8" />
            <span className="text-lg font-bold text-foreground gold-glow">SeaMinds</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((l) => (
              <button key={l.label} onClick={() => handleNav(l)} className="text-sm font-medium transition-colors" style={{ color: "#94a3b8" }} onMouseEnter={e => (e.currentTarget.style.color = "#D4AF37")} onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}>
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-3">
          <Button size="sm" onClick={() => window.location.href = '/app'}>
            Get Your Score
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.href = '/app'}>
            Company Login
          </Button>
          </div>

          <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-card border-t border-border px-4 pb-4 space-y-2">
          {navLinks.map((l) => (
            <button key={l.label} onClick={() => handleNav(l)} className="block w-full text-left py-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              {l.label}
            </button>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="flex-1" onClick={() => { setMobileOpen(false); window.location.href = '/app'; }}>
              Get Your Score
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setMobileOpen(false); window.location.href = '/app'; }}>
              Company Login
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default HomeNav;
