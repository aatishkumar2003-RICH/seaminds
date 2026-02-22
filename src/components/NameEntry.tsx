import { useState } from "react";
import { format } from "date-fns";
import { Anchor, ChevronDown, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface NameEntryProps {
  onSubmit: (data: {
    firstName: string;
    shipName: string;
    role: string;
    gender: string;
    nationality: string;
    whatsappNumber: string;
    yearsAtSea: string;
    voyageStartDate: string;
  }) => void;
}

const ROLES = ["Captain", "Officer", "Rating", "Engineer"];
const GENDERS = ["Male", "Female", "Prefer not to say"];
const YEARS_OPTIONS = ["Less than 1 year", "1-3 years", "3-7 years", "7-15 years", "15+ years"];
const NATIONALITIES = [
  "Filipino", "Indian", "Indonesian", "Ukrainian", "Russian",
  "Chinese", "Myanmar", "Bangladeshi", "Croatian", "Greek",
  "British", "American", "Other",
];
const COUNTRY_CODES = [
  { code: "+63", label: "🇵🇭 +63" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+62", label: "🇮🇩 +62" },
  { code: "+380", label: "🇺🇦 +380" },
  { code: "+7", label: "🇷🇺 +7" },
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+95", label: "🇲🇲 +95" },
  { code: "+880", label: "🇧🇩 +880" },
  { code: "+385", label: "🇭🇷 +385" },
  { code: "+30", label: "🇬🇷 +30" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+1", label: "🇺🇸 +1" },
];

const selectClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary appearance-none";
const inputClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";
const labelClass = "text-xs text-muted-foreground uppercase tracking-wide";

const NameEntry = ({ onSubmit }: NameEntryProps) => {
  const [firstName, setFirstName] = useState("");
  const [shipName, setShipName] = useState("");
  const [role, setRole] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [countryCode, setCountryCode] = useState("+63");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [yearsAtSea, setYearsAtSea] = useState("");
  const [voyageStartDate, setVoyageStartDate] = useState<Date>();

  const canSubmit = firstName.trim() && shipName.trim() && role && nationality.trim() && phoneNumber.trim() && yearsAtSea && voyageStartDate;


  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      firstName: firstName.trim(),
      shipName: shipName.trim(),
      role,
      gender,
      nationality: nationality.trim(),
      whatsappNumber: `${countryCode}${phoneNumber.trim()}`,
      yearsAtSea,
      voyageStartDate: voyageStartDate ? format(voyageStartDate, "yyyy-MM-dd") : "",
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 overflow-y-auto">
      <div className="w-full max-w-md space-y-6 py-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Anchor size={28} className="text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to SeaMinds</h1>
          <p className="text-sm text-muted-foreground">Tell us a little about yourself</p>
        </div>

        <div className="space-y-4">
          {/* Row 1: First Name + Ship Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>First Name *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Rajan" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Ship Name *</label>
              <input type="text" value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="e.g. MV Pacific Star" className={inputClass} />
            </div>
          </div>

          {/* Row 1.5: Voyage Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Voyage Start Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      selectClass,
                      "flex items-center justify-between text-left",
                      !voyageStartDate && "text-muted-foreground"
                    )}
                  >
                    {voyageStartDate ? format(voyageStartDate, "PPP") : "Select date"}
                    <CalendarIcon size={16} className="text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={voyageStartDate}
                    onSelect={setVoyageStartDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div />
          </div>

          {/* Row 2: Role + Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Your Role *</label>
              <div className="relative">
                <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
                  <option value="" disabled>Select role</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Gender</label>
              <div className="relative">
                <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
                  <option value="">Prefer not to say</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 3: Nationality + Years at Sea */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Nationality *</label>
              <div className="relative">
                <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={selectClass}>
                  <option value="" disabled>Select nationality</option>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Years at Sea *</label>
              <div className="relative">
                <select value={yearsAtSea} onChange={(e) => setYearsAtSea(e.target.value)} className={selectClass}>
                  <option value="" disabled>Select experience</option>
                  {YEARS_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 4: WhatsApp Number */}
          <div className="space-y-1.5">
            <label className={labelClass}>WhatsApp Number *</label>
            <div className="flex gap-2">
              <div className="relative w-28 shrink-0">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={selectClass}>
                  {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="9171234567"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default NameEntry;
