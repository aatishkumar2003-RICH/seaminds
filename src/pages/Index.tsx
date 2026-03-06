import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, LayoutDashboard, Briefcase, Newspaper, GraduationCap, Compass, Star, LogOut, Anchor, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LandingScreen from "@/components/LandingScreen";
import OceanBackground from "@/components/homepage/OceanBackground";
import { useTimeOfDay } from "@/hooks/useTimeOfDay";
import NameEntry from "@/components/NameEntry";
import WelcomeScreens from "@/components/WelcomeScreens";
import CrewChat from "@/components/CrewChat";
import WelfareDashboard from "@/components/WelfareDashboard";
import Opportunities from "@/components/Opportunities";
import News from "@/components/News";
import Academy from "@/components/Academy";
import Community from "@/components/Community";
import SMCScoreTab from "@/components/SMCScoreTab";
import SOSButton from "@/components/SOSButton";
import VoyageReport from "@/components/VoyageReport";
type AppState = "loading" | "landing" | "name-entry" | "welcome" | "main" | "voyage-report";
type Screen = "chat" | "dashboard" | "opportunities" | "news" | "academy" | "community" | "smc";

const PROFILE_KEY = "seamind_profile_id";

const NATIONALITY_FLAGS: Record<string, string> = {
  Filipino: "🇵🇭", Indian: "🇮🇳", Indonesian: "🇮🇩", Ukrainian: "🇺🇦", Russian: "🇷🇺",
  Chinese: "🇨🇳", Greek: "🇬🇷", British: "🇬🇧", Myanmar: "🇲🇲", Thai: "🇹🇭",
  Vietnamese: "🇻🇳", Pakistani: "🇵🇰", Bangladeshi: "🇧🇩", "Sri Lankan": "🇱🇰",
  Croatian: "🇭🇷", Polish: "🇵🇱", Turkish: "🇹🇷", Kiribati: "🇰🇮", Tuvalu: "🇹🇻",
  Fijian: "🇫🇯", Maldivian: "🇲🇻", Ghanaian: "🇬🇭", Nigerian: "🇳🇬",
};

const Index = () => {
  const navigate = useNavigate();
  const timeOfDay = useTimeOfDay();
  const [appState, setAppState] = useState<AppState>("loading");
  const [screen, setScreen] = useState<Screen>("chat");
  const [profileId, setProfileId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [shipName, setShipName] = useState("");
  const [voyageStartDate, setVoyageStartDate] = useState("");
  const [manningAgency, setManningAgency] = useState("");
  const [nationality, setNationality] = useState("");
  const [showSignOffConfirm, setShowSignOffConfirm] = useState(false);
  const [utcTime, setUtcTime] = useState("");
  const [jobMatch, setJobMatch] = useState<{ rank_required: string; vessel_type: string; joining_port: string } | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(now.toISOString().slice(11, 19) + " UTC");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Dynamic page title based on active screen
  useEffect(() => {
    const titles: Record<Screen, string> = {
      chat: "SeaMinds | Wellness",
      dashboard: "SeaMinds | Wellness",
      opportunities: "SeaMinds | Opportunities",
      news: "SeaMinds | News",
      academy: "SeaMinds | Academy",
      community: "SeaMinds | Community",
      smc: "SeaMinds | SMC Score",
    };
    document.title = appState === "main" ? titles[screen] : "SeaMinds";
  }, [screen, appState]);

  // Job match notification
  useEffect(() => {
    if (appState !== "main" || !role) return;
    if (sessionStorage.getItem("seamind_job_match_shown")) return;

    const checkJobMatches = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("job_postings")
        .select("rank_required, vessel_type, joining_port")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(3);

      if (data) {
        const match = data.find(
          (j) => j.rank_required === "Any Rank" || j.rank_required.toLowerCase() === role.toLowerCase()
        );
        if (match) {
          setJobMatch(match);
          sessionStorage.setItem("seamind_job_match_shown", "1");
        }
      }
    };
    checkJobMatches();
  }, [appState, role]);

  useEffect(() => {
    const savedId = localStorage.getItem(PROFILE_KEY);
    if (!savedId) { setAppState("landing"); return; }

    supabase
      .from("crew_profiles")
      .select("id, first_name, last_name, onboarded, role, ship_name, voyage_start_date, manning_agency, nationality")
      .eq("id", savedId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { localStorage.removeItem(PROFILE_KEY); setAppState("landing"); return; }
        setProfileId(data.id);
        setFirstName(data.first_name);
        setLastName(data.last_name || "");
        setRole(data.role);
        setShipName(data.ship_name);
        setVoyageStartDate(data.voyage_start_date || "");
        setManningAgency(data.manning_agency || "");
        setNationality(data.nationality || "");
        setAppState(data.onboarded ? "main" : "welcome");
      });
  }, []);

  const handleNameSubmit = async (profile: {
    firstName: string;
    lastName: string;
    shipName: string;
    role: string;
    gender: string;
    nationality: string;
    whatsappNumber: string;
    yearsAtSea: string;
    voyageStartDate: string;
    manningAgency: string;
    vesselImo: string;
  }) => {
    const { data, error } = await supabase
      .from("crew_profiles")
      .insert({
        first_name: profile.firstName,
        last_name: profile.lastName,
        ship_name: profile.shipName,
        role: profile.role,
        gender: profile.gender || null,
        nationality: profile.nationality,
        whatsapp_number: profile.whatsappNumber,
        years_at_sea: profile.yearsAtSea,
        voyage_start_date: profile.voyageStartDate || null,
        manning_agency: profile.manningAgency || null,
        vessel_imo: profile.vesselImo || null,
      })
      .select("id")
      .single();

    if (error || !data) { console.error("Failed to create profile:", error); return; }

    localStorage.setItem(PROFILE_KEY, data.id);
    setProfileId(data.id);
    setFirstName(profile.firstName);
    setRole(profile.role);
    setShipName(profile.shipName);
    setVoyageStartDate(profile.voyageStartDate);
    setManningAgency(profile.manningAgency);
    setNationality(profile.nationality);
    setAppState("welcome");
  };

  const handleWelcomeComplete = async () => {
    await supabase.from("crew_profiles").update({ onboarded: true }).eq("id", profileId);
    setAppState("main");
  };

  if (appState === "loading") {
    return (
      <div className="flex items-center justify-center h-screen max-w-md mx-auto bg-background">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  if (appState === "landing") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <SOSButton onOpenChat={() => { setAppState("main"); setScreen("chat"); }} />
        <LandingScreen onGetStarted={() => setAppState("name-entry")} onManagerLogin={() => navigate("/manager")} />
      </div>
    );
  }

  if (appState === "name-entry") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <SOSButton onOpenChat={() => { setAppState("main"); setScreen("chat"); }} />
        <NameEntry onSubmit={handleNameSubmit} />
      </div>
    );
  }

  if (appState === "welcome") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <SOSButton onOpenChat={() => { setAppState("main"); setScreen("chat"); }} />
        <WelcomeScreens onComplete={handleWelcomeComplete} />
      </div>
    );
  }

  if (appState === "voyage-report") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <VoyageReport
          profileId={profileId}
          firstName={firstName}
          role={role}
          shipName={shipName}
          voyageStartDate={voyageStartDate}
          nationality={nationality}
          onClose={() => setAppState("main")}
        />
      </div>
    );
  }


  const handleSignOut = () => {
    localStorage.removeItem(PROFILE_KEY);
    window.location.href = "/";
  };

  const handleSignOff = async () => {
    await supabase.from("crew_profiles").update({ onboarded: false }).eq("id", profileId);
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background relative">
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
        <OceanBackground timeOfDay={timeOfDay} />
      </div>

      <div
        style={{
    position: 'fixed',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 1,
    opacity: 0.5,
        }}
      >
        <div style={{ fontSize: '3rem' }}>{NATIONALITY_FLAGS[nationality] || "🌊"}</div>
        <div style={{ 
          color: '#D4AF37', 
          fontSize: '14px', 
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginTop: '8px'
        }}>{shipName}</div>
        <div style={{ 
          color: '#888', 
          fontSize: '11px',
          marginTop: '4px'
        }}>{utcTime}</div>
      </div>

      <div className="relative z-10 flex flex-col h-full">
      <SOSButton onOpenChat={() => setScreen("chat")} />

      {/* Top bar */}
      <div className="flex items-center justify-start gap-3 pl-4 pr-16 py-2">
        <button onClick={() => setShowSignOffConfirm(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Anchor size={14} /> Sign Off
        </button>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      {/* Sign Off confirmation */}
      {showSignOffConfirm && (
        <div className="mx-4 mb-2 p-3 rounded-xl bg-secondary border border-border text-sm">
          <p className="text-foreground mb-2">End current voyage and update details?</p>
          <div className="flex gap-2">
            <button onClick={handleSignOff} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Yes</button>
            <button onClick={() => setShowSignOffConfirm(false)} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {screen === "chat" ? (
          <CrewChat profileId={profileId} firstName={firstName} role={role} shipName={shipName} voyageStartDate={voyageStartDate} />
        ) : screen === "dashboard" ? (
          <WelfareDashboard shipName={shipName} />
        ) : screen === "opportunities" ? (
          <Opportunities profileId={profileId} firstName={firstName} role={role} nationality={nationality} shipName={shipName} />
        ) : screen === "news" ? (
          <News />
        ) : screen === "academy" ? (
          <Academy />
        ) : screen === "community" ? (
          <Community profileId={profileId} shipName={shipName} manningAgency={manningAgency} firstName={firstName} voyageStartDate={voyageStartDate} onCompleteVoyage={() => setAppState("voyage-report")} />
        ) : (
          <SMCScoreTab profileId={profileId} firstName={firstName} lastName={lastName} rank={role} shipName={shipName} />
        )}
      </div>

      <nav className="nav-glass flex items-center justify-around py-3 px-6">
        <button onClick={() => setScreen("chat")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "chat" ? "text-primary" : "text-muted-foreground"}`}>
          <MessageCircle size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Chat</span>
        </button>
        <button onClick={() => setScreen("dashboard")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "dashboard" ? "text-primary" : "text-muted-foreground"}`}>
          <LayoutDashboard size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Welfare</span>
        </button>
        <button onClick={() => setScreen("opportunities")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "opportunities" ? "text-primary" : "text-muted-foreground"}`}>
          <Briefcase size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Jobs</span>
        </button>
        <button onClick={() => setScreen("news")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "news" ? "text-primary" : "text-muted-foreground"}`}>
          <Newspaper size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">News</span>
        </button>
        <button onClick={() => setScreen("academy")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "academy" ? "text-primary" : "text-muted-foreground"}`}>
          <GraduationCap size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Academy</span>
        </button>
        <button onClick={() => setScreen("community")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "community" ? "text-primary" : "text-muted-foreground"}`}>
          <Compass size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Community</span>
        </button>
        <button onClick={() => setScreen("smc")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "smc" ? "text-primary" : "text-muted-foreground"}`}>
          <Star size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">SMC</span>
        </button>
      </nav>
      </div>
    </div>
  );
};

export default Index;
