import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Anchor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RANKS = [
  "Master", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer",
  "ETO", "Chief Cook", "2nd Cook", "Messman", "Steward",
  "AB", "OS", "Oiler", "Motorman", "Wiper",
  "DP Operator", "Crane Operator", "Bosun", "Other",
];

const DEPARTMENTS = ["Deck", "Engine", "Catering", "ETO", "Offshore"];

const VESSEL_TYPES = [
  "Crude Tanker", "Chemical Tanker", "LNG Carrier",
  "Bulk Carrier", "Container Ship", "Offshore",
  "Barge", "Passenger", "General Cargo", "Other",
];

const COUNTRIES = [
  "Philippines", "India", "Indonesia", "Vietnam", "China",
  "Myanmar", "Bangladesh", "Ukraine", "Russia", "Croatia",
  "Greece", "Turkey", "Sri Lanka", "Pakistan", "Nepal",
  "Thailand", "Malaysia", "Cambodia", "Georgia", "Azerbaijan",
  "Romania", "Bulgaria", "Poland", "Latvia", "Lithuania",
  "Estonia", "Norway", "United Kingdom", "United States", "Australia",
  "Nigeria", "Ghana", "Kenya", "Brazil", "Japan",
  "South Korea", "Germany", "Italy", "Spain", "France",
  "Canada", "Mexico", "South Africa", "Egypt", "Other",
];

const ProfileCompletion = () => {
  const { authUser } = useUser();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [rank, setRank] = useState("");
  const [department, setDepartment] = useState("");
  const [nationality, setNationality] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [totalSeaMonths, setTotalSeaMonths] = useState("");
  const [currentlyAtSea, setCurrentlyAtSea] = useState(false);
  const [vesselImo, setVesselImo] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Safety net: force redirect if stuck saving for 5+ seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (saving) {
        window.location.href = '/app';
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [saving]);

  const handleSave = async () => {
    if (saving) return;
    if (!fullName.trim() || !rank || !department || !nationality) {
      toast({ title: "Required fields missing", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (!authUser) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: authUser.id,
          full_name: fullName.trim(),
          rank,
          department,
          nationality,
          vessel_type: vesselType || null,
          total_sea_months: parseInt(totalSeaMonths) || 0,
          currently_at_sea: currentlyAtSea,
          vessel_imo: currentlyAtSea && vesselImo ? vesselImo : null,
          company_name: companyName.trim() || null,
          profile_completed: true,
        } as any, { onConflict: 'id' });

      if (error) {
        console.error("Save error:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      toast({ title: `Welcome to SeaMinds, ${fullName.trim()}! 🚢` });

      // Force full page reload to clear any stuck auth state
      setTimeout(() => {
        window.location.href = '/app';
      }, 500);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Anchor className="mx-auto text-[#D4AF37]" size={32} />
          <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-sm text-muted-foreground">Tell us about your maritime career</p>
        </div>

        <div className="space-y-4 bg-card rounded-2xl p-6 border border-border">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Juan Dela Cruz" maxLength={100} required />
          </div>

          <div className="space-y-2">
            <Label>Rank *</Label>
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger><SelectValue placeholder="Select your rank" /></SelectTrigger>
              <SelectContent>{RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Department *</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nationality *</Label>
            <Select value={nationality} onValueChange={setNationality}>
              <SelectTrigger><SelectValue placeholder="Select nationality" /></SelectTrigger>
              <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vessel Type</Label>
            <Select value={vesselType} onValueChange={setVesselType}>
              <SelectTrigger><SelectValue placeholder="Select vessel type" /></SelectTrigger>
              <SelectContent>{VESSEL_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Total Sea Service (months)</Label>
            <Input type="number" min={0} max={600} value={totalSeaMonths} onChange={(e) => setTotalSeaMonths(e.target.value)} placeholder="e.g. 48" />
          </div>

          <div className="flex items-center justify-between">
            <Label>Currently at sea?</Label>
            <Switch checked={currentlyAtSea} onCheckedChange={setCurrentlyAtSea} />
          </div>

          {currentlyAtSea && (
            <div className="space-y-2">
              <Label>Vessel IMO Number (optional)</Label>
              <Input value={vesselImo} onChange={(e) => setVesselImo(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="e.g. 9876543" maxLength={7} />
              <p className="text-xs text-muted-foreground">🚢 AIS Tracking — Coming Soon</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Company Name (optional)</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Fleet Management Ltd" maxLength={100} />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#D4AF37] hover:bg-[#C49B2F] text-[#0D1B2A] font-semibold">
            {saving ? "Saving..." : "Enter SeaMinds →"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletion;
