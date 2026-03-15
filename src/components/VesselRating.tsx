import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VesselRatingProps {
  onBack: () => void;
}

const VESSEL_TYPES = ["Container", "Tanker", "Bulk", "LNG", "General Cargo", "Offshore"];

const CATEGORIES = [
  { key: "food", emoji: "🍽️", label: "Food Quality" },
  { key: "accommodation", emoji: "🛏️", label: "Accommodation" },
  { key: "officers", emoji: "👔", label: "Officers / Management" },
  { key: "work_hours", emoji: "⏱️", label: "Work Hours" },
  { key: "internet", emoji: "📶", label: "Internet / Connectivity" },
  { key: "safety", emoji: "🛡️", label: "Safety Culture" },
] as const;

type Ratings = Record<typeof CATEGORIES[number]["key"], number>;

const StarRow = ({ label, emoji, value, onChange }: { label: string; emoji: string; value: number; onChange: (v: number) => void }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-sm text-foreground flex items-center gap-1.5 min-w-0">
      <span>{emoji}</span>
      <span className="truncate">{label}</span>
    </span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="text-xl transition-transform hover:scale-110"
          style={{ color: star <= value ? "#D4AF37" : "#2a3f5a" }}
        >
          ★
        </button>
      ))}
    </div>
  </div>
);

interface RecentRating {
  id: string;
  vessel_name: string;
  vessel_type: string;
  food: number;
  accommodation: number;
  officers: number;
  work_hours: number;
  internet: number;
  safety: number;
  created_at: string;
}

const VesselRating = ({ onBack }: VesselRatingProps) => {
  const [vesselName, setVesselName] = useState("");
  const [company, setCompany] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [ratings, setRatings] = useState<Ratings>({ food: 0, accommodation: 0, officers: 0, work_hours: 0, internet: 0, safety: 0 });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);

  useEffect(() => {
    loadRecent();
  }, []);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("vessel_ratings")
      .select("id, vessel_name, vessel_type, food, accommodation, officers, work_hours, internet, safety, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setRecentRatings(data as RecentRating[]);
  };

  const allRated = Object.values(ratings).every((v) => v > 0);
  const canSubmit = vesselName.trim() && vesselType && allRated;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const { error } = await supabase.from("vessel_ratings").insert({
      vessel_name: vesselName.trim(),
      company: company.trim() || null,
      vessel_type: vesselType,
      ...ratings,
      comment: comment.trim() || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit rating");
      return;
    }
    setSubmitted(true);
    toast.success("Rating submitted anonymously!");
    loadRecent();
  };

  const getAvg = (r: RecentRating) => {
    const sum = r.food + r.accommodation + r.officers + r.work_hours + r.internet + r.safety;
    return (sum / 6).toFixed(1);
  };

  const renderStars = (avg: number) => {
    const full = Math.round(avg);
    return (
      <span className="text-sm">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} style={{ color: s <= full ? "#D4AF37" : "#2a3f5a" }}>★</span>
        ))}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 lg:pt-8 pb-4 border-b border-border">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft size={14} /> Back to Community
        </button>
        <h1 className="text-xl font-bold" style={{ color: "#D4AF37" }}>⭐ Rate Your Vessel</h1>
        <p className="text-xs text-muted-foreground mt-1">Anonymous. Moderated. Your voice matters.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {/* Rating Form */}
        {!submitted ? (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <input
              type="text"
              value={vesselName}
              onChange={(e) => setVesselName(e.target.value)}
              placeholder="MV Pacific Star"
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground -mt-2 ml-1">Vessel Name *</p>

            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Shipping company (optional)"
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />

            <select
              value={vesselType}
              onChange={(e) => setVesselType(e.target.value)}
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select Vessel Type *</option>
              {VESSEL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <div className="space-y-3 pt-2">
              {CATEGORIES.map((cat) => (
                <StarRow
                  key={cat.key}
                  emoji={cat.emoji}
                  label={cat.label}
                  value={ratings[cat.key]}
                  onChange={(v) => setRatings((prev) => ({ ...prev, [cat.key]: v }))}
                />
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell other seafarers what it's really like..."
              rows={3}
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
            />

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-30"
              style={{ background: "#D4AF37", color: "#0D1B2A" }}
            >
              {submitting ? "Submitting..." : "Submit Anonymously"}
            </button>

            <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
              Your name and profile are never attached to this review. Reviews are moderated.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-primary/30 p-6 text-center space-y-3">
            <p className="text-3xl">✅</p>
            <p className="text-foreground font-semibold">Thank you!</p>
            <p className="text-sm text-muted-foreground">Your anonymous rating has been submitted.</p>
            <button
              onClick={() => { setSubmitted(false); setVesselName(""); setCompany(""); setVesselType(""); setRatings({ food: 0, accommodation: 0, officers: 0, work_hours: 0, internet: 0, safety: 0 }); setComment(""); }}
              className="text-xs text-primary underline"
            >
              Rate another vessel
            </button>
          </div>
        )}

        {/* Recent Ratings */}
        {recentRatings.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Recent Ratings</p>
            {recentRatings.map((r) => (
              <div key={r.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{r.vessel_name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">{r.vessel_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  {renderStars(parseFloat(getAvg(r)))}
                  <span className="text-xs text-muted-foreground">{getAvg(r)} / 5</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
};

export default VesselRating;
