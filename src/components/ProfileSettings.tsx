import { useState } from "react";
import { Ship, MapPin, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileSettingsProps {
  profileId: string;
  vesselImo: string;
  locationEnabled: boolean;
  onLocationToggle: (enabled: boolean) => void;
  onImoChange: (imo: string) => void;
}

const ProfileSettings = ({
  profileId,
  vesselImo,
  locationEnabled,
  onLocationToggle,
  onImoChange,
}: ProfileSettingsProps) => {
  const [imo, setImo] = useState(vesselImo);
  const [saving, setSaving] = useState(false);

  const saveImo = async (value: string) => {
    setImo(value);
    onImoChange(value);
    setSaving(true);
    await supabase
      .from("crew_profiles")
      .update({ vessel_imo: value } as any)
      .eq("id", profileId);
    setSaving(false);
  };

  const toggleLocation = async (checked: boolean) => {
    onLocationToggle(checked);
    await supabase
      .from("crew_profiles")
      .update({ location_enabled: checked } as any)
      .eq("id", profileId);
    toast.success(checked ? "Location personalisation enabled" : "Location personalisation disabled");
  };

  return (
    <div className="space-y-5">
      {/* IMO Number */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Ship size={16} className="text-primary" />
          <Label className="text-sm font-medium">Your Vessel IMO Number (optional)</Label>
        </div>
        <Input
          placeholder="e.g. 9876543"
          value={imo}
          onChange={(e) => saveImo(e.target.value.replace(/\D/g, "").slice(0, 7))}
          className="font-mono"
        />
        <p className="text-[10px] text-muted-foreground">
          Enter your current vessel IMO number to enable live vessel tracking in a future update
        </p>
        <Badge variant="secondary" className="text-[10px] gap-1">
          🚢 AIS Tracking — Coming Soon
        </Badge>
      </div>

      {/* Location Toggle */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Location personalisation</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Personalise your experience based on location
              </p>
            </div>
          </div>
          <Switch checked={locationEnabled} onCheckedChange={toggleLocation} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
          <Settings size={10} />
          Location detected for personalisation. See Privacy Policy. This data is never shared with employers.
        </p>
      </div>
    </div>
  );
};

export default ProfileSettings;
