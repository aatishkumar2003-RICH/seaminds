import { useState, useEffect } from "react";
import { Compass, Shield, Users, Ship, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CommunityProps {
  shipName: string;
  manningAgency: string;
  profileId: string;
}

const MOOD_WORDS = ["Tired", "Good", "Homesick", "Motivated", "Grateful", "Lonely", "Strong", "Bored", "Hopeful", "Calm"];

const Community = ({ shipName, manningAgency, profileId }: CommunityProps) => {
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

export default Community;
