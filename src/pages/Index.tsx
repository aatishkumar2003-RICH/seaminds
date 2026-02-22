import { useState, useEffect } from "react";
import { MessageCircle, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NameEntry from "@/components/NameEntry";
import WelcomeScreens from "@/components/WelcomeScreens";
import CrewChat from "@/components/CrewChat";
import WelfareDashboard from "@/components/WelfareDashboard";

type AppState = "loading" | "name-entry" | "welcome" | "main";
type Screen = "chat" | "dashboard";

const PROFILE_KEY = "seamind_profile_id";

const Index = () => {
  const [appState, setAppState] = useState<AppState>("loading");
  const [screen, setScreen] = useState<Screen>("chat");
  const [profileId, setProfileId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState("");
  const [shipName, setShipName] = useState("");
  const [voyageStartDate, setVoyageStartDate] = useState("");

  // Check for existing profile on load
  useEffect(() => {
    const savedId = localStorage.getItem(PROFILE_KEY);
    if (!savedId) {
      setAppState("name-entry");
      return;
    }

    // Verify profile still exists
    supabase
      .from("crew_profiles")
      .select("id, first_name, onboarded, role, ship_name, voyage_start_date")
      .eq("id", savedId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          localStorage.removeItem(PROFILE_KEY);
          setAppState("name-entry");
          return;
        }
        setProfileId(data.id);
        setFirstName(data.first_name);
        setRole(data.role);
        setShipName(data.ship_name);
        setVoyageStartDate(data.voyage_start_date || "");
        if (!data.onboarded) {
          setAppState("welcome");
        } else {
          setAppState("main");
        }
      });
  }, []);

  const handleNameSubmit = async (profile: {
    firstName: string;
    shipName: string;
    role: string;
    gender: string;
    nationality: string;
    whatsappNumber: string;
    yearsAtSea: string;
    voyageStartDate: string;
  }) => {
    const { data, error } = await supabase
      .from("crew_profiles")
      .insert({
        first_name: profile.firstName,
        ship_name: profile.shipName,
        role: profile.role,
        gender: profile.gender || null,
        nationality: profile.nationality,
        whatsapp_number: profile.whatsappNumber,
        years_at_sea: profile.yearsAtSea,
        voyage_start_date: profile.voyageStartDate || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Failed to create profile:", error);
      return;
    }

    localStorage.setItem(PROFILE_KEY, data.id);
    setProfileId(data.id);
    setFirstName(profile.firstName);
    setRole(profile.role);
    setShipName(profile.shipName);
    setVoyageStartDate(profile.voyageStartDate);
    setAppState("welcome");
  };

  const handleWelcomeComplete = async () => {
    await supabase
      .from("crew_profiles")
      .update({ onboarded: true })
      .eq("id", profileId);
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

  if (appState === "name-entry") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <NameEntry onSubmit={handleNameSubmit} />
      </div>
    );
  }

  if (appState === "welcome") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <WelcomeScreens onComplete={handleWelcomeComplete} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background">
      <div className="flex-1 overflow-hidden">
        {screen === "chat" ? (
          <CrewChat profileId={profileId} firstName={firstName} role={role} shipName={shipName} voyageStartDate={voyageStartDate} />
        ) : (
          <WelfareDashboard />
        )}
      </div>

      <nav className="nav-glass flex items-center justify-around py-3 px-6">
        <button
          onClick={() => setScreen("chat")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            screen === "chat" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MessageCircle size={20} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Chat</span>
        </button>
        <button
          onClick={() => setScreen("dashboard")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            screen === "dashboard" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Welfare</span>
        </button>
      </nav>
    </div>
  );
};

export default Index;
