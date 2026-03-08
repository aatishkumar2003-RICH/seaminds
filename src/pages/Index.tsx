import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, LayoutDashboard, Briefcase, Newspaper, GraduationCap, Compass, Star, LogOut, Anchor, X, FileText } from "lucide-react";
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
import Bridge from "@/components/Bridge";
import SMCScoreTab from "@/components/SMCScoreTab";
import ResumeBuilder from "@/components/ResumeBuilder";
import SOSButton from "@/components/SOSButton";
import VoyageReport from "@/components/VoyageReport";
import CertWallet from "@/components/CertWallet";
import RestHoursTracker from "@/components/RestHoursTracker";
import NPSSurvey from "@/components/NPSSurvey";
type AppState = "loading" | "landing" | "name-entry" | "welcome" | "main" | "voyage-report";
type Screen = "chat" | "dashboard" | "opportunities" | "news" | "academy" | "bridge" | "community" | "smc" | "resume" | "certs" | "resthours";

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
    };
    document.title = appState === "main" ? titles[screen] : "SeaMinds";
  }, [screen, appState]);

  // Job match notification — initial check
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const savedId = localStorage.getItem('seamind_profile_id');
      if (savedId) return;
      if (session?.user) {
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Seafarer';
        const fn = fullName.split(' ')[0];
        setFirstName(fn);
        setAppState('main');
        setScreen('news');
      }
    });

    const init = async () => {
      const savedId = localStorage.getItem('seamind_profile_id');
      if (savedId) {
        const { data, error } = await supabase.from('crew_profiles').select('id, first_name, last_name, onboarded, role, ship_name, voyage_start_date, manning_agency, nationality, whatsapp_number').eq('id', savedId).single();
        if (!error && data) {
          setProfileId(data.id); setFirstName(data.first_name); setLastName(data.last_name || '');
          setRole(data.role || ''); setShipName(data.ship_name || ''); setVoyageStartDate(data.voyage_start_date || '');
          setManningAgency(data.manning_agency || ''); setNationality(data.nationality || ''); setWhatsappNumber(data.whatsapp_number || '');
          setAppState(data.onboarded ? 'main' : 'welcome');
          return;
        }
        localStorage.removeItem('seamind_profile_id');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Seafarer';
        setFirstName(fullName.split(' ')[0]);
        setAppState('main');
        setScreen('news');
        return;
      }
      setAppState('landing');
    };

    init();
    return () => subscription.unsubscribe();
  }, []);

  const handleNameSubmit = async (profile: {
    firstName: string; lastName: string; shipName: string; role: string;
    gender: string; nationality: string; whatsappNumber: string; yearsAtSea: string;
    voyageStartDate: string; manningAgency: string; vesselImo: string;
  }, cvFile?: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    const insertData: Record<string, any> = {
      first_name: profile.firstName, last_name: profile.lastName,
      ship_name: profile.shipName, role: profile.role,
      gender: profile.gender || null, nationality: profile.nationality,
      whatsapp_number: profile.whatsappNumber, years_at_sea: profile.yearsAtSea,
      voyage_start_date: profile.voyageStartDate || null,
      manning_agency: profile.manningAgency || null, vessel_imo: profile.vesselImo || null,
      onboarded: true,
    };
    if (uid) insertData.id = uid;
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
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
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
          id: uid, first_name: firstName, last_name: lastName,
          role: dbRole, nationality, ship_name: shipName,
          whatsapp_number: whatsappNumber, onboarded: true
        }).select("id").single();
        if (data) { localStorage.setItem("seamind_profile_id", data.id); setProfileId(data.id); }
      }
    }
  };

  const profileGateUI = (
    <div className="flex flex-col h-full items-center justify-center bg-[#0D1B2A] px-6 text-center">
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
          profileComplete ? <CrewChat profileId={profileId} firstName={firstName} role={role} shipName={shipName} voyageStartDate={voyageStartDate} /> : profileGateUI
        ) : screen === "dashboard" ? (
          profileComplete ? <WelfareDashboard shipName={shipName} /> : profileGateUI
        ) : screen === "opportunities" ? (
          <Opportunities profileId={profileId} firstName={firstName} role={role} nationality={nationality} shipName={shipName} />
        ) : screen === "news" ? (
          <News />
        ) : screen === "academy" ? (
          <Academy />
        ) : screen === "bridge" ? (
          <Bridge />
        ) : screen === "community" ? (
          profileComplete ? <Community profileId={profileId} shipName={shipName} manningAgency={manningAgency} firstName={firstName} voyageStartDate={voyageStartDate} onCompleteVoyage={() => setAppState("voyage-report")} /> : profileGateUI
        ) : screen === "resume" ? (
          <ResumeBuilder />
        ) : screen === "certs" ? (
          <CertWallet />
        ) : screen === "resthours" ? (
          <RestHoursTracker onNavigate={(s: Screen) => setScreen(s)} />
        ) : (
          <SMCScoreTab profileId={profileId} firstName={firstName} lastName={lastName} rank={role} shipName={shipName} />
        )}
      </div>

      <nav className="nav-glass flex items-center justify-around py-3 px-6">
        <button onClick={() => { if (!profileComplete) { setTargetScreen("chat"); setAppState("name-entry"); } else { setScreen("chat"); } }} className={`flex flex-col items-center gap-1 transition-colors ${screen === "chat" ? "text-primary" : "text-muted-foreground"}`}>
          <MessageCircle size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Chat</span>
        </button>
        <button onClick={() => setScreen("resthours")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "resthours" ? "text-primary" : "text-muted-foreground"}`}>
          <span className="text-base leading-none">⏱</span>
          <span className="text-[10px] font-medium tracking-wide uppercase">Rest</span>
        </button>
        <button onClick={() => { if (!profileComplete) { setTargetScreen("dashboard"); setAppState("name-entry"); } else { setScreen("dashboard"); } }} className={`flex flex-col items-center gap-1 transition-colors ${screen === "dashboard" ? "text-primary" : "text-muted-foreground"}`}>
          <LayoutDashboard size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Welfare</span>
        </button>
        <button onClick={() => { setScreen("opportunities"); setJobBadgeCount(0); }} className={`relative flex flex-col items-center gap-1 transition-colors ${screen === "opportunities" ? "text-primary" : "text-muted-foreground"}`}>
          <div className="relative">
            <Briefcase size={18} />
            {jobBadgeCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#D4AF37] text-[#0a1929] text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {jobBadgeCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium tracking-wide uppercase">Jobs</span>
        </button>
        <button onClick={() => setScreen("resume")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "resume" ? "text-primary" : "text-muted-foreground"}`}>
          <FileText size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">CV</span>
        </button>
        <button onClick={() => setScreen("news")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "news" ? "text-primary" : "text-muted-foreground"}`}>
          <Newspaper size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">News</span>
        </button>
        <button onClick={() => setScreen("academy")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "academy" ? "text-primary" : "text-muted-foreground"}`}>
          <GraduationCap size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Academy</span>
        </button>
        <button onClick={() => setScreen("bridge")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "bridge" ? "text-primary" : "text-muted-foreground"}`}>
          <Anchor size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">PMS</span>
        </button>
        <button onClick={() => setScreen("community")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "community" ? "text-primary" : "text-muted-foreground"}`}>
          <Compass size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Community</span>
        </button>
        <button onClick={() => { if (!profileComplete) { setTargetScreen("smc"); setAppState("name-entry"); } else { setScreen("smc"); } }} className={`flex flex-col items-center gap-1 transition-colors ${screen === "smc" ? "text-primary" : "text-muted-foreground"}`}>
          <Star size={18} />
          <span className="text-[10px] font-medium tracking-wide uppercase">SMC</span>
        </button>
        <button onClick={() => setScreen("certs")} className={`flex flex-col items-center gap-1 transition-colors ${screen === "certs" ? "text-primary" : "text-muted-foreground"}`}>
          <span className="text-base leading-none">📜</span>
          <span className="text-[10px] font-medium tracking-wide uppercase">Certs</span>
        </button>
      </nav>
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
    </div>
  );
};

export default Index;
