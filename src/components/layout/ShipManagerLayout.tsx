import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, LayoutDashboard, Users, Search, GraduationCap, Ship, ShieldCheck, CreditCard, Megaphone, LifeBuoy } from "lucide-react";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { supabase } from "@/integrations/supabase/client";

/** Persistent ShipManager shell. Pure navigation — every page keeps its own logic and permission checks. */
const NAV = [
  { to: "/manager/dashboard?tab=crew", label: "Today's Overview", icon: LayoutDashboard, match: (p: string, q: URLSearchParams) => p === "/manager/dashboard" && (!q.get("tab") || q.get("tab") === "crew") && q.get("section") !== "safety" },
  { to: "/manager/dashboard?tab=applicants", label: "Recruitment & Applicants", icon: Users, match: (p: string, q: URLSearchParams) => p === "/manager/dashboard" && q.get("tab") === "applicants" },
  { to: "/post-vacancy", label: "Post Vacancy", icon: Megaphone, match: (p: string) => p === "/post-vacancy" },
  { to: "/manager-search", label: "Crew Search", icon: Search, match: (p: string) => p === "/manager-search" },
  { to: "/manager/interviews", label: "AI Interview Studio", icon: GraduationCap, match: (p: string) => p === "/manager/interviews" },
  { to: "/manager/dashboard?tab=crew&section=safety", label: "Safety & Compliance", icon: ShieldCheck, match: (p: string, q: URLSearchParams) => p === "/manager/dashboard" && q.get("section") === "safety" },
  { to: "/manager/dashboard?tab=payments", label: "Credits & Payments", icon: CreditCard, match: (p: string, q: URLSearchParams) => p === "/manager/dashboard" && q.get("tab") === "payments" },
  { to: "/management/inspections", label: "Fleet Inspections", icon: Ship, match: () => false, note: "Fleet staff access" },
];

const HELP_MAILTO = "mailto:info@indossol.com?subject=ShipManager%20by%20SeaMinds%20%E2%80%94%20help";

const ShipManagerLayout = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const q = new URLSearchParams(search);

  const logout = async () => { await supabase.auth.signOut(); navigate("/manager"); };

  const links = (
    <nav className="flex flex-col gap-1" aria-label="ShipManager navigation">
      {NAV.map(({ to, label, icon: Icon, match, note }) => {
        const active = match(pathname, q);
        return (
          <Link
            key={label}
            to={to}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-sm transition-colors ${active ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {note && <span className="text-[9px] uppercase tracking-wide opacity-60">{note}</span>}
          </Link>
        );
      })}
      <a href={HELP_MAILTO} className="flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
        <LifeBuoy size={16} /> Help & Guidance
      </a>
      <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-sm text-muted-foreground hover:bg-secondary hover:text-foreground text-left">
        <LogOut size={16} /> Logout
      </button>
    </nav>
  );

  const brand = (
    <Link to="/manager/dashboard?tab=crew" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
      <span className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center overflow-hidden shrink-0">
        <img src={seamindsLogo} alt="SeaMinds" className="w-7 h-7 object-contain" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-primary">ShipManager</span>
        <span className="block text-[10px] text-muted-foreground">by SeaMinds</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col gap-6 border-r border-border bg-card px-4 py-5 overflow-y-auto z-40">
        {brand}
        {links}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 h-14" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {brand}
        <button onClick={() => setOpen(true)} aria-label="Open ShipManager menu" className="w-11 h-11 flex items-center justify-center rounded-xl text-primary">
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/80" onClick={() => setOpen(false)}>
          <div className="absolute inset-y-0 right-0 w-[82%] max-w-xs bg-card border-l border-border p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              {brand}
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground"><X size={20} /></button>
            </div>
            {links}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <Outlet />
      </div>
    </div>
  );
};

export default ShipManagerLayout;
