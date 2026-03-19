import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, LayoutDashboard, Briefcase, Newspaper, GraduationCap, Compass, Star, LogOut, Anchor, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import Bridge from "@/components/Bridge";
import SMCScoreTab from "@/components/SMCScoreTab";
import ResumeBuilder from "@/components/ResumeBuilder";
import SOSButton from "@/components/SOSButton";
import VoyageReport from "@/components/VoyageReport";
import CertWallet from "@/components/CertWallet";
import RestHoursTracker from "@/components/RestHoursTracker";
import VesselRating from "@/components/VesselRating";
import NPSSurvey from "@/components/NPSSurvey";
import VesselOnboardingCard from "@/components/VesselOnboardingCard";
type AppState = "loading" | "landing" | "name-entry" | "welcome" | "main" | "voyage-report";
type Screen = "chat" | "dashboard" | "opportunities" | "news" | "academy" | "bridge" | "community" | "smc" | "resume" | "certs" | "resthours" | "vesselrating";

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
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null);
  const [profileId, setProfileId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [shipName, setShipName] = useState("");
  const [voyageStartDate, setVoyageStartDate] = useState("");
  const [manningAgency, setManningAgency] = useState("");
  const [nationality, setNationality] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [showSignOffConfirm, setShowSignOffConfirm] = useState(false);
  const [utcTime, setUtcTime] = useState("");
  const [jobMatch, setJobMatch] = useState<{ rank_required: string; vessel_type: string; joining_port: string } | null>(null);
  const [jobBadgeCount, setJobBadgeCount] = useState(0);
  const [targetScreen, setTargetScreen] = useState<Screen>("chat");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSummary, setFeedbackSummary] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [showNPS, setShowNPS] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [smcScore, setSmcScore] = useState<number | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [vesselType, setVesselType] = useState("");
  const [portOfJoining, setPortOfJoining] = useState("");

  const navigateTo = (next: Screen) => {
    setPrevScreen(screen);
    setScreen(next);
  };

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
      bridge: "SeaMinds | PMS",
      community: "SeaMinds | Community",
      smc: "SeaMinds | SMC Score",
      resume: "SeaMinds | CV Builder",
      certs: "SeaMinds | Certificates",
      resthours: "SeaMinds | Rest Hours",
      vesselrating: "SeaMinds | Vessel Rating",
    };
    document.title = appState === "main" ? titles[screen] : "SeaMinds";
  }, [screen, appState]);

  // NPS survey — 3 minute delay, once per user
  useEffect(() => {
    if (appState !== "main") return;
    if (localStorage.getItem("seaminds_nps_shown")) return;
    const timer = setTimeout(() => setShowNPS(true), 180000);
    return () => clearTimeout(timer);
  }, [appState]);

  // Push notification permission — 2 minute delay, once per user
  useEffect(() => {
    if (appState !== "main") return;
    if (localStorage.getItem("seaminds_notif_asked")) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const timer = setTimeout(() => setShowNotifPrompt(true), 120000);
    return () => clearTimeout(timer);
  }, [appState]);

  // Fetch SMC score
  useEffect(() => {
    if (appState !== "main" || !profileId) return;
    const fetchSmc = async () => {
      const { data } = await supabase
        .from("smc_assessments")
        .select("overall_score")
        .eq("crew_profile_id", profileId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.overall_score != null) setSmcScore(Number(data.overall_score));
    };
    fetchSmc();
  }, [appState, profileId]);


  useEffect(() => {
    if (appState !== "main" || !role) return;
    if (sessionStorage.getItem("seamind_job_match_shown")) return;

    const checkJobMatches = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("job_postings")
        .select("rank_required, vessel_type, joining_port, status")
        .neq("status", "pending_payment")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(3);

      if (data) {
        const match = data.find(
          (j) => j.rank_required === "Any Rank" || j.rank_required.toLowerCase() === role.toLowerCase()
        );
        if (match) {
          setJobMatch(match);
          setJobBadgeCount(prev => prev + 1);
          sessionStorage.setItem("seamind_job_match_shown", "1");
        }
      }
    };
    checkJobMatches();
  }, [appState, role]);

  // Real-time job alerts
  useEffect(() => {
    if (appState !== "main" || !role) return;

    const channel = supabase
      .channel("job-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_postings" },
        (payload) => {
          const newJob = payload.new as { rank_required: string; vessel_type: string; joining_port: string; status: string };
          if (newJob.status === "pending_payment") return;
          if (
            newJob.rank_required === "Any Rank" ||
            newJob.rank_required.toLowerCase() === role.toLowerCase()
          ) {
            setJobMatch({ rank_required: newJob.rank_required, vessel_type: newJob.vessel_type, joining_port: newJob.joining_port });
            setJobBadgeCount(prev => prev + 1);
            
            // Play notification sound
            try {
              const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkI2IhX99c2xjXmFsgImUm5uWkIeAd3BpZGFhaGyBk5ydnJiRiYB3bmdjYWVsiZOdnpyXkIiAdm5nZGJnbYuVnp+dl5CIgHZuZ2RjZ26Ml56fn5iPiIB2b2dlZGhvjZifn5+Yj4iAdm9nZWRpcI6Zn5+fmI+IgHZvZ2VlaXCPmp+fn5mPiIB2b2dmZWpxj5ufn5+Zj4h/dm9nZmVqcZCbn5+fmY+Hf3ZvZ2ZmanGQm5+gn5mPh392b2dmZmpxkJufoJ+Zj4d/dm9nZmZqcZCcn6CfmY+Hf3ZvZ2ZmanGRnJ+gn5mQh392b2dmZmpxkZyfoJ+ZkId/dm9nZmZqcZGcn6CfmpCHf3ZvZ2ZmanGRnJ+gn5qQh392b2dmZmpxkZyfoJ+akId/dm9nZmZqcZGcn6CfmpCHf3ZvZ2ZmanGRnJ+gn5qQh392cGdmZmpxkZyfoJ+akId/dm9nZmZqcQ==");
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}
            
            // Show toast notification
            toast({
              title: "⚓ New Job Match!",
              description: `${newJob.rank_required} on ${newJob.vessel_type} — Joining: ${newJob.joining_port}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appState, role]);

  const { user: authUser, isReady: authReady, accessToken } = useAuth();

  // Single init effect — uses auth context instead of getSession
  useEffect(() => {
    const init = async () => {
      // Fallback: if init hangs for 4 seconds, show landing
      const fallbackTimer = setTimeout(() => {
        console.warn('[SeaMinds] Init timeout — showing landing');
        setAppState('landing');
      }, 4000);

      try {
        const savedId = localStorage.getItem('seamind_profile_id');
        if (savedId) {
          const { data, error } = await supabase.from('crew_profiles').select('id, first_name, last_name, onboarded, role, ship_name, voyage_start_date, manning_agency, nationality, whatsapp_number, vessel_type, port_of_joining, onboarding_complete').eq('id', savedId).single();
          if (!error && data) {
            setProfileId(data.id); setFirstName(data.first_name); setLastName(data.last_name || '');
            setRole(data.role || ''); setShipName(data.ship_name || ''); setVoyageStartDate(data.voyage_start_date || '');
            setManningAgency(data.manning_agency || ''); setNationality(data.nationality || ''); setWhatsappNumber(data.whatsapp_number || '');
            setVesselType((data as any).vessel_type || ''); setPortOfJoining((data as any).port_of_joining || '');
            setOnboardingComplete(!!(data as any).onboarding_complete);
            clearTimeout(fallbackTimer);
            setAppState(data.onboarded ? 'main' : 'welcome');
            return;
          }
          localStorage.removeItem('seamind_profile_id');
        }

        clearTimeout(fallbackTimer);

        if (authUser) {
          const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Seafarer';
          setFirstName(fullName.split(' ')[0]);
          setAppState('main');
          setScreen('news');
          return;
        }
        setAppState('landing');
      } catch (e) {
        console.error('[SeaMinds] Init error:', e);
        clearTimeout(fallbackTimer);
        setAppState('landing');
      }
    };

    if (authReady) init();
  }, [authReady, authUser]);

  // React to auth state changes (login while on landing)
  useEffect(() => {
    if (!authReady || !authUser) return;
    const savedId = localStorage.getItem('seamind_profile_id');
    if (savedId) return;
    const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Seafarer';
    setFirstName(fullName.split(' ')[0]);
    setAppState('main');
    setScreen('news');
  }, [authUser, authReady]);

  const handleNameSubmit = async (profile: {
    firstName: string; lastName: string; shipName: string; role: string;
    gender: string; nationality: string; whatsappNumber: string; yearsAtSea: string;
    voyageStartDate: string; manningAgency: string; vesselImo: string;
    manningAgentPhone: string; portOfJoining: string; vesselType: string;
  }, cvFile?: File) => {
    const uid = authUser?.id;
    const insertData: Record<string, any> = {
      first_name: profile.firstName, last_name: profile.lastName,
      ship_name: profile.shipName, role: profile.role,
      gender: profile.gender || null, nationality: profile.nationality,
      whatsapp_number: profile.whatsappNumber, years_at_sea: profile.yearsAtSea,
      voyage_start_date: profile.voyageStartDate || null,
      manning_agency: profile.manningAgency || null, vessel_imo: profile.vesselImo || null,
      manning_agent_phone: profile.manningAgentPhone || null,
      port_of_joining: profile.portOfJoining || null,
      vessel_type: profile.vesselType || null,
      onboarded: true,
    };
    if (uid) { insertData.id = uid; insertData.user_id = uid; }
    const { data, error } = await supabase.from("crew_profiles").upsert(insertData as any).select("id").single();
    if (error || !data) { console.error("Failed to create profile:", error); return; }
    localStorage.setItem(PROFILE_KEY, data.id);
    setProfileId(data.id); setFirstName(profile.firstName); setLastName(profile.lastName);
    setRole(profile.role); setShipName(profile.shipName); setNationality(profile.nationality);
    setWhatsappNumber(profile.whatsappNumber); setVoyageStartDate(profile.voyageStartDate);
    setManningAgency(profile.manningAgency);
    if (cvFile) {
      const ext = cvFile.name.split(".").pop() || "pdf";
      await supabase.storage.from("crew-cvs").upload(`${data.id}/cv.${ext}`, cvFile, { upsert: true });
    }
    setAppState("welcome");
  };

  const handleWelcomeComplete = async () => {
    await supabase.from("crew_profiles").update({ onboarded: true }).eq("id", profileId);
    setScreen(targetScreen);
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
        <SOSButton onOpenChat={() => { setAppState("main"); setScreen("chat"); }} firstName={firstName} shipName={shipName} />
        <LandingScreen onGetStarted={() => setAppState("name-entry")} onManagerLogin={() => navigate("/manager")} />
      </div>
    );
  }

  if (appState === "name-entry") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <SOSButton onOpenChat={() => { setAppState("main"); setScreen("chat"); }} firstName={firstName} shipName={shipName} />
        <NameEntry onSubmit={handleNameSubmit} />
      </div>
    );
  }

  if (appState === "welcome") {
    return (
      <div className="h-screen max-w-md mx-auto bg-background">
        <SOSButton onOpenChat={() => { setAppState("main"); setScreen("chat"); }} firstName={firstName} shipName={shipName} />
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


  const handleSignOut = async () => {
    // Clear local state immediately
    localStorage.removeItem(PROFILE_KEY);
    
    // Force redirect within 2 seconds regardless of network
    const forceRedirect = setTimeout(() => {
      window.location.href = "/";
    }, 2000);

    try {
      // Clear all Supabase session keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Try supabase signOut but don't wait forever
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1500)),
      ]);
    } catch (e) {
      console.warn("Sign out error (forcing redirect):", e);
    }

    clearTimeout(forceRedirect);
    window.location.href = "/";
  };

  const handleSignOff = async () => {
    await supabase.from("crew_profiles").update({ onboarded: false }).eq("id", profileId);
    window.location.reload();
  };

  const profileComplete = !!(role && nationality && shipName && whatsappNumber);

  const handleProfileGateUpdate = (field: string, value: string) => {
    if (field === "rank") setRole(value);
    else if (field === "nationality") setNationality(value);
    else if (field === "shipName") setShipName(value);
    else if (field === "whatsappNumber") setWhatsappNumber(value);
  };

  const saveProfileGate = async () => {
    if (!role || !nationality || !shipName || !whatsappNumber) return;
    const dbRole = role.includes("Captain") || role.includes("Master") ? "Captain"
      : role.includes("Engineer") || role.includes("ETO") ? "Engineer"
      : role.includes("Officer") ? "Officer"
      : "Rating";
    if (profileId) {
      await supabase.from("crew_profiles").update({
        role: dbRole, nationality, ship_name: shipName, whatsapp_number: whatsappNumber
      }).eq("id", profileId);
    } else {
      const uid = authUser?.id;
      if (!uid) return;
      const { data: existing } = await supabase.from("crew_profiles").select("id").eq("id", uid).maybeSingle();
      if (existing) {
        await supabase.from("crew_profiles").update({
          role: dbRole, nationality, ship_name: shipName, whatsapp_number: whatsappNumber
        }).eq("id", uid);
        localStorage.setItem("seamind_profile_id", uid);
        setProfileId(uid);
      } else {
        const { data } = await supabase.from("crew_profiles").insert({
          id: uid, user_id: uid, first_name: firstName, last_name: lastName,
          role: dbRole, nationality, ship_name: shipName,
          whatsapp_number: whatsappNumber, onboarded: true
        } as any).select("id").single();
        if (data) { localStorage.setItem("seamind_profile_id", data.id); setProfileId(data.id); }
      }
    }
  };

  const profileGateUI = (
    <div className="flex flex-col h-full items-center justify-start overflow-y-auto bg-[#0D1B2A] px-6 py-8 text-center">
      <div className="text-[#D4AF37] mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
      </div>
      <h2 className="text-[#D4AF37] text-lg font-bold mb-2">Complete Your Profile</h2>
      <p className="text-gray-400 text-sm mb-6">CHAT, WELFARE and COMMUNITY are personalised for you. We need 4 quick details.</p>
      <div className="w-full max-w-sm space-y-3">
        <select className="w-full bg-[#132236] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:outline-none" value={role} onChange={e => handleProfileGateUpdate("rank", e.target.value)}>
          <option value="">Select your rank...</option>
          {["Captain / Master","Chief Officer","2nd Officer","3rd Officer","Chief Engineer","2nd Engineer","3rd Engineer","4th Engineer","ETO / EEO","Bosun","AB Seaman","Ordinary Seaman (OS)","Fitter","Oiler","Cook","Messman / Steward","Deck Cadet","Engine Cadet"].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="w-full bg-[#132236] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:outline-none placeholder:text-gray-600" placeholder="Nationality (e.g. Filipino)" value={nationality} onChange={e => handleProfileGateUpdate("nationality", e.target.value)} />
        <input className="w-full bg-[#132236] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:outline-none placeholder:text-gray-600" placeholder="Ship Name (e.g. MV Pacific Star)" value={shipName} onChange={e => handleProfileGateUpdate("shipName", e.target.value)} />
        <input className="w-full bg-[#132236] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:outline-none placeholder:text-gray-600" placeholder="WhatsApp Number (+63...)" value={whatsappNumber} onChange={e => handleProfileGateUpdate("whatsappNumber", e.target.value)} />
        <button onClick={saveProfileGate} className="w-full bg-[#D4AF37] text-[#0D1B2A] py-3 rounded-xl font-bold text-sm hover:bg-yellow-400 transition-colors">
          Unlock My Tabs →
        </button>
      </div>
    </div>
  );

  const handleVesselOnboardingComplete = (data: { vesselName: string; vesselType: string; rank: string; portOfJoining: string }) => {
    setShipName(data.vesselName);
    setVesselType(data.vesselType);
    setRole(data.rank);
    setPortOfJoining(data.portOfJoining);
    setOnboardingComplete(true);
  };

  const vesselOnboardingUI = (
    <VesselOnboardingCard
      profileId={profileId}
      existingShipName={shipName}
      existingRole={role}
      onBack={() => setScreen("news")}
      onComplete={handleVesselOnboardingComplete}
    />
  );
  const handleFeedbackSubmit = async () => {
    if (feedbackRating === 0) return;
    setFeedbackLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('summarize-feedback', {
        body: { feedbackText: `Rating: ${feedbackRating}/5 stars\nComment: ${feedbackText}`, feedbackRating }
      });
      const summary = fnError ? "" : (fnData?.summary || "");
      setFeedbackSummary(summary);
      await supabase.from("crew_feedback" as any).insert({
        profile_id: profileId || null,
        raw_text: feedbackText,
        ai_summary: summary,
        rating: feedbackRating,
        rank: role || null,
        nationality: nationality || null,
        ship_name: shipName || null,
      });
      setFeedbackDone(true);
    } catch (e) { console.error(e); }
    setFeedbackLoading(false);
  };

  const navItems: { icon: string; label: string; screen: Screen; gated?: boolean }[] = [
    { icon: "💬", label: "Chat", screen: "chat", gated: true },
    { icon: "❤️", label: "Welfare", screen: "dashboard", gated: true },
    { icon: "⏱", label: "Rest Hours", screen: "resthours", gated: true },
    { icon: "💼", label: "Jobs", screen: "opportunities" },
    { icon: "📄", label: "CV", screen: "resume" },
    { icon: "📰", label: "News", screen: "news" },
    { icon: "🎓", label: "Academy", screen: "academy" },
    { icon: "🔧", label: "PMS", screen: "bridge" },
    { icon: "👥", label: "Community", screen: "community", gated: true },
    { icon: "🏆", label: "SMC", screen: "smc" },
    { icon: "📜", label: "Certs", screen: "certs" },
  ];

  const streakRaw = localStorage.getItem("seaminds_streak");
  const streakCount = streakRaw ? parseInt(streakRaw, 10) : 0;

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.gated && !profileComplete) {
      setTargetScreen(item.screen);
      setAppState("name-entry");
    } else {
      navigateTo(item.screen);
      if (item.screen === "opportunities") setJobBadgeCount(0);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-background relative">
      {/* === DESKTOP SIDEBAR (lg+) === */}
      <aside className="hidden lg:flex w-64 h-screen flex-col flex-shrink-0 border-r border-border" style={{ background: "#0D1B2A", padding: "24px 16px" }}>
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-lg font-bold px-2 py-0.5 rounded" style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37" }}>SM</span>
          <span className="font-bold text-base" style={{ color: "#D4AF37" }}>SeaMinds</span>
        </div>

        {/* User info */}
        <div className="flex items-center gap-2 mb-6 px-1">
          <span className="text-lg">{NATIONALITY_FLAGS[nationality] || "🌊"}</span>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground font-medium">{firstName || "Seafarer"} {lastName}</span>
            {role && <span className="text-xs text-muted-foreground/60">{role}</span>}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const active = screen === item.screen;
            return (
              <button
                key={item.screen}
                onClick={() => handleNavClick(item)}
                className="flex items-center gap-3 text-sm font-medium transition-colors w-full text-left"
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  borderLeft: active ? "3px solid #D4AF37" : "3px solid transparent",
                  background: active ? "rgba(212,175,55,0.15)" : "transparent",
                  color: active ? "#D4AF37" : "rgba(255,255,255,0.5)",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget.style.background = "rgba(255,255,255,0.05)"); }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget.style.background = "transparent"); }}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                {item.screen === "opportunities" && jobBadgeCount > 0 && (
                  <span className="ml-auto text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1" style={{ background: "#D4AF37", color: "#0a1929" }}>{jobBadgeCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center justify-center gap-2 py-1.5 rounded-full text-xs font-medium" style={{ background: "rgba(212,175,55,0.12)", color: "#D4AF37" }}>
            🔥 {streakCount} day streak
          </div>
          <button onClick={handleSignOut} className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
            <LogOut size={14} /> Sign Out
          </button>
          <div className="w-full">
            <SOSButton onOpenChat={() => setScreen("chat")} firstName={firstName} shipName={shipName} inline />
          </div>
        </div>
      </aside>

      {/* === MAIN CONTENT AREA === */}
      <div className="flex-1 flex flex-col h-screen w-full max-w-md lg:max-w-none mx-auto lg:mx-0 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
          <OceanBackground timeOfDay={timeOfDay} />
        </div>

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {/* Greeting Header */}
        <div className="px-4 lg:px-8 pt-2 lg:pt-4 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {prevScreen && (
                <button
                  onClick={() => { setScreen(prevScreen); setPrevScreen(null); }}
                  className="md:hidden flex items-center gap-1 text-sm mr-2"
                  style={{ color: '#D4AF37' }}
                >
                  ← Back
                </button>
              )}
              <span className="text-xl">{NATIONALITY_FLAGS[nationality] || "🌊"}</span>
              <span className="font-bold text-sm" style={{ color: "#D4AF37" }}>{firstName || "Seafarer"}</span>
              {role && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37" }}>
                  {role}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-xs font-mono text-muted-foreground">{utcTime}</span>
              <div className="lg:hidden">
                <SOSButton onOpenChat={() => setScreen("chat")} firstName={firstName} shipName={shipName} inline />
              </div>
            </div>
          </div>

        {/* Quick Stats Row */}
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {(() => {
            const certsRaw = localStorage.getItem("seaminds_certs");
            const certs: { expiryDate: string }[] = certsRaw ? (() => { try { return JSON.parse(certsRaw); } catch { return []; } })() : [];
            const expiringSoon = certs.filter(c => {
              const d = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
              return d >= 0 && d < 90;
            }).length;

            const restRaw = localStorage.getItem("seaminds_rest_today");
            const restHours = restRaw ? parseFloat(restRaw) : 0;

            const streakRaw = localStorage.getItem("seaminds_streak");
            const streakCount = streakRaw ? parseInt(streakRaw, 10) : 0;

            const cardStyle = {
              background: "rgba(13,27,42,0.8)",
              border: "1px solid rgba(212,175,55,0.15)",
              borderRadius: "12px",
              padding: "10px",
              minWidth: "80px",
              textAlign: "center" as const,
              flexShrink: 0,
            };

            return (
              <>
                <button onClick={() => setScreen("chat")} style={cardStyle} className="flex-1">
                  <div className="text-lg">🔥</div>
                  <div className="text-sm font-bold" style={{ color: "#D4AF37" }}>{streakCount}</div>
                  <div className="text-[9px] text-muted-foreground">day streak</div>
                </button>
                <button onClick={() => setScreen("certs")} style={{
                  ...cardStyle,
                  border: expiringSoon > 0 ? "1px solid rgba(245,158,11,0.4)" : cardStyle.border,
                }} className="flex-1">
                  <div className="text-lg">📜</div>
                  <div className="text-sm font-bold" style={{ color: expiringSoon > 0 ? "#f59e0b" : "#22c55e" }}>{expiringSoon}</div>
                  <div className="text-[9px] text-muted-foreground">expiring soon</div>
                </button>
                <button onClick={() => setScreen("resthours")} style={{
                  ...cardStyle,
                  border: restHours < 10 && restHours > 0 ? "1px solid rgba(239,68,68,0.4)" : cardStyle.border,
                }} className="flex-1">
                  <div className="text-lg">⏱</div>
                  <div className="text-sm font-bold" style={{ color: restHours >= 10 ? "#22c55e" : restHours > 0 ? "#ef4444" : "#888" }}>{restHours || "—"}</div>
                  <div className="text-[9px] text-muted-foreground">hrs rest today</div>
                </button>
                <button onClick={() => setScreen("smc")} style={cardStyle} className="flex-1">
                  <div className="text-lg">🏆</div>
                  <div className="text-sm font-bold" style={{ color: "#D4AF37" }}>{smcScore !== null ? smcScore : "Get Score"}</div>
                  <div className="text-[9px] text-muted-foreground">{smcScore !== null ? "SMC Score" : "SMC"}</div>
                </button>
              </>
            );
          })()}
        </div>

        {/* Daily Motivational Quote */}
        {(() => {
          const SEAFARER_QUOTES = [
            { text: "A smooth sea never made a skilled sailor.", author: "Franklin D. Roosevelt" },
            { text: "The pessimist complains about the wind; the optimist expects it to change; the realist adjusts the sails.", author: "William Arthur Ward" },
            { text: "Twenty years from now you will be more disappointed by the things you didn't do than by the ones you did.", author: "Mark Twain" },
            { text: "The sea, once it casts its spell, holds one in its net of wonder forever.", author: "Jacques Cousteau" },
            { text: "He that would learn to pray, let him go to sea.", author: "George Herbert" },
            { text: "I can't control the wind, but I can adjust my sails.", author: "Ricky Skaggs" },
            { text: "The ocean stirs the heart, inspires the imagination and brings eternal joy to the soul.", author: "Wyland" },
            { text: "There is nothing more enticing, disenchanting, and enslaving than the life at sea.", author: "Joseph Conrad" },
            { text: "To reach a port we must set sail. Sail, not tie at anchor. Sail, not drift.", author: "Franklin D. Roosevelt" },
            { text: "In one drop of water are found all the secrets of all the oceans.", author: "Kahlil Gibran" },
            { text: "The cure for anything is salt water: sweat, tears, or the sea.", author: "Isak Dinesen" },
            { text: "A ship in harbour is safe, but that is not what ships are built for.", author: "John A. Shedd" },
            { text: "It is not the ship so much as the skillful sailing that assures the prosperous voyage.", author: "George William Curtis" },
            { text: "The wind and the waves are always on the side of the ablest navigator.", author: "Edmund Gibbon" },
            { text: "Land was created to provide a place for boats to visit.", author: "Brooks Atkinson" },
            { text: "Only the guy who isn't rowing has time to rock the boat.", author: "Jean-Paul Sartre" },
            { text: "We must free ourselves of the hope that the sea will ever rest. We must learn to sail in high winds.", author: "Aristotle Onassis" },
            { text: "The sea lives in every one of us.", author: "Robert Wyland" },
            { text: "You can never cross the ocean until you have the courage to lose sight of the shore.", author: "Christopher Columbus" },
            { text: "Not all treasure is silver and gold, mate.", author: "Captain Jack Sparrow" },
            { text: "Being at sea is like being in a world that only knows how to breathe.", author: "Unknown" },
            { text: "A rising tide lifts all boats.", author: "John F. Kennedy" },
            { text: "Calm seas and a prosperous voyage.", author: "William Shakespeare" },
            { text: "To me, the sea is like a person — like a child that I've known a long time.", author: "Gertrude Ederle" },
            { text: "No man will be a sailor who has contrivance enough to get himself into a jail.", author: "Samuel Johnson" },
            { text: "Any fool can carry on, but a wise man knows how to shorten sail in time.", author: "Joseph Conrad" },
            { text: "The goal is not to sail the boat, but rather to help the boat sail herself.", author: "John Rousmaniere" },
            { text: "Those who live by the sea can hardly form a single thought of which the sea would not be part.", author: "Hermann Broch" },
            { text: "At sea, I learned how little a person needs, not how much.", author: "Robin Lee Graham" },
            { text: "There are good ships and wood ships, ships that sail the sea, but the best ships are friendships, may they always be.", author: "Irish Proverb" },
            { text: "The voice of the sea speaks to the soul.", author: "Kate Chopin" },
          ];
          const dayIndex = Math.floor(Date.now() / 86400000) % SEAFARER_QUOTES.length;
          const quote = SEAFARER_QUOTES[dayIndex];
          return (
            <div className="mt-2 px-1 py-2 rounded-xl hidden sm:block" style={{ background: "rgba(13,27,42,0.5)", border: "1px solid rgba(212,175,55,0.08)" }}>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed text-center">
                "{quote.text}"
              </p>
              <p className="text-[10px] text-center mt-1" style={{ color: "rgba(212,175,55,0.6)" }}>
                — {quote.author}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-start gap-3 pl-4 pr-16 py-1 lg:pl-8">
        <button onClick={() => setShowSignOffConfirm(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Anchor size={14} /> Sign Off
        </button>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <LogOut size={14} /> Sign Out
        </button>
        <button onClick={() => { setShowFeedback(true); setFeedbackDone(false); setFeedbackText(""); setFeedbackSummary(""); setFeedbackRating(0); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          ★ Feedback
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
        {/* Job match notification */}
        {screen === "chat" && jobMatch && (
          <div
            style={{
              border: "1px solid #D4AF37",
              background: "rgba(26, 58, 92, 0.9)",
              borderRadius: "10px",
              padding: "10px",
              margin: "0 16px 8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span style={{ color: "white", fontSize: "12px", flex: 1 }}>
              ⚓ New job match: <strong style={{ color: "#D4AF37" }}>{jobMatch.rank_required}</strong> on{" "}
              <strong>{jobMatch.vessel_type}</strong> vessel. Joining: {jobMatch.joining_port}
            </span>
            <button
              onClick={() => { setScreen("opportunities"); setJobMatch(null); setJobBadgeCount(0); }}
              style={{
                background: "#D4AF37",
                color: "#0a1929",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              View
            </button>
            <button
              onClick={() => setJobMatch(null)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
            >
              <X size={14} color="#888" />
            </button>
          </div>
        )}

        {screen === "chat" ? (
          profileComplete ? (onboardingComplete ? <CrewChat profileId={profileId} firstName={firstName} role={role} shipName={shipName} voyageStartDate={voyageStartDate} /> : vesselOnboardingUI) : profileGateUI
        ) : screen === "dashboard" ? (
          profileComplete ? (onboardingComplete ? <WelfareDashboard shipName={shipName} /> : vesselOnboardingUI) : profileGateUI
        ) : screen === "resthours" ? (
          profileComplete ? (onboardingComplete ? <RestHoursTracker onNavigate={(s: Screen) => setScreen(s)} profileId={profileId} /> : vesselOnboardingUI) : profileGateUI
        ) : screen === "community" ? (
          profileComplete ? (onboardingComplete ? <Community profileId={profileId} shipName={shipName} manningAgency={manningAgency} firstName={firstName} voyageStartDate={voyageStartDate} onCompleteVoyage={() => setAppState("voyage-report")} onOpenVesselRating={() => navigateTo("vesselrating")} /> : vesselOnboardingUI) : profileGateUI
        ) : screen === "opportunities" ? (
          <Opportunities profileId={profileId} firstName={firstName} role={role} nationality={nationality} shipName={shipName} />
        ) : screen === "news" ? (
          <News />
        ) : screen === "academy" ? (
          <Academy />
        ) : screen === "bridge" ? (
          <Bridge profileId={profileId} />
        ) : screen === "vesselrating" ? (
          <VesselRating onBack={() => setScreen("community")} />
        ) : screen === "resume" ? (
          <ResumeBuilder />
        ) : screen === "certs" ? (
          <CertWallet profileId={profileId} />
        ) : screen === "smc" ? (
          <SMCScoreTab profileId={profileId} firstName={firstName} lastName={lastName} rank={role} shipName={shipName} />
        ) : null}
      </div>

      <nav className="nav-glass flex items-center gap-1 py-2 px-2 overflow-x-auto scrollbar-hide lg:hidden">
        <button onClick={() => { if (!profileComplete) { setTargetScreen("chat"); setAppState("name-entry"); } else { navigateTo("chat"); } }} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "chat" ? "text-primary" : "text-muted-foreground"}`}>
          <MessageCircle size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">Chat</span>
        </button>
        <button onClick={() => { if (!profileComplete) { setTargetScreen("resthours"); setAppState("name-entry"); } else { navigateTo("resthours"); } }} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "resthours" ? "text-primary" : "text-muted-foreground"}`}>
          <span className="text-sm leading-none">⏱</span>
          <span className="text-[9px] font-medium tracking-wide uppercase">Rest</span>
        </button>
        <button onClick={() => { if (!profileComplete) { setTargetScreen("dashboard"); setAppState("name-entry"); } else { navigateTo("dashboard"); } }} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "dashboard" ? "text-primary" : "text-muted-foreground"}`}>
          <LayoutDashboard size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">Welfare</span>
        </button>
        <button onClick={() => { navigateTo("opportunities"); setJobBadgeCount(0); }} className={`relative flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "opportunities" ? "text-primary" : "text-muted-foreground"}`}>
          <div className="relative">
            <Briefcase size={16} />
            {jobBadgeCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#D4AF37] text-[#0a1929] text-[8px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                {jobBadgeCount}
              </span>
            )}
          </div>
          <span className="text-[9px] font-medium tracking-wide uppercase">Jobs</span>
        </button>
        <button onClick={() => navigateTo("resume")} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "resume" ? "text-primary" : "text-muted-foreground"}`}>
          <FileText size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">CV</span>
        </button>
        <button onClick={() => navigateTo("news")} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "news" ? "text-primary" : "text-muted-foreground"}`}>
          <Newspaper size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">News</span>
        </button>
        <button onClick={() => navigateTo("academy")} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "academy" ? "text-primary" : "text-muted-foreground"}`}>
          <GraduationCap size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">Academy</span>
        </button>
        <button onClick={() => navigateTo("bridge")} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "bridge" ? "text-primary" : "text-muted-foreground"}`}>
          <Anchor size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">PMS</span>
        </button>
        <button onClick={() => { if (!profileComplete) { setTargetScreen("community"); setAppState("name-entry"); } else { navigateTo("community"); } }} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "community" ? "text-primary" : "text-muted-foreground"}`}>
          <Compass size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">Community</span>
        </button>
        <button onClick={() => navigateTo("smc")} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "smc" ? "text-primary" : "text-muted-foreground"}`}>
          <Star size={16} />
          <span className="text-[9px] font-medium tracking-wide uppercase">SMC</span>
        </button>
        <button onClick={() => navigateTo("certs")} className={`flex flex-col items-center gap-0.5 transition-colors flex-shrink-0 min-w-[3rem] px-1 ${screen === "certs" ? "text-primary" : "text-muted-foreground"}`}>
          <span className="text-sm leading-none">📜</span>
          <span className="text-[9px] font-medium tracking-wide uppercase">Certs</span>
        </button>
      </nav>
      </div>
      </div>

      {showFeedback && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#0D1B2A] border border-[#1e3a5f] rounded-2xl p-6 w-full max-w-sm">
            {!feedbackDone ? (
              <>
                <h3 className="text-[#D4AF37] font-bold text-lg mb-1 text-center">Rate Your Experience</h3>
                <p className="text-gray-400 text-xs mb-5 text-center">How is SeaMinds helping you at sea?</p>
                {/* Star Rating */}
                <div className="flex justify-center gap-3 mb-5">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className="text-4xl transition-transform hover:scale-110"
                      style={{ color: star <= feedbackRating ? '#D4AF37' : '#2a3f5a' }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {feedbackRating > 0 && (
                  <p className="text-center text-xs text-gray-400 mb-4">
                    {feedbackRating === 1 ? 'Poor — needs major improvement' :
                     feedbackRating === 2 ? 'Fair — some issues' :
                     feedbackRating === 3 ? 'Good — meets expectations' :
                     feedbackRating === 4 ? 'Very Good — really helpful' :
                     'Excellent — love it!'}
                  </p>
                )}
                {/* Comment */}
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Any specific comments? What helped most? What can we improve?"
                  className="w-full bg-[#132236] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:border-[#D4AF37] focus:outline-none resize-none h-24 mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#1e3a5f] text-gray-400 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={feedbackLoading || feedbackRating === 0}
                    className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm disabled:opacity-40"
                  >
                    {feedbackLoading ? 'Analysing...' : 'Submit'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="flex justify-center gap-1 mb-2">
                    {[1,2,3,4,5].map(star => (
                      <span key={star} className="text-2xl" style={{ color: star <= feedbackRating ? '#D4AF37' : '#2a3f5a' }}>★</span>
                    ))}
                  </div>
                  <p className="text-green-400 text-sm font-semibold">Thank you for your feedback!</p>
                </div>
                <div className="bg-[#132236] rounded-xl p-4 mb-4">
                  <p className="text-[#D4AF37] text-xs font-bold mb-2 tracking-wide">⚡ AI REVIEW</p>
                  <p className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">{feedbackSummary}</p>
                </div>
                <p className="text-gray-500 text-xs mb-4 text-center">Reviewed by SeaMinds team only.</p>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {showNPS && <NPSSurvey firstName={firstName} onDismiss={() => setShowNPS(false)} />}

      {/* Push Notification Permission Prompt */}
      {showNotifPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-card border-t border-border rounded-t-2xl p-6 w-full max-w-md animate-in slide-in-from-bottom-4 space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-3">🔔</p>
              <h3 className="text-foreground font-bold text-lg">Stay on top of your wellness</h3>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                Get a daily check-in reminder and certificate expiry alerts — even when you're on watch.
              </p>
            </div>
            <button
              onClick={async () => {
                localStorage.setItem("seaminds_notif_asked", "true");
                try {
                  const result = await Notification.requestPermission();
                  if (result === "granted") {
                    toast({ title: "✅ Reminders enabled" });
                    setTimeout(() => {
                      new Notification("SeaMinds Daily Check-in", {
                        body: "How are you feeling today, Captain? Tap to log your mood 🔥",
                        icon: "/favicon.ico",
                      });
                    }, 86400000);
                  }
                } catch (e) {
                  console.error("Notification permission error:", e);
                }
                setShowNotifPrompt(false);
              }}
              className="w-full py-3 rounded-xl font-bold text-sm transition-colors"
              style={{ background: "#D4AF37", color: "#0D1B2A" }}
            >
              🔔 Enable Reminders
            </button>
            <button
              onClick={() => {
                localStorage.setItem("seaminds_notif_asked", "true");
                setShowNotifPrompt(false);
              }}
              className="w-full py-2 text-sm text-muted-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
