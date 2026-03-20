import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ChevronDown, CalendarIcon } from "lucide-react";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import CvUpload from "@/components/CvUpload";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import { logEvent } from "@/lib/logEvent";

interface NameEntryProps {
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    shipName: string;
    role: string;
    gender: string;
    nationality: string;
    whatsappNumber: string;
    yearsAtSea: string;
    voyageStartDate: string;
    manningAgency: string;
    vesselImo: string;
    manningAgentPhone: string;
    portOfJoining: string;
    vesselType: string;
  }, cvFile?: File) => Promise<string | undefined> | void;
}

const VESSEL_TYPES = [
  "Bulk Carrier", "Container", "Tanker", "LNG/LPG", "General Cargo",
  "Passenger/Cruise", "Offshore", "Ro-Ro", "Other",
];

const ROLES = ["Captain", "Officer", "Rating", "Engineer"];
const GENDERS = ["Male", "Female", "Prefer not to say"];
const YEARS_OPTIONS = ["Less than 1 year", "1-3 years", "3-7 years", "7-15 years", "15+ years"];
const AGENCIES = [
  "Fleet Management Ltd", "Anglo-Eastern", "Synergy Marine", "V.Group", "BSM",
  "Wilhelmsen", "Columbia Shipmanagement", "Maersk", "MSC", "NYK",
  "Mitsui OSK", "Stolt-Nielsen", "Euronav", "Other",
];
const NATIONALITIES = [
  "Filipino", "Indian", "Indonesian", "Vietnamese", "Chinese",
  "Myanmar/Burmese", "Bangladeshi", "Ukrainian", "Russian", "Croatian",
  "Greek", "Turkish", "Sri Lankan", "Pakistani", "Nepali",
  "Thai", "Malaysian", "Cambodian", "Georgian", "Azerbaijani",
  "Romanian", "Bulgarian", "Polish", "Latvian", "Lithuanian",
  "Estonian", "Norwegian", "British", "American", "Australian",
  "Nigerian", "Ghanaian", "Kenyan", "Brazilian", "South African",
  "Egyptian", "Moroccan", "Tanzanian", "Maldivian", "Singaporean",
  "South Korean", "Japanese", "Italian", "German", "Spanish",
  "Portuguese", "French", "Dutch", "Danish", "Swedish",
  "Finnish", "Peruvian", "Argentine", "Mexican", "Canadian",
  "New Zealander", "Omani", "Emirati", "Saudi", "Qatari",
  "Kuwaiti", "Bahraini", "Iranian", "Montenegrin", "Serbian",
  "Slovenian", "Albanian", "Tunisian", "Algerian", "Other",
];
const COUNTRY_CODES = [
  { flag: '🇵🇭', name: 'Philippines', code: '+63' },
  { flag: '🇮🇳', name: 'India', code: '+91' },
  { flag: '🇮🇩', name: 'Indonesia', code: '+62' },
  { flag: '🇨🇳', name: 'China', code: '+86' },
  { flag: '🇷🇺', name: 'Russia', code: '+7' },
  { flag: '🇺🇦', name: 'Ukraine', code: '+380' },
  { flag: '🇻🇳', name: 'Vietnam', code: '+84' },
  { flag: '🇲🇲', name: 'Myanmar', code: '+95' },
  { flag: '🇧🇩', name: 'Bangladesh', code: '+880' },
  { flag: '🇱🇰', name: 'Sri Lanka', code: '+94' },
  { flag: '🇹🇷', name: 'Turkey', code: '+90' },
  { flag: '🇬🇷', name: 'Greece', code: '+30' },
  { flag: '🇭🇷', name: 'Croatia', code: '+385' },
  { flag: '🇷🇴', name: 'Romania', code: '+40' },
  { flag: '🇵🇱', name: 'Poland', code: '+48' },
  { flag: '🇬🇧', name: 'United Kingdom', code: '+44' },
  { flag: '🇳🇬', name: 'Nigeria', code: '+234' },
  { flag: '🇬🇭', name: 'Ghana', code: '+233' },
  { flag: '🇰🇪', name: 'Kenya', code: '+254' },
  { flag: '🇿🇦', name: 'South Africa', code: '+27' },
  { flag: '🇪🇬', name: 'Egypt', code: '+20' },
  { flag: '🇲🇦', name: 'Morocco', code: '+212' },
  { flag: '🇵🇰', name: 'Pakistan', code: '+92' },
  { flag: '🇳🇵', name: 'Nepal', code: '+977' },
  { flag: '🇲🇻', name: 'Maldives', code: '+960' },
  { flag: '🇸🇬', name: 'Singapore', code: '+65' },
  { flag: '🇲🇾', name: 'Malaysia', code: '+60' },
  { flag: '🇹🇭', name: 'Thailand', code: '+66' },
  { flag: '🇰🇷', name: 'South Korea', code: '+82' },
  { flag: '🇯🇵', name: 'Japan', code: '+81' },
  { flag: '🇧🇷', name: 'Brazil', code: '+55' },
  { flag: '🇵🇪', name: 'Peru', code: '+51' },
  { flag: '🇦🇷', name: 'Argentina', code: '+54' },
  { flag: '🇲🇽', name: 'Mexico', code: '+52' },
  { flag: '🇺🇸', name: 'USA', code: '+1' },
  { flag: '🇨🇦', name: 'Canada', code: '+1' },
  { flag: '🇦🇺', name: 'Australia', code: '+61' },
  { flag: '🇳🇿', name: 'New Zealand', code: '+64' },
  { flag: '🇮🇹', name: 'Italy', code: '+39' },
  { flag: '🇩🇪', name: 'Germany', code: '+49' },
  { flag: '🇬🇪', name: 'Georgia', code: '+995' },
  { flag: '🇦🇿', name: 'Azerbaijan', code: '+994' },
  { flag: '🇧🇬', name: 'Bulgaria', code: '+359' },
  { flag: '🇱🇻', name: 'Latvia', code: '+371' },
  { flag: '🇱🇹', name: 'Lithuania', code: '+370' },
  { flag: '🇪🇪', name: 'Estonia', code: '+372' },
  { flag: '🇳🇴', name: 'Norway', code: '+47' },
  { flag: '🇰🇭', name: 'Cambodia', code: '+855' },
  { flag: '🇹🇿', name: 'Tanzania', code: '+255' },
  { flag: '🇪🇸', name: 'Spain', code: '+34' },
  { flag: '🇵🇹', name: 'Portugal', code: '+351' },
  { flag: '🇫🇷', name: 'France', code: '+33' },
  { flag: '🇳🇱', name: 'Netherlands', code: '+31' },
  { flag: '🇩🇰', name: 'Denmark', code: '+45' },
  { flag: '🇸🇪', name: 'Sweden', code: '+46' },
  { flag: '🇫🇮', name: 'Finland', code: '+358' },
  { flag: '🇴🇲', name: 'Oman', code: '+968' },
  { flag: '🇦🇪', name: 'UAE', code: '+971' },
  { flag: '🇸🇦', name: 'Saudi Arabia', code: '+966' },
  { flag: '🇶🇦', name: 'Qatar', code: '+974' },
  { flag: '🇰🇼', name: 'Kuwait', code: '+965' },
  { flag: '🇧🇭', name: 'Bahrain', code: '+973' },
  { flag: '🇮🇷', name: 'Iran', code: '+98' },
  { flag: '🇲🇪', name: 'Montenegro', code: '+382' },
  { flag: '🇷🇸', name: 'Serbia', code: '+381' },
  { flag: '🇸🇮', name: 'Slovenia', code: '+386' },
  { flag: '🇦🇱', name: 'Albania', code: '+355' },
  { flag: '🇹🇳', name: 'Tunisia', code: '+216' },
  { flag: '🇩🇿', name: 'Algeria', code: '+213' },
];

const NATIONALITY_TO_CODE: Record<string, string> = {
  "Filipino": "+63", "Indian": "+91", "Indonesian": "+62", "Vietnamese": "+84",
  "Chinese": "+86", "Myanmar/Burmese": "+95", "Bangladeshi": "+880", "Ukrainian": "+380",
  "Russian": "+7", "Croatian": "+385", "Greek": "+30", "Turkish": "+90",
  "Sri Lankan": "+94", "Pakistani": "+92", "Nepali": "+977", "Thai": "+66",
  "Malaysian": "+60", "Cambodian": "+855", "Georgian": "+995", "Azerbaijani": "+994",
  "Romanian": "+40", "Bulgarian": "+359", "Polish": "+48", "Latvian": "+371",
  "Lithuanian": "+370", "Estonian": "+372", "Norwegian": "+47", "British": "+44",
  "American": "+1", "Australian": "+61", "Nigerian": "+234", "Ghanaian": "+233",
  "Kenyan": "+254", "Brazilian": "+55", "South African": "+27", "Egyptian": "+20",
  "Moroccan": "+212", "Tanzanian": "+255", "Maldivian": "+960", "Singaporean": "+65",
  "South Korean": "+82", "Japanese": "+81", "Italian": "+39", "German": "+49",
  "Spanish": "+34", "Portuguese": "+351", "French": "+33", "Dutch": "+31",
  "Danish": "+45", "Swedish": "+46", "Finnish": "+358", "Peruvian": "+51",
  "Argentine": "+54", "Mexican": "+52", "Canadian": "+1", "New Zealander": "+64",
  "Omani": "+968", "Emirati": "+971", "Saudi": "+966", "Qatari": "+974",
  "Kuwaiti": "+965", "Bahraini": "+973", "Iranian": "+98", "Montenegrin": "+382",
  "Serbian": "+381", "Slovenian": "+386", "Albanian": "+355", "Tunisian": "+216",
  "Algerian": "+213",
};

const selectClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary appearance-none";
const inputClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";
const labelClass = "text-xs text-muted-foreground uppercase tracking-wide";

const normalizeRole = (role: string): string => {
  const r = (role || '').toLowerCase();
  if (r.includes('captain') || r.includes('master')) return 'Master';
  if (r.includes('chief officer') || r.includes('1st officer') || r.includes('first officer')) return 'Chief Officer';
  if (r.includes('2nd officer') || r.includes('second officer')) return '2nd Officer';
  if (r.includes('3rd officer') || r.includes('third officer')) return '3rd Officer';
  if (r.includes('chief engineer')) return 'Chief Engineer';
  if (r.includes('2nd engineer') || r.includes('second engineer')) return '2nd Engineer';
  if (r.includes('3rd engineer') || r.includes('third engineer')) return '3rd Engineer';
  if (r.includes('4th engineer') || r.includes('fourth engineer')) return '4th Engineer';
  if (r.includes('eto') || r.includes('electrical')) return 'ETO';
  if (r.includes('bosun')) return 'Bosun';
  if (r.includes('engineer')) return '2nd Engineer';
  if (r.includes('officer')) return '2nd Officer';
  return role;
};

const NameEntry = ({ onSubmit }: NameEntryProps) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [shipName, setShipName] = useState("");
  const [role, setRole] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [countryCode, setCountryCode] = useState("+63");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [yearsAtSea, setYearsAtSea] = useState("");
  const [voyageStartDate, setVoyageStartDate] = useState<Date>();
  const [manningAgency, setManningAgency] = useState("");
  const [vesselImo, setVesselImo] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [showAgencyDropdown, setShowAgencyDropdown] = useState(false);
  const [cvFile, setCvFile] = useState<File | undefined>();
  const [manningAgentPhone, setManningAgentPhone] = useState("");
  const [agentCountryCode, setAgentCountryCode] = useState("+63");
  const [portOfJoiningVal, setPortOfJoiningVal] = useState("");
  const [vesselTypeVal, setVesselTypeVal] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-select country code when nationality changes
  useEffect(() => {
    if (nationality && NATIONALITY_TO_CODE[nationality]) {
      setCountryCode(NATIONALITY_TO_CODE[nationality]);
    }
  }, [nationality]);

  const canSubmit =
    firstName.trim() && lastName.trim() && shipName.trim() && role &&
    nationality.trim() && yearsAtSea && phoneNumber.trim();

  const cleanWhatsappNumber = (dialCode: string, rawNumber: string): string => {
    let clean = (dialCode + rawNumber.trim()).replace(/\s/g, '');
    const code = dialCode.replace('+', '');
    if (clean.startsWith('+' + code + '00' + code)) {
      clean = '+' + code + clean.substring(('+' + code + '00' + code).length);
    }
    if (clean.startsWith('+' + code + '0')) {
      clean = '+' + code + clean.substring(('+' + code + '0').length);
    }
    return clean;
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setFormError("");
    setSubmitting(true);
    try {
      const cleanedWhatsapp = cleanWhatsappNumber(countryCode, phoneNumber);
      const errorMsg = await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        shipName: shipName.trim(),
        role: normalizeRole(role),
        gender,
        nationality: nationality.trim(),
        whatsappNumber: cleanedWhatsapp,
        yearsAtSea,
        voyageStartDate: voyageStartDate ? format(voyageStartDate, "yyyy-MM-dd") : "",
        manningAgency: manningAgency.trim(),
        vesselImo: vesselImo.trim(),
        manningAgentPhone: manningAgentPhone.trim() ? `${agentCountryCode}${manningAgentPhone.trim()}` : "",
        portOfJoining: portOfJoiningVal.trim(),
        vesselType: vesselTypeVal,
      }, cvFile);
      if (errorMsg) setFormError(errorMsg);
      else await logEvent('crew_signup', 'New crew signed up', 'info', { name: `${firstName.trim()} ${lastName.trim()}`, rank: role, nationality: nationality.trim() });
    } catch (err: any) {
      console.error('Failed to create profile:', err);
      await logEvent('profile_create_error', err?.message || 'Unknown error', 'error', { code: err?.code });
      
      if (err?.code === '23505' || err?.message?.includes('duplicate')) {
        if (err?.message?.includes('whatsapp')) {
          alert('This WhatsApp number is already registered. Please use a different number or sign in to your existing account.');
        } else {
          alert('An account with these details already exists. Please sign out and sign in again.');
        }
      } else if (err?.code === '23514' || err?.message?.includes('check constraint')) {
        alert('There was an issue with your role selection. Please select your role again from the dropdown.');
      } else {
        alert('Could not save your profile. Please check your details and try again. Error: ' + (err?.message || 'Unknown error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-md space-y-6 py-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto overflow-hidden">
            <img src={seamindsLogo} alt="SeaMinds" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to SeaMinds</h1>
          <p className="text-sm text-muted-foreground">Tell us a little about yourself</p>
        </div>

        <div className="space-y-4">
          {/* CV Upload */}
          <CvUpload
            onParsed={(data) => {
              if (data.firstName) setFirstName(data.firstName);
              if (data.lastName) setLastName(data.lastName);
              if (data.shipName) setShipName(data.shipName);
              if (data.role) setRole(data.role);
              if (data.nationality) setNationality(data.nationality);
              if (data.yearsAtSea) setYearsAtSea(data.yearsAtSea);
              if (data.vesselImo) setVesselImo(data.vesselImo);
              if (data.whatsappNumber) setPhoneNumber(data.whatsappNumber);
            }}
            onFileReady={(file) => setCvFile(file)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>First Name *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Rajan" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Last Name *</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Santos" className={inputClass} />
            </div>
          </div>

          {/* Ship Name */}
          <div className="space-y-1.5">
            <label className={labelClass}>Ship Name *</label>
            <input type="text" value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="e.g. MV Pacific Star" className={inputClass} />
          </div>

          {/* Vessel IMO Number */}
          <div className="space-y-1.5">
            <label className={labelClass}>Vessel IMO Number (optional)</label>
            <input type="text" value={vesselImo} onChange={(e) => setVesselImo(e.target.value)} placeholder="e.g. 9234567" className={inputClass} />
          </div>


          {/* Voyage Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Voyage Start Date</label>
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

          {/* Role + Gender */}
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

          {/* Nationality + Manning Agency */}
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
            <div className="space-y-1.5 relative">
              <label className={labelClass}>Manning Agency</label>
              <input
                type="text"
                value={manningAgency}
                onChange={(e) => {
                  setManningAgency(e.target.value);
                  setAgencyFilter(e.target.value);
                  setShowAgencyDropdown(true);
                }}
                onFocus={() => setShowAgencyDropdown(true)}
                onBlur={() => setTimeout(() => setShowAgencyDropdown(false), 150)}
                placeholder="e.g. Anglo-Eastern"
                className={inputClass}
              />
              {showAgencyDropdown && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-lg max-h-40 overflow-y-auto">
                  {AGENCIES.filter((a) => !agencyFilter || a.toLowerCase().includes(agencyFilter.toLowerCase())).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onMouseDown={() => {
                        setManningAgency(a);
                        setShowAgencyDropdown(false);
                      }}
                      className="w-full text-left text-sm px-4 py-2.5 text-foreground hover:bg-secondary transition-colors"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manning Agent Phone */}
          <div className="space-y-1.5">
            <label className={labelClass}>Manning Agent Phone (WhatsApp preferred)</label>
            <div className="flex w-full gap-2">
              <CountryCodeSelect value={agentCountryCode} onChange={setAgentCountryCode} codes={COUNTRY_CODES} />
              <input
                type="tel"
                inputMode="numeric"
                value={manningAgentPhone}
                onChange={(e) => setManningAgentPhone(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Agent WhatsApp number"
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>

          {/* Port of Joining + Vessel Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Port of Joining</label>
              <input type="text" value={portOfJoiningVal} onChange={(e) => setPortOfJoiningVal(e.target.value)} placeholder="e.g. Singapore" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Vessel Type</label>
              <div className="relative">
                <select value={vesselTypeVal} onChange={(e) => setVesselTypeVal(e.target.value)} className={selectClass}>
                  <option value="">Select vessel type</option>
                  {VESSEL_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div />
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-1.5">
            <label className={labelClass}>WhatsApp Number *</label>
            <div className="flex w-full gap-2">
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} codes={COUNTRY_CODES} />
              <input
                type="tel"
                inputMode="numeric"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="WhatsApp number"
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>
        </div>

        {formError && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity"
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
};

export default NameEntry;
