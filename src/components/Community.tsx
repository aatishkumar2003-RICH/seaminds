import { useState, useEffect } from "react";
import { Compass, Shield, Users, Ship, MapPin, AlertTriangle, CheckCircle, Heart, Send, Mail, Anchor, FileText, Download, Eye } from "lucide-react";
import MyDocumentsSection from "@/components/smc/MyDocumentsSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CommunityProps {
  shipName: string;
  manningAgency: string;
  profileId: string;
  firstName: string;
  voyageStartDate: string;
  onCompleteVoyage: () => void;
  onOpenVesselRating: () => void;
}

const MOOD_WORDS = ["Tired", "Good", "Homesick", "Motivated", "Grateful", "Lonely", "Strong", "Bored", "Hopeful", "Calm"];

const SAFETY_CATEGORIES = [
  { id: "physical", emoji: "🔴", label: "Physical Safety", desc: "Unsafe equipment, missing PPE, structural damage" },
  { id: "fatigue", emoji: "🟠", label: "Fatigue & Rest Hours", desc: "Pressure to work beyond STCW limits" },
  { id: "harassment", emoji: "🟡", label: "Harassment or Bullying", desc: "From any crew member or officer" },
  { id: "environmental", emoji: "🔵", label: "Environmental Violation", desc: "Illegal discharge, MARPOL breach" },
  { id: "conditions", emoji: "⚪", label: "Working Conditions", desc: "MLC 2006 violation, food, accommodation" },
  { id: "other", emoji: "🟣", label: "Other", desc: "Anything not listed above" },
];

const Community = ({ shipName, manningAgency, profileId, firstName, voyageStartDate, onCompleteVoyage, onOpenVesselRating }: CommunityProps) => {
  const [companyCount, setCompanyCount] = useState(0);
  const [vesselCount, setVesselCount] = useState(0);
  const [portInput, setPortInput] = useState("");
  const [portCount, setPortCount] = useState<number | null>(null);
  const [portSearched, setPortSearched] = useState(false);
  const [vesselWords, setVesselWords] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [shipName, manningAgency]);

  const loadData = async () => {
    setLoading(true);
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      // Vessel crew count
      const { count: vCount } = await supabase
        .from("crew_profiles")
        .select("id", { count: "exact", head: true })
        .eq("ship_name", shipName);
      setVesselCount(vCount || 0);

      // Company count (this week = created_at within last 7 days OR just total)
      if (manningAgency) {
        const { count: cCount } = await supabase
          .from("crew_profiles")
          .select("id", { count: "exact", head: true })
          .eq("manning_agency", manningAgency);
        setCompanyCount(cCount || 0);
      }

      // Load vessel mood words from chat messages (last 7 days)
      const { data: crewIds } = await supabase
        .from("crew_profiles")
        .select("id")
        .eq("ship_name", shipName);

      if (crewIds && crewIds.length > 0) {
        const ids = crewIds.map((c) => c.id);
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("content")
          .eq("role", "user")
          .in("crew_profile_id", ids)
          .gte("created_at", oneWeekAgo);

        // Extract mood words from messages
        const words: string[] = [];
        (msgs || []).forEach((m) => {
          const lower = m.content.toLowerCase();
          MOOD_WORDS.forEach((w) => {
            if (lower.includes(w.toLowerCase()) && !words.includes(w)) {
              words.push(w);
            }
          });
        });
        setVesselWords(words);
      }
    } catch (e) {
      console.error("Community load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleWordTap = async (word: string) => {
    setSelectedWord(word);
    // Store as a chat message so it appears in vessel word cloud
    await supabase.from("chat_messages").insert({
      crew_profile_id: profileId,
      role: "user",
      content: `mood word: ${word}`,
    });
    // Add to local list
    if (!vesselWords.includes(word)) {
      setVesselWords((prev) => [...prev, word]);
    }
  };

  const handlePortSearch = async () => {
    if (!portInput.trim()) return;
    setPortSearched(true);
    // Search chat messages for port mentions
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("crew_profile_id")
      .eq("role", "user")
      .ilike("content", `%port: ${portInput.trim()}%`)
      .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString());

    // Count unique crew
    const uniqueIds = new Set((msgs || []).map((m) => m.crew_profile_id));
    setPortCount(uniqueIds.size);

    // Also register current user's port
    await supabase.from("chat_messages").insert({
      crew_profile_id: profileId,
      role: "user",
      content: `port: ${portInput.trim()}`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Compass size={20} className="text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Community</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Anonymous connections across the fleet</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

        {/* SECTION 1 — My Company */}
        {manningAgency && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">My Company</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Users size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{companyCount}</p>
                <p className="text-xs text-muted-foreground">crew members on SeaMinds</p>
              </div>
            </div>
            <p className="text-sm text-foreground">
              <span className="font-medium text-primary">{companyCount}</span> crew from{" "}
              <span className="font-semibold">{manningAgency}</span> are on SeaMinds this week
            </p>
          </div>
        )}

        {/* SECTION 2 — My Vessel */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">My Vessel</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Ship size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground">
                <span className="font-medium text-primary">{vesselCount}</span> crew from{" "}
                <span className="font-semibold">{shipName}</span> have checked in on SeaMinds
              </p>
            </div>
          </div>

          {/* Word cloud */}
          <p className="text-xs text-muted-foreground mb-3">How is your day? Tap a word:</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {MOOD_WORDS.map((word) => {
              const isActive = vesselWords.includes(word);
              const isSelected = selectedWord === word;
              return (
                <button
                  key={word}
                  onClick={() => handleWordTap(word)}
                  disabled={!!selectedWord}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  } disabled:opacity-60`}
                >
                  {word}
                </button>
              );
            })}
          </div>
          {selectedWord && (
            <p className="text-xs text-primary mt-2">✓ You selected "{selectedWord}"</p>
          )}
        </div>

        {/* SECTION 3 — Port Community */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Port Community</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <MapPin size={18} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Find crew in your port</p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={portInput}
              onChange={(e) => {
                setPortInput(e.target.value);
                setPortSearched(false);
              }}
              placeholder="Enter your current port"
              className="flex-1 bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handlePortSearch}
              disabled={!portInput.trim()}
              className="bg-primary text-primary-foreground text-sm font-medium px-4 py-3 rounded-xl disabled:opacity-30 transition-opacity"
            >
              Search
            </button>
          </div>

          {portSearched && portCount !== null && (
            <div className="mt-4 bg-secondary rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{portCount + 1}</p>
              <p className="text-xs text-muted-foreground mt-1">
                SeaMinds crew in {portInput} today
              </p>
              <p className="text-sm text-foreground mt-3 italic">
                You are not alone in this port.
              </p>
            </div>
          )}
        </div>

        {/* SECTION — My Documents */}
        <MyDocumentsSection profileId={profileId} />

        {/* SECTION 4 — Family Connection */}
        <FamilyConnectionSection profileId={profileId} firstName={firstName} shipName={shipName} voyageStartDate={voyageStartDate} />

        {/* SECTION 5 — Complete My Voyage */}
        <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Voyage Completion</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Anchor size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ready to sign off?</p>
              <p className="text-[11px] text-muted-foreground">Generate your personal voyage summary report</p>
            </div>
          </div>
          <button
            onClick={onCompleteVoyage}
            className="w-full bg-primary text-primary-foreground text-sm font-medium rounded-xl py-3 transition-opacity hover:opacity-90"
          >
            Complete My Voyage
          </button>
        </div>

        {/* SECTION 6 — Anonymous Safety Reporting */}
        <SafetyReportSection shipName={shipName} manningAgency={manningAgency} />

        {/* SECTION — Rate Your Vessel */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">⭐</div>
            <div>
              <p className="text-sm font-medium text-foreground">Rate Your Vessel</p>
              <p className="text-[11px] text-muted-foreground">Anonymous reviews by seafarers, for seafarers</p>
            </div>
          </div>
          <button
            onClick={onOpenVesselRating}
            className="w-full bg-primary text-primary-foreground text-sm font-medium rounded-xl py-3 transition-opacity hover:opacity-90"
          >
            Rate a Vessel →
          </button>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-start gap-3 bg-card rounded-2xl px-5 py-4 border border-border">
          <Shield size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            All community features are anonymous. Your name and conversations are never shared.
          </p>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
};




/* Family Connection Sub-component */
const FAMILY_EMAIL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/family-email`;

const FamilyConnectionSection = ({ profileId, firstName, shipName, voyageStartDate }: {
  profileId: string; firstName: string; shipName: string; voyageStartDate: string;
}) => {
  const [familyName, setFamilyName] = useState("");
  const [familyRelation, setFamilyRelation] = useState("");
  const [familyEmail, setFamilyEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [personalMessage, setPersonalMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("family_connections")
        .select("*")
        .eq("crew_profile_id", profileId)
        .single();
      if (data) {
        setFamilyName(data.family_name);
        setFamilyRelation(data.family_relation);
        setFamilyEmail(data.family_email);
        setEnabled(data.enabled);
        setSaved(true);
        setConnectionId(data.id);
      }
      setLoading(false);
    };
    load();
  }, [profileId]);

  const voyageDays = voyageStartDate
    ? Math.max(1, Math.ceil((Date.now() - new Date(voyageStartDate).getTime()) / 86400000))
    : 0;

  const handleSave = async () => {
    if (!familyName.trim() || !familyEmail.trim() || !familyRelation.trim()) return;
    setLoading(true);

    if (connectionId) {
      await supabase.from("family_connections").update({
        family_name: familyName.trim(),
        family_relation: familyRelation.trim(),
        family_email: familyEmail.trim(),
        enabled,
      }).eq("id", connectionId);
    } else {
      const { data } = await supabase.from("family_connections").insert({
        crew_profile_id: profileId,
        family_name: familyName.trim(),
        family_relation: familyRelation.trim(),
        family_email: familyEmail.trim(),
        enabled,
      }).select("id").single();
      if (data) setConnectionId(data.id);
    }
    setSaved(true);
    setLoading(false);
    toast.success("Family connection saved");
  };

  const handleToggle = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (connectionId) {
      await supabase.from("family_connections").update({ enabled: newEnabled }).eq("id", connectionId);
    }
  };

  const handleSendMessage = async () => {
    if (!personalMessage.trim() || !familyEmail) return;
    setSending(true);
    try {
      const res = await fetch(FAMILY_EMAIL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          to: familyEmail,
          familyName,
          crewName: firstName,
          shipName,
          voyageDay: voyageDays,
          personalMessage: personalMessage.trim(),
        }),
      });
      if (res.ok) {
        toast.success(`Message sent to ${familyName}`);
        setPersonalMessage("");
      } else {
        toast.error("Failed to send message");
      }
    } catch {
      toast.error("Failed to send message");
    }
    setSending(false);
  };

  const msgWordCount = personalMessage.trim().split(/\s+/).filter(Boolean).length;

  if (loading) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Family Connection</p>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Heart size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Connect Your Family to Your Voyage</p>
          <p className="text-[11px] text-muted-foreground">Weekly welfare updates sent to your loved one</p>
        </div>
      </div>

      {!saved ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">Name</label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g. Maria"
                className="w-full bg-secondary text-foreground text-sm rounded-xl px-3 py-2.5 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">Relation</label>
              <input
                type="text"
                value={familyRelation}
                onChange={(e) => setFamilyRelation(e.target.value)}
                placeholder="e.g. Wife"
                className="w-full bg-secondary text-foreground text-sm rounded-xl px-3 py-2.5 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase">Email</label>
            <input
              type="email"
              value={familyEmail}
              onChange={(e) => setFamilyEmail(e.target.value)}
              placeholder="maria@email.com"
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-3 py-2.5 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!familyName.trim() || !familyEmail.trim() || !familyRelation.trim()}
            className="w-full bg-primary text-primary-foreground text-sm font-medium rounded-xl py-3 disabled:opacity-30 transition-opacity"
          >
            Save Family Connection
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connection info */}
          <div className="bg-secondary rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{familyName} — {familyRelation}</p>
              <p className="text-xs text-muted-foreground">{familyEmail}</p>
            </div>
            <button onClick={() => setSaved(false)} className="text-xs text-primary">Edit</button>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Weekly Welfare Updates</p>
              <p className="text-[11px] text-muted-foreground">Send mood & voyage day every Sunday</p>
            </div>
            <button
              onClick={handleToggle}
              className={`relative w-14 h-7 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Send personal message */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Send size={14} className="text-primary" />
              <p className="text-xs font-medium text-foreground">Send Message to Family Now</p>
            </div>
            <textarea
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              placeholder="Write a short personal note..."
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-none"
            />
            <div className="flex items-center justify-between">
              <p className={`text-[11px] ${msgWordCount > 100 ? "text-red-400" : "text-muted-foreground"}`}>
                {msgWordCount}/100 words
              </p>
              <button
                onClick={handleSendMessage}
                disabled={!personalMessage.trim() || msgWordCount > 100 || sending}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg px-4 py-2 disabled:opacity-30 transition-opacity"
              >
                <Mail size={12} />
                {sending ? "Sending..." : "Send Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <div className="bg-secondary/50 rounded-xl p-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Your conversation content is never included in family emails. Only mood and voyage day are shared — and only if you choose to enable this feature. You can disable at any time.
        </p>
      </div>
    </div>
  );
};

/* Safety Report Sub-component */
const SafetyReportSection = ({ shipName, manningAgency }: { shipName: string; manningAgency: string }) => {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
  const canSubmit = category && wordCount >= 10 && wordCount <= 200;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await supabase.from("safety_reports").insert({
      ship_name: shipName,
      manning_agency: manningAgency || null,
      category,
      description: description.trim(),
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-card rounded-2xl border border-emerald-500/30 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle size={24} className="text-emerald-400" />
          <p className="text-sm font-semibold text-foreground">Report Received</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your report has been received. Your identity is completely protected. The welfare officer will review this within 24 hours. You cannot be identified or penalised for submitting this report under MLC 2006 Article III.
        </p>
        <button
          onClick={() => { setSubmitted(false); setShowForm(false); setCategory(""); setDescription(""); }}
          className="text-xs text-primary font-medium"
        >
          Done
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Safety Reporting</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Report a Safety Concern</p>
            <p className="text-xs text-muted-foreground">Anonymous & Confidential</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-xl py-3 transition-colors"
        >
          Report Safety Concern
        </button>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Under ISM Code and MLC 2006 every seafarer has the right to report safety concerns without fear of retaliation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Report a Safety Concern — Anonymous & Confidential</p>

      {/* Category selection */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Select category:</p>
        {SAFETY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors border ${
              category === cat.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
            }`}
          >
            <span className="text-lg">{cat.emoji}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{cat.label}</p>
              <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Description */}
      {category && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Describe the concern (10–200 words):</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you have observed..."
            className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-none"
          />
          <p className={`text-[11px] ${wordCount >= 10 && wordCount <= 200 ? "text-emerald-400" : "text-muted-foreground"}`}>
            {wordCount} / 200 words {wordCount < 10 && `(minimum 10)`}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => { setShowForm(false); setCategory(""); setDescription(""); }} className="flex-1 bg-secondary text-muted-foreground text-sm rounded-xl py-3 font-medium">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-sm rounded-xl py-3 font-medium transition-colors"
        >
          {submitting ? "Submitting..." : "Submit Report"}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
        Under ISM Code and MLC 2006 every seafarer has the right to report safety concerns without fear of retaliation.
      </p>
    </div>
  );
};

export default Community;
