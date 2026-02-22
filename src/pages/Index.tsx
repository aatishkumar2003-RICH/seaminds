import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, LayoutDashboard, Briefcase, Newspaper, GraduationCap, Compass, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LandingScreen from "@/components/LandingScreen";
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

const Index = () => {
  const navigate = useNavigate();
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

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background">
      <SOSButton onOpenChat={() => setScreen("chat")} />
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
  );
};

export default Index;
