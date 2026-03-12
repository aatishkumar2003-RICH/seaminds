import { useState } from "react";
import { Ship, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VesselOnboardingCardProps {
  profileId: string;
  existingShipName?: string;
  existingRole?: string;
  onBack?: () => void;
  onComplete: (data: { vesselName: string; vesselType: string; rank: string; portOfJoining: string }) => void;
}

const RANKS = [
  "Captain / Master", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer",
  "ETO / EEO", "Bosun", "AB Seaman", "Ordinary Seaman (OS)",
  "Fitter", "Oiler", "Cook", "Messman / Steward", "Deck Cadet", "Engine Cadet",
];

const VESSEL_TYPES = [
  "Bulk Carrier", "Container Ship", "Tanker (Oil)", "Tanker (Chemical)",
  "LNG / LPG Carrier", "General Cargo", "Ro-Ro / Car Carrier",
  "Cruise Ship", "Offshore / AHTS", "Tug / Barge", "Passenger / Ferry", "Other",
];

const VesselOnboardingCard = ({ profileId, existingShipName, existingRole, onBack, onComplete }: VesselOnboardingCardProps) => {
  const [vesselName, setVesselName] = useState(existingShipName || "");
  const [vesselType, setVesselType] = useState("");
  const [rank, setRank] = useState(existingRole || "");
  const [portOfJoining, setPortOfJoining] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = vesselName.trim() && vesselType && rank;

  const normalizeRole = (selectedRank: string) => {
    const r = selectedRank.toLowerCase();
    if (r.includes("captain") || r.includes("master")) return "Captain";
    if (r.includes("engineer") || r.includes("eto") || r.includes("eeo")) return "Engineer";
    if (r.includes("officer")) return "Officer";
    return "Rating";
  };

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const normalizedRole = normalizeRole(rank);
      const { error } = await supabase
        .from("crew_profiles")
        .update({
          ship_name: vesselName.trim(),
          vessel_type: vesselType,
          role: normalizedRole,
          port_of_joining: portOfJoining.trim(),
          onboarding_complete: true,
        } as any)
        .eq("id", profileId);

      if (error) throw error;
      onComplete({ vesselName: vesselName.trim(), vesselType, rank: normalizedRole, portOfJoining: portOfJoining.trim() });
    } catch (e: any) {
      console.error("Onboarding save failed:", e);
      toast.error("Failed to save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-[#132236] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:outline-none placeholder:text-gray-600";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-6 pb-8 text-center" style={{ background: "#0D1B2A" }}>
      {/* Header row with back arrow */}
      <div className="flex items-center justify-between sticky top-0 py-3 z-10" style={{ background: "#0D1B2A" }}>
        {onBack ? (
          <button onClick={onBack} className="p-1.5 -ml-1.5" aria-label="Back to News">
            <ArrowLeft size={20} color="#D4AF37" />
          </button>
        ) : <div className="w-8" />}
        <span className="text-sm font-semibold" style={{ color: "#D4AF37" }}>Complete Your Profile</span>
        <div className="w-8" />
      </div>

      <div className="text-primary mb-4 mt-2">
        <Ship size={48} strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-bold mb-1 text-primary">Let's get started</h2>
      <p className="text-sm mb-6" style={{ color: "#9CA3AF" }}>
        Tell us about your vessel so we can personalise your experience.
      </p>

      <div className="w-full max-w-sm space-y-3">
        <input
          className={inputClass}
          placeholder="Vessel Name (e.g. MV Pacific Star)"
          value={vesselName}
          onChange={(e) => setVesselName(e.target.value)}
        />

        <select
          className={inputClass}
          value={vesselType}
          onChange={(e) => setVesselType(e.target.value)}
        >
          <option value="">Select vessel type...</option>
          {VESSEL_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className={inputClass}
          value={rank}
          onChange={(e) => setRank(e.target.value)}
        >
          <option value="">Select your rank...</option>
          {RANKS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <input
          className={inputClass}
          placeholder="Port of Joining (e.g. Singapore)"
          value={portOfJoining}
          onChange={(e) => setPortOfJoining(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="w-full py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40"
          style={{ background: "#D4AF37", color: "#0D1B2A" }}
        >
          {saving ? "Saving..." : "Continue →"}
        </button>
      </div>
    </div>
  );
};

export default VesselOnboardingCard;
