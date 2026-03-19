import React, { useState, useRef, useEffect } from "react";
import {
  Camera, Plus, Trash2, Eye, Edit3, Award, Ship, FileText,
  User, GraduationCap, Globe, ChevronDown, ChevronUp,
  Printer, Anchor, Loader2, ArrowLeft, BookOpen, Wrench,
  CheckSquare, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─────────── TYPES ───────────
interface SeaEntry {
  id: string; vesselName: string; imoNumber: string; vesselType: string;
  flagState: string; grtDwt: string; company: string; manningAgent: string;
  rankOnBoard: string; engineType: string; cargoType: string;
  fromDate: string; toDate: string; reasonForLeaving: string;
  cargoTypes: string[]; otherCargo: string;
  pscDetentions: string; pscInspections: string; vettingInspections: string;
  rightshipInspection: boolean; rightshipGHG: string; rightshipDeficiencies: string;
  drydockExperience: boolean; tankWashing: boolean; holdCleaning: boolean;
  wallWash: boolean; cargoHeating: boolean; inertGas: boolean;
}
interface Cert {
  id: string; name: string; number: string; flagState: string;
  issueDate: string; expiryDate: string; issuingAuthority: string;
  category: "coc" | "stcw" | "medical" | "other"; isCustom?: boolean;
}
interface EduEntry {
  id: string; institution: string; qualification: string; yearFrom: string; yearTo: string;
}
interface TrainingEntry {
  id: string; courseName: string; institution: string; dateCompleted: string; certNo: string;
}
interface Language { language: string; level: string; }

// ─────────── CONSTANTS ───────────
const RANKS = [
  "Captain / Master","Chief Officer","2nd Officer","3rd Officer",
  "Chief Engineer","2nd Engineer","3rd Engineer","4th Engineer","ETO / EEO",
  "Bosun","AB Seaman","Ordinary Seaman (OS)","Fitter","Oiler","Wiper",
  "Cook","Messman / Steward","Deck Cadet","Engine Cadet","Pumpman",
  "Electrician","Refrigeration Engineer","Radio Officer",
];

const VESSEL_TYPES = [
  "Bulk Carrier","Container Ship","Oil Tanker","Chemical Tanker",
  "LNG Carrier","LPG Carrier","RORO","General Cargo","Offshore Supply Vessel",
  "Platform Supply Vessel","Anchor Handling Vessel","Passenger / Cruise Ship",
  "Dredger","Tug / Towage","Car Carrier","Reefer","Other",
];

const ENGINE_TYPES = [
  "MAN B&W","Wärtsilä","Sulzer","MAK","Caterpillar",
  "2-Stroke Diesel","4-Stroke Diesel","Diesel Electric",
  "Steam Turbine","Gas Turbine","Dual Fuel LNG","Other",
];

const CARGO_TYPES = [
  "Dry Bulk","Crude Oil","Chemical","Container","LNG","LPG",
  "General Cargo","RoRo","Passengers","Other",
];

const STCW_CERTS = [
  "Basic Safety Training (BST)","Proficiency in Survival Craft (PSC)",
  "Advanced Fire Fighting (AFF)","Proficiency in Fire Prevention (FPFF)",
  "Elementary First Aid (EFA)","Medical First Aid","Medical Care",
  "GMDSS — General Operator (GOC)","GMDSS — Restricted Operator (ROC)",
  "Security Awareness (SAQ)","Ship Security Officer (SSO)",
  "BOSIET","HUET","H2S Awareness","Tanker Familiarisation",
  "Oil Tanker Endorsement","Chemical Tanker Endorsement","LNG/LPG Tanker Endorsement",
  "ECDIS Generic","ECDIS Type-Specific","BRM / BTM","ERM / ETM",
];

const ECDIS_SYSTEMS = [
  "JRC","Furuno","Transas / Navtor","Kongsberg","Raytheon Anschütz",
  "Wärtsilä NAVI-SAILOR","Consilium","Nobeltec","Kelvin Hughes","Yokogawa",
];

const LEVELS = ["Native","Fluent","Advanced","Intermediate","Basic"];

// ─────────── HELPERS ───────────
const certStatus = (expiry: string) => {
  if (!expiry) return "none";
  const d = new Date(expiry), t = new Date();
  const days = (d.getTime() - t.getTime()) / 86400000;
  if (days < 0) return "expired";
  if (days < 90) return "expiring";
  return "valid";
};

const fmtDate = (d: string) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtMonth = (m: string) => {
  if (!m) return "";
  if (m.includes("-") && m.length === 7) {
    const [y, mo] = m.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(mo) - 1]} ${y}`;
  }
  return fmtDate(m);
};

const calcTotalSeaService = (entries: SeaEntry[]) => {
  let totalMonths = 0;
  entries.forEach(e => {
    if (e.fromDate && e.toDate) {
      const from = new Date(e.fromDate);
      const to = new Date(e.toDate);
      const diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      if (diff > 0) totalMonths += diff;
    }
  });
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return years > 0 ? `${years} year${years > 1 ? "s" : ""} ${months} month${months !== 1 ? "s" : ""}` : `${months} month${months !== 1 ? "s" : ""}`;
};

const isEngineerRank = (rank: string) => {
  const lower = rank.toLowerCase();
  return lower.includes("engineer") || lower.includes("eto") || lower.includes("eeo") || lower.includes("fitter") || lower.includes("oiler") || lower.includes("wiper") || lower.includes("electrician") || lower.includes("refrigeration");
};

const uid = () => String(Date.now()) + String(Math.random()).slice(2, 6);

// ─────────── COMPONENT ───────────
const ResumeBuilder = () => {
  const { accessToken, user } = useAuth();
  const [view, setView] = useState<"form" | "preview">("form");
  const [openSection, setOpenSection] = useState<string | null>("personal");
  const [photo, setPhoto] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  // ── Scan confirmation state ──
  const [scanResult, setScanResult] = useState<any>(null);
  const [showScanConfirm, setShowScanConfirm] = useState(false);
  const [importSections, setImportSections] = useState({
    personal: true, sea: true, certs: true, edu: true, skills: true,
  });

  // ── Validation state ──
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showMissingModal, setShowMissingModal] = useState(false);

  // ── Form state (keep existing names) ──
  const [personal, setPersonal] = useState({
    firstName: "", lastName: "", rank: "", applyingFor: "", nationality: "",
    dob: "", phone: "", email: "", address: "",
    passportNo: "", cdcNo: "", cdcCountry: "", summary: "",
    emergencyName: "", emergencyPhone: "",
    expectedSalaryMin: "", expectedSalaryMax: "", availableFrom: "",
  });

  const [sea, setSea] = useState<SeaEntry[]>([{
    id: "1", vesselName: "", imoNumber: "", vesselType: "", flagState: "",
    grtDwt: "", company: "", manningAgent: "", rankOnBoard: "", engineType: "",
    cargoType: "", fromDate: "", toDate: "", reasonForLeaving: "",
    cargoTypes: [], otherCargo: "", pscDetentions: "", pscInspections: "",
    vettingInspections: "", rightshipInspection: false, rightshipGHG: "", rightshipDeficiencies: "",
    drydockExperience: false, tankWashing: false,
    holdCleaning: false, wallWash: false, cargoHeating: false, inertGas: false,
  }]);

  const [certs, setCerts] = useState<Cert[]>(
    STCW_CERTS.slice(0, 6).map((name, i) => ({
      id: String(i), name, number: "", flagState: "", issueDate: "",
      expiryDate: "", issuingAuthority: "", category: "stcw" as const, isCustom: false,
    }))
  );

  const [edu, setEdu] = useState<EduEntry[]>([
    { id: "1", institution: "", qualification: "", yearFrom: "", yearTo: "" },
  ]);

  const [training, setTraining] = useState<TrainingEntry[]>([]);

  const [skills, setSkills] = useState({
    ecdis: [] as string[],
    languages: [{ language: "English", level: "Fluent" }] as Language[],
    engineTypes: "",
    cargoTypes: "",
    computerSkills: "",
    other: "",
  });

  // ── Handlers ──
  const P = (f: string, v: string) => setPersonal(p => ({ ...p, [f]: v }));
  const addVessel = () => setSea(s => [...s, {
    id: uid(), vesselName: "", imoNumber: "", vesselType: "", flagState: "",
    grtDwt: "", company: "", manningAgent: "", rankOnBoard: "", engineType: "",
    cargoType: "", fromDate: "", toDate: "", reasonForLeaving: "",
    cargoTypes: [], otherCargo: "", pscDetentions: "", pscInspections: "",
    vettingInspections: "", rightshipInspection: false, rightshipGHG: "", rightshipDeficiencies: "",
    drydockExperience: false, tankWashing: false,
    holdCleaning: false, wallWash: false, cargoHeating: false, inertGas: false,
  }]);
  const rmVessel = (id: string) => setSea(s => s.filter(e => e.id !== id));
  const U = (id: string, f: string, v: any) =>
    setSea(s => s.map(e => e.id === id ? { ...e, [f]: v } : e));
  const updateSea = U;
  const UC = (id: string, f: string, v: string) =>
    setCerts(c => c.map(cert => cert.id === id ? { ...cert, [f]: v } : cert));
  const addCert = (cat: "coc" | "stcw" | "medical" | "other") => setCerts(c => [...c, {
    id: uid(), name: "", number: "", flagState: "", issueDate: "",
    expiryDate: "", issuingAuthority: "", category: cat, isCustom: true,
  }]);
  const rmCert = (id: string) => setCerts(c => c.filter(cert => cert.id !== id));
  const addEdu = () => setEdu(e => [...e, { id: uid(), institution: "", qualification: "", yearFrom: "", yearTo: "" }]);
  const rmEdu = (id: string) => setEdu(e => e.filter(x => x.id !== id));
  const UE = (id: string, f: string, v: string) =>
    setEdu(e => e.map(x => x.id === id ? { ...x, [f]: v } : x));
  const addTraining = () => setTraining(t => [...t, { id: uid(), courseName: "", institution: "", dateCompleted: "", certNo: "" }]);
  const rmTraining = (id: string) => setTraining(t => t.filter(x => x.id !== id));
  const UT = (id: string, f: string, v: string) =>
    setTraining(t => t.map(x => x.id === id ? { ...x, [f]: v } : x));
  const toggleEcdis = (sys: string) =>
    setSkills(s => ({ ...s, ecdis: s.ecdis.includes(sys) ? s.ecdis.filter(e => e !== sys) : [...s.ecdis, sys] }));
  const addLang = () => setSkills(s => ({ ...s, languages: [...s.languages, { language: "", level: "Intermediate" }] }));
  const UL = (i: number, f: keyof Language, v: string) =>
    setSkills(s => ({ ...s, languages: s.languages.map((l, idx) => idx === i ? { ...l, [f]: v } : l) }));
  const rmLang = (i: number) => setSkills(s => ({ ...s, languages: s.languages.filter((_, idx) => idx !== i) }));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setPhoto(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ── AI Scan (now with confirmation) ──
  const handleScanCV = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanMessage("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("parse-cv-documents", {
        body: { file_base64: base64, mime_type: file.type },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !data?.success) throw new Error(error?.message || "Scan failed");
      setScanResult(data.data);
      setImportSections({ personal: true, sea: true, certs: true, edu: true, skills: true });
      setShowScanConfirm(true);
    } catch (err: any) {
      setScanMessage("❌ Could not read CV: " + (err.message || "Unknown error"));
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  };

  const applyImport = () => {
    if (!scanResult) return;
    const cv = scanResult;
    if (importSections.personal) {
      setPersonal((p: any) => ({
        ...p,
        firstName: cv.name?.split(' ')[0] || p.firstName,
        lastName: cv.name?.split(' ').slice(1).join(' ') || p.lastName,
        rank: cv.rank || p.rank,
        nationality: cv.nationality || p.nationality,
        dob: cv.date_of_birth || p.dob,
        passportNo: cv.passport_no || cv.passportNo || p.passportNo,
        cdcNo: cv.cdc_no || cv.cdcNo || cv.seaman_book || p.cdcNo,
        cdcCountry: cv.cdc_country || cv.cdcCountry || p.cdcCountry,
        phone: cv.phone || cv.whatsapp || p.phone,
        email: cv.email || p.email,
        summary: cv.summary || p.summary,
      }));
    }
    if (importSections.sea && cv.sea_service?.length > 0) {
      setSea(cv.sea_service.map((s: any, i: number) => ({
        id: String(Date.now() + i),
        vesselName: s.vessel_name || s.vesselName || '',
        vesselType: s.vessel_type || s.vesselType || '',
        flagState: s.flag || '',
        grtDwt: s.grt || s.dwt || '',
        imoNumber: s.imo || '',
        company: s.company || '',
        manningAgent: s.manning_agent || '',
        rankOnBoard: s.rank || '',
        fromDate: s.sign_on || s.signOn || s.from_date || '',
        toDate: s.sign_off || s.signOff || s.to_date || '',
        engineType: s.engine_type || s.engineType || '',
        cargoType: s.cargo_type || s.cargoType || '',
        reasonForLeaving: '',
      })));
    }
    if (importSections.certs && cv.certificates?.length > 0) {
      setCerts(cv.certificates.map((c: any, i: number) => ({
        id: String(Date.now() + i),
        name: c.name || c.cert_name || '',
        number: c.number || c.cert_no || c.certNo || '',
        flagState: '',
        issueDate: c.issue_date || c.issueDate || '',
        expiryDate: c.expiry_date || c.expiryDate || '',
        issuingAuthority: c.issuing_authority || c.issued_by || c.authority || '',
        category: "stcw" as const,
        isCustom: true,
      })));
    }
    if (importSections.edu && cv.education?.length > 0) {
      setEdu(cv.education.map((e: any, i: number) => ({
        id: String(Date.now() + i),
        institution: typeof e === 'string' ? e : e.institution || '',
        qualification: typeof e === 'string' ? '' : e.qualification || '',
        yearFrom: typeof e === 'string' ? '' : e.year || '',
        yearTo: '',
      })));
    }
    if (importSections.skills) {
      if (cv.main_engine_types?.length > 0 || cv.cargo_experience?.length > 0) {
        setSkills(s => ({
          ...s,
          engineTypes: cv.main_engine_types?.join(", ") || s.engineTypes,
          cargoTypes: cv.cargo_experience?.join(", ") || s.cargoTypes,
        }));
      }
    }
    const totalRecs = (cv.sea_service?.length || 0) + (cv.certificates?.length || 0);
    setScanMessage(`✅ Imported ${totalRecs} records. Review and fill any missing details.`);
    setShowScanConfirm(false);
    setScanResult(null);
    setOpenSection("personal");
  };

  // ── Completion check ──
  const getCompletionStatus = () => {
    const missing: string[] = [];
    if (!photo) missing.push('Photo');
    if (!personal.firstName) missing.push('First Name');
    if (!personal.lastName) missing.push('Last Name');
    if (!personal.rank) missing.push('Current Rank');
    if (!personal.nationality) missing.push('Nationality');
    if (!personal.dob) missing.push('Date of Birth');
    if (!personal.passportNo) missing.push('Passport Number');
    if (!personal.phone) missing.push('Phone/WhatsApp');
    if (sea.length === 0 || !sea.some(s => s.vesselName)) missing.push('At least 1 Sea Service entry');
    if (certs.length === 0 || !certs.some(c => c.name)) missing.push('At least 1 Certificate');
    return missing;
  };

  const handlePreviewClick = () => {
    const missing = getCompletionStatus();
    if (missing.length > 0) {
      setMissingFields(missing);
      setShowMissingModal(true);
      return;
    }
    setView('preview');
  };

  // ── Download PDF ──
  const handleDownloadPDF = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const el = document.getElementById('cv-preview');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft > 0) {
        position -= pdf.internal.pageSize.getHeight();
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`SeaMinds-CV-${personal.firstName || 'Seafarer'}-${personal.lastName || ''}.pdf`);
    } catch (e) { console.error(e); }
  };

  // ── Auto-save state ──
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ── Auto-save CV data to Supabase ──
  const saveCVData = async (data: any) => {
    try {
      if (!user) return;
      setSaveStatus('saving');
      await supabase.from('crew_cv_data').upsert({
        user_id: user.id,
        certificates: JSON.stringify(data.certs) as any,
        sea_service: JSON.stringify(data.sea) as any,
        education: JSON.stringify(data.edu) as any,
        medical: JSON.stringify({ personal: data.personal, skills: data.skills, photo: data.photo, training: data.training }) as any,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) { console.error('CV save error:', e); setSaveStatus('idle'); }
  };

  // Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      saveCVData({ personal, sea, certs, edu, skills, photo, training });
    }, 2000);
    return () => clearTimeout(timer);
  }, [personal, sea, certs, edu, skills, photo, training]);

  // Load saved CV data on mount
  useEffect(() => {
    const loadCV = async () => {
      if (!user) return;
      const { data } = await supabase.from('crew_cv_data')
        .select('certificates, sea_service, education, medical')
        .eq('user_id', user.id).maybeSingle();
      if (!data) return;
      try {
        const meta = typeof data.medical === 'string' ? JSON.parse(data.medical) : data.medical;
        if (meta?.personal) setPersonal(meta.personal);
        if (meta?.skills) setSkills(meta.skills);
        if (meta?.photo) setPhoto(meta.photo);
        if (meta?.training) setTraining(meta.training);
        const seaData = typeof data.sea_service === 'string' ? JSON.parse(data.sea_service) : data.sea_service;
        if (Array.isArray(seaData) && seaData.length > 0) setSea(seaData);
        const certsData = typeof data.certificates === 'string' ? JSON.parse(data.certificates) : data.certificates;
        if (Array.isArray(certsData) && certsData.length > 0) setCerts(certsData);
        const eduData = typeof data.education === 'string' ? JSON.parse(data.education) : data.education;
        if (Array.isArray(eduData) && eduData.length > 0) setEdu(eduData);
      } catch (e) { console.error('CV load error:', e); }
    };
    loadCV();
  }, []);

  // ── Styles ──
  const inp = "w-full bg-[#0a1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none placeholder:text-gray-600";
  const sel = "w-full bg-[#0a1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none";
  const lbl = "text-gray-400 text-xs mb-1 block";

  const Section = ({ id, icon, title, badge }: { id: string; icon: React.ReactNode; title: string; badge?: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpenSection(openSection === id ? null : id); }}
      className="w-full flex items-center justify-between p-3.5 bg-[#132236] rounded-xl mb-1 text-left hover:bg-[#1a2d47] transition-colors"
    >
      <div className="flex items-center gap-2 text-white text-sm font-semibold">
        {icon}{title}
        {badge && <span className="bg-[#D4AF37] text-[#0D1B2A] text-xs px-2 py-0.5 rounded-full font-bold">{badge}</span>}
      </div>
      {openSection === id ? <ChevronUp size={16} className="text-[#D4AF37]" /> : <ChevronDown size={16} className="text-gray-500" />}
    </button>
  );

  // ── Filtered for preview ──
  const filledSea = [...sea.filter(s => s.vesselName)].sort((a, b) => {
    if (!a.toDate && !b.toDate) return 0;
    if (!a.toDate) return -1;
    if (!b.toDate) return 1;
    return b.toDate.localeCompare(a.toDate);
  });
  const filledCerts = certs.filter(c => c.name && c.number);
  const cocCerts = filledCerts.filter(c => c.category === "coc");
  const stcwCerts = filledCerts.filter(c => c.category === "stcw");
  const medCerts = filledCerts.filter(c => c.category === "medical");
  const otherCerts = filledCerts.filter(c => c.category === "other");
  const filledEdu = edu.filter(e => e.institution);
  const filledTraining = training.filter(t => t.courseName);
  const fullName = `${personal.firstName} ${personal.lastName}`.trim() || "Your Name";
  const isEngineer = isEngineerRank(personal.rank);

  const CertStatusBadge = ({ expiry }: { expiry: string }) => {
    const st = certStatus(expiry);
    if (st === "valid") return <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 11 }}>✓ Valid</span>;
    if (st === "expiring") return <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 11 }}>⚠ Expiring</span>;
    if (st === "expired") return <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 11 }}>✗ Expired</span>;
    return null;
  };

  // ═══════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-[#0D1B2A] print:bg-white">

      {/* ── SCAN CONFIRMATION MODAL ── */}
      {showScanConfirm && scanResult && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowScanConfirm(false)}>
          <div className="bg-[#0D1B2A] border-2 border-[#D4AF37] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0D1B2A] border-b border-[#1e3a5f] p-4 flex items-center justify-between z-10">
              <h2 className="text-white font-bold text-base">✅ AI extracted the following — Please confirm</h2>
              <button onClick={() => setShowScanConfirm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">

              {/* Personal */}
              {(scanResult.name || scanResult.rank || scanResult.nationality) && (
                <div className="border border-[#1e3a5f] rounded-xl p-3">
                  <label className="flex items-center gap-2 text-white text-sm font-semibold mb-2 cursor-pointer">
                    <input type="checkbox" checked={importSections.personal}
                      onChange={e => setImportSections(s => ({ ...s, personal: e.target.checked }))}
                      className="accent-[#D4AF37]" />
                    <User size={14} /> Personal Details
                  </label>
                  <div className="text-gray-300 text-xs space-y-1 pl-6">
                    {scanResult.name && <p>Name: <span className="text-white">{scanResult.name}</span></p>}
                    {scanResult.rank && <p>Rank: <span className="text-[#D4AF37]">{scanResult.rank}</span></p>}
                    {scanResult.nationality && <p>Nationality: <span className="text-white">{scanResult.nationality}</span></p>}
                    {scanResult.date_of_birth && <p>DOB: <span className="text-white">{scanResult.date_of_birth}</span></p>}
                  </div>
                </div>
              )}

              {/* Sea Service */}
              {scanResult.sea_service?.length > 0 && (
                <div className="border border-[#1e3a5f] rounded-xl p-3">
                  <label className="flex items-center gap-2 text-white text-sm font-semibold mb-2 cursor-pointer">
                    <input type="checkbox" checked={importSections.sea}
                      onChange={e => setImportSections(s => ({ ...s, sea: e.target.checked }))}
                      className="accent-[#D4AF37]" />
                    <Ship size={14} /> Sea Service ({scanResult.sea_service.length} records found)
                  </label>
                  <div className="space-y-1 pl-6">
                    {scanResult.sea_service.slice(0, 5).map((s: any, i: number) => (
                      <div key={i} className="text-xs text-gray-300">
                        <span className="text-white font-medium">{s.vessel_name}</span>
                        {s.vessel_type && <span className="text-gray-400"> — {s.vessel_type}</span>}
                        {s.rank && <span className="text-[#D4AF37]"> ({s.rank})</span>}
                        {s.sign_on && s.sign_off && <span className="text-gray-500"> {s.sign_on} to {s.sign_off}</span>}
                      </div>
                    ))}
                    {scanResult.sea_service.length > 5 && (
                      <p className="text-gray-500 text-xs">+{scanResult.sea_service.length - 5} more...</p>
                    )}
                  </div>
                </div>
              )}

              {/* Certificates */}
              {scanResult.certificates?.length > 0 && (
                <div className="border border-[#1e3a5f] rounded-xl p-3">
                  <label className="flex items-center gap-2 text-white text-sm font-semibold mb-2 cursor-pointer">
                    <input type="checkbox" checked={importSections.certs}
                      onChange={e => setImportSections(s => ({ ...s, certs: e.target.checked }))}
                      className="accent-[#D4AF37]" />
                    <Award size={14} /> Certificates ({scanResult.certificates.length} found)
                  </label>
                  <div className="space-y-1 pl-6">
                    {scanResult.certificates.slice(0, 6).map((c: any, i: number) => (
                      <p key={i} className="text-xs text-gray-300">{c.name}{c.number && ` — No. ${c.number}`}</p>
                    ))}
                    {scanResult.certificates.length > 6 && (
                      <p className="text-gray-500 text-xs">+{scanResult.certificates.length - 6} more...</p>
                    )}
                  </div>
                </div>
              )}

              {/* Education */}
              {scanResult.education?.length > 0 && (
                <div className="border border-[#1e3a5f] rounded-xl p-3">
                  <label className="flex items-center gap-2 text-white text-sm font-semibold mb-2 cursor-pointer">
                    <input type="checkbox" checked={importSections.edu}
                      onChange={e => setImportSections(s => ({ ...s, edu: e.target.checked }))}
                      className="accent-[#D4AF37]" />
                    <GraduationCap size={14} /> Education ({scanResult.education.length} entries)
                  </label>
                  <div className="space-y-1 pl-6">
                    {scanResult.education.map((e: any, i: number) => (
                      <p key={i} className="text-xs text-gray-300">
                        {typeof e === "string" ? e : `${e.institution}${e.qualification ? ` — ${e.qualification}` : ""}`}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {(scanResult.main_engine_types?.length > 0 || scanResult.cargo_experience?.length > 0) && (
                <div className="border border-[#1e3a5f] rounded-xl p-3">
                  <label className="flex items-center gap-2 text-white text-sm font-semibold mb-2 cursor-pointer">
                    <input type="checkbox" checked={importSections.skills}
                      onChange={e => setImportSections(s => ({ ...s, skills: e.target.checked }))}
                      className="accent-[#D4AF37]" />
                    <Wrench size={14} /> Skills & Experience
                  </label>
                  <div className="pl-6 text-xs space-y-1">
                    {scanResult.main_engine_types?.length > 0 && (
                      <p className="text-[#D4AF37]">Engine: {scanResult.main_engine_types.join(", ")}</p>
                    )}
                    {scanResult.cargo_experience?.length > 0 && (
                      <p className="text-[#D4AF37]">Cargo: {scanResult.cargo_experience.join(", ")}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              {scanResult.summary && (
                <div className="border border-[#1e3a5f] rounded-xl p-3">
                  <p className="text-gray-400 text-xs italic">"{scanResult.summary}"</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-[#0D1B2A] border-t border-[#1e3a5f] p-4 flex gap-3">
              <button onClick={applyImport}
                className="flex-1 bg-[#D4AF37] text-[#0D1B2A] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors">
                <CheckSquare size={16} /> ✓ Import All & Review
              </button>
              <button onClick={() => { setShowScanConfirm(false); setScanResult(null); }}
                className="px-6 py-3 bg-[#132236] text-gray-400 rounded-xl text-sm font-medium hover:text-white transition-colors">
                ✗ Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MISSING FIELDS MODAL ── */}
      {showMissingModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#0D1B2A', border:'2px solid #e74c3c', borderRadius:'12px', padding:'24px', maxWidth:'400px', width:'90%' }}>
            <div style={{ color:'#e74c3c', fontSize:'18px', fontWeight:'bold', marginBottom:'12px' }}>⚠️ CV Incomplete</div>
            <div style={{ color:'#ccc', fontSize:'13px', marginBottom:'12px' }}>Please complete the following before generating your CV:</div>
            <ul style={{ color:'white', fontSize:'13px', paddingLeft:'20px', marginBottom:'16px' }}>
              {missingFields.map((f, i) => <li key={i} style={{ marginBottom:'4px', color:'#D4AF37' }}>• {f}</li>)}
            </ul>
            <button onClick={() => { setShowMissingModal(false); setView('form'); }}
              style={{ background:'#D4AF37', color:'#0D1B2A', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', width:'100%' }}>
              ← Go Back & Complete
            </button>
          </div>
        </div>
      )}

      {/* ─── TOP BAR (hidden in print) ─── */}
      <div className="print:hidden">
        <div className="flex gap-2 p-3 pb-1">
          <button onClick={() => setView("form")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${view === "form" ? "bg-[#D4AF37] text-[#0D1B2A]" : "bg-[#132236] text-gray-400 hover:text-white"}`}>
            <Edit3 size={16} /> Build CV
          </button>
          {saveStatus !== 'idle' && (
            <div className="flex items-center text-xs font-medium px-2" style={{ color: '#D4AF37' }}>
              {saveStatus === 'saving' ? '💾 Saving...' : '✓ Saved'}
            </div>
          )}
          <button onClick={handlePreviewClick}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${view === "preview" ? "bg-[#D4AF37] text-[#0D1B2A]" : "bg-[#132236] text-gray-400 hover:text-white"}`}>
            <Eye size={16} /> Preview & Print
          </button>
        </div>
      </div>

      {/* ══════════ FORM VIEW ══════════ */}
      {view === "form" && (
        <div className="flex-1 overflow-y-auto px-3 pt-2 space-y-1 print:hidden">

          {/* ── AI SCAN CV ── */}
          <div className="rounded-xl p-4 mb-2 border border-[#D4AF37] bg-[#0D1B2A]">
            <input ref={scanInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleScanCV} />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚡</span>
              <span className="text-[#D4AF37] font-bold text-sm">AI Auto-Fill</span>
            </div>
            <p className="text-gray-400 text-xs mb-3">Upload your existing CV — AI extracts and fills all fields automatically</p>
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); scanInputRef.current?.click(); }}
              disabled={scanning}
              className="bg-[#D4AF37] text-[#0D1B2A] border-none px-6 py-2.5 rounded-lg font-bold text-sm cursor-pointer hover:bg-yellow-400 transition-colors disabled:opacity-60">
              {scanning ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Scanning CV...</span> : "📄 Scan My CV"}
            </button>
            {scanMessage && <p className="text-xs mt-3" style={{ color: scanMessage.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{scanMessage}</p>}
          </div>

          {/* ── CV COMPLETION PROGRESS ── */}
          {(() => {
            const missing = getCompletionStatus();
            const total = 10;
            const pct = Math.round(((total - missing.length) / total) * 100);
            return (
              <div className="mb-2 bg-[#132236] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-gray-400 text-xs font-medium">CV Completion</span>
                  <span className="text-[#D4AF37] text-xs font-bold">{pct}%</span>
                </div>
                <div className="w-full h-2.5 bg-[#0a1929] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#D4AF37' }} />
                </div>
                {pct < 100 && <p className="text-gray-500 text-[10px] mt-1">Missing: {missing.join(', ')}</p>}
              </div>
            );
          })()}

          {/* ── PERSONAL DETAILS ── */}
          <Section id="personal" icon={<User size={16} />} title="Personal Details" />
          {openSection === "personal" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-3 mb-1">
              <p className="text-gray-500 text-[10px] mb-1">Fields marked <span className="text-red-500">*</span> are required to generate your CV</p>
              <div className="flex items-center gap-3 mb-2">
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                <button onClick={() => photoRef.current?.click()} title="Upload photo" className="flex-shrink-0">
                  {photo
                    ? <img src={photo} alt="Photo" className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37]" />
                    : <div className="w-16 h-16 rounded-full bg-[#132236] border-2 border-dashed border-[#1e3a5f] flex flex-col items-center justify-center text-gray-500">
                        <Camera size={18} /><span className="text-[8px] mt-0.5">Photo</span>
                      </div>}
                </button>
                <p className="text-gray-500 text-xs">Passport-style photo recommended</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>First Name *</label><input className={inp} placeholder="Juan" value={personal.firstName} onChange={e => P("firstName", e.target.value)} /></div>
                <div><label className={lbl}>Last Name *</label><input className={inp} placeholder="Dela Cruz" value={personal.lastName} onChange={e => P("lastName", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Current Rank *</label>
                  <select className={sel} value={personal.rank} onChange={e => P("rank", e.target.value)}>
                    <option value="">Select rank...</option>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Applying For</label>
                  <select className={sel} value={personal.applyingFor} onChange={e => P("applyingFor", e.target.value)}>
                    <option value="">Position desired...</option>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Nationality <span className="text-red-500">*</span></label><input className={inp} placeholder="Filipino" value={personal.nationality} onChange={e => P("nationality", e.target.value)} /></div>
                <div><label className={lbl}>Date of Birth <span className="text-red-500">*</span></label><input type="date" className={inp} value={personal.dob} onChange={e => P("dob", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Passport Number <span className="text-red-500">*</span></label><input className={inp} placeholder="P1234567A" value={personal.passportNo} onChange={e => P("passportNo", e.target.value)} /></div>
                <div><label className={lbl}>CDC / Seaman Book No.</label><input className={inp} placeholder="CDC-123456" value={personal.cdcNo} onChange={e => P("cdcNo", e.target.value)} /></div>
              </div>
              <div><label className={lbl}>CDC Issue Country</label><input className={inp} placeholder="Philippines" value={personal.cdcCountry} onChange={e => P("cdcCountry", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>WhatsApp / Phone <span className="text-red-500">*</span></label><input className={inp} placeholder="+63..." value={personal.phone} onChange={e => P("phone", e.target.value)} /></div>
                <div><label className={lbl}>Email</label><input className={inp} placeholder="name@email.com" value={personal.email} onChange={e => P("email", e.target.value)} /></div>
              </div>
              <div><label className={lbl}>Home Address</label><input className={inp} placeholder="Manila, Philippines" value={personal.address} onChange={e => P("address", e.target.value)} /></div>

              {/* Expected Salary Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Expected Salary Min (USD/month)</label>
                  <input className={inp} value={personal.expectedSalaryMin} onChange={e => P("expectedSalaryMin", e.target.value)} placeholder="e.g. 3000" type="number" />
                </div>
                <div>
                  <label className={lbl}>Expected Salary Max (USD/month)</label>
                  <input className={inp} value={personal.expectedSalaryMax} onChange={e => P("expectedSalaryMax", e.target.value)} placeholder="e.g. 4000" type="number" />
                </div>
              </div>
              <div>
                <label className={lbl}>Available / Expected Joining Date <span className="text-red-500">*</span></label>
                <input className={inp} value={personal.availableFrom} onChange={e => P("availableFrom", e.target.value)} type="date" />
              </div>

              {/* Languages inline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#D4AF37] text-xs font-semibold">Languages</label>
                  <button onClick={addLang} className="text-[#D4AF37] text-xs flex items-center gap-1 hover:opacity-80"><Plus size={12} />Add</button>
                </div>
                {skills.languages.map((l, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-center">
                    <div className="col-span-2"><input className={inp} placeholder="Language" value={l.language} onChange={e => UL(i, "language", e.target.value)} /></div>
                    <div className="col-span-2">
                      <select className={sel} value={l.level} onChange={e => UL(i, "level", e.target.value)}>
                        {LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
                      </select>
                    </div>
                    {skills.languages.length > 1 && <button onClick={() => rmLang(i)} className="text-red-400 flex justify-center"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>

              {/* Emergency Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Emergency Contact Name</label><input className={inp} placeholder="Maria Dela Cruz" value={personal.emergencyName} onChange={e => P("emergencyName", e.target.value)} /></div>
                <div><label className={lbl}>Emergency Phone</label><input className={inp} placeholder="+63..." value={personal.emergencyPhone} onChange={e => P("emergencyPhone", e.target.value)} /></div>
              </div>

              <div>
                <label className={lbl}>Professional Summary</label>
                <textarea className={inp + " h-20 resize-none"} placeholder="Experienced 2nd Engineer with 8+ years on bulk carriers..." value={personal.summary} onChange={e => P("summary", e.target.value)} />
               </div>
              <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpenSection('sea'); }}
                style={{ background:'transparent', border:'1px solid #D4AF37', color:'#D4AF37', padding:'6px 16px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', marginTop:'12px' }}>
                Next Section →
              </button>
            </div>
          )}

          {/* ── SEA SERVICE ── */}
          <Section id="sea" icon={<Ship size={16} />} title="Sea Service Record" badge={`${sea.filter(s => s.vesselName).length}`} />
          {openSection === "sea" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-4 mb-1">
              {sea.map((e, idx) => (
                <div key={e.id} className="border border-[#1e3a5f] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#D4AF37] text-xs font-bold">🚢 VESSEL {idx + 1}</span>
                    {sea.length > 1 && <button onClick={() => rmVessel(e.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Vessel Name *</label><input className={inp} placeholder="MV Pacific Star" value={e.vesselName} onChange={ev => U(e.id, "vesselName", ev.target.value)} /></div>
                    <div><label className={lbl}>IMO Number</label><input className={inp} placeholder="9123456" value={e.imoNumber} onChange={ev => U(e.id, "imoNumber", ev.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Vessel Type</label>
                      <select className={sel} value={e.vesselType} onChange={ev => U(e.id, "vesselType", ev.target.value)}>
                        <option value="">Select...</option>{VESSEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div><label className={lbl}>Flag State</label><input className={inp} placeholder="Panama" value={e.flagState} onChange={ev => U(e.id, "flagState", ev.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>GRT / DWT</label><input className={inp} placeholder="180,000 DWT" value={e.grtDwt} onChange={ev => U(e.id, "grtDwt", ev.target.value)} /></div>
                    <div><label className={lbl}>Rank on Board</label>
                      <select className={sel} value={e.rankOnBoard} onChange={ev => U(e.id, "rankOnBoard", ev.target.value)}>
                        <option value="">Rank...</option>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Shipping Company</label><input className={inp} placeholder="Anglo-Eastern" value={e.company} onChange={ev => U(e.id, "company", ev.target.value)} /></div>
                    <div><label className={lbl}>Manning Agent</label><input className={inp} placeholder="Pacific Ocean Manning" value={e.manningAgent} onChange={ev => U(e.id, "manningAgent", ev.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Main Engine Type</label>
                      <select className={sel} value={e.engineType} onChange={ev => U(e.id, "engineType", ev.target.value)}>
                        <option value="">Engine...</option>{ENGINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div><label className={lbl}>Cargo Type (primary)</label>
                      <select className={sel} value={e.cargoType} onChange={ev => U(e.id, "cargoType", ev.target.value)}>
                        <option value="">Cargo...</option>{CARGO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Sign On</label><input type="date" className={inp} value={e.fromDate} onChange={ev => U(e.id, "fromDate", ev.target.value)} /></div>
                    <div><label className={lbl}>Sign Off</label><input type="date" className={inp} value={e.toDate} onChange={ev => U(e.id, "toDate", ev.target.value)} /></div>
                  </div>
                  <div><label className={lbl}>Reason for Leaving</label><input className={inp} placeholder="End of contract" value={e.reasonForLeaving} onChange={ev => U(e.id, "reasonForLeaving", ev.target.value)} /></div>

                  {/* Cargo Types — multi-select */}
                  <div className="mt-2">
                    <label style={{ color:'#D4AF37', fontSize:'12px', display:'block', marginBottom:'4px' }}>Cargo Types Handled (select all that apply)</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                      {['Dry Bulk','Coal','Grain','Iron Ore','Fertilizer','Crude Oil','Clean Petroleum','Chemical','LNG','LPG','Containers','General Cargo','RoRo','Vehicles','Passengers','Offshore','Cement','Timber'].map(cargo => (
                        <button key={cargo} type="button"
                          onClick={ev => { ev.stopPropagation(); ev.preventDefault();
                            const updated = (e as any).cargoTypes?.includes(cargo)
                              ? (e as any).cargoTypes.filter((c:string) => c !== cargo)
                              : [...((e as any).cargoTypes || []), cargo];
                            updateSea(e.id, 'cargoTypes', updated);
                          }}
                          style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'11px', cursor:'pointer', border:'1px solid',
                            background: (e as any).cargoTypes?.includes(cargo) ? '#D4AF37' : 'transparent',
                            color: (e as any).cargoTypes?.includes(cargo) ? '#0D1B2A' : '#D4AF37',
                            borderColor: '#D4AF37' }}>
                          {cargo}
                        </button>
                      ))}
                    </div>
                    <input value={(e as any).otherCargo || ''} onChange={ev => updateSea(e.id, 'otherCargo', ev.target.value)}
                      placeholder="Other cargo (type here)..."
                      className={inp + " text-xs"} />
                  </div>

                  {/* Special Experience for this vessel */}
                  <div className="mt-2" style={{ background:'#0a1628', borderRadius:'8px', padding:'12px', border:'1px solid #1a2e47' }}>
                    <label style={{ color:'#D4AF37', fontSize:'12px', display:'block', marginBottom:'8px' }}>⭐ Special Experience on this Vessel</label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'6px', marginBottom:'10px' }}>
                      {([
                        ['drydockExperience', '🔧 Dry Dock'],
                        ['tankWashing', '🚿 Tank Washing'],
                        ['holdCleaning', '🧹 Hold Cleaning'],
                        ['wallWash', '🔬 Wall Wash'],
                        ['cargoHeating', '🌡️ Cargo Heating'],
                        ['inertGas', '💨 Inert Gas Ops'],
                        ['rightshipInspection', '⭐ RightShip Inspection'],
                      ] as [string, string][]).map(([field, label]) => (
                        <label key={field} style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'11px', color:'#ccc' }}>
                          <input type="checkbox" checked={!!(e as any)[field]}
                            onChange={ev => { ev.stopPropagation(); updateSea(e.id, field, ev.target.checked); }}
                            style={{ accentColor:'#D4AF37' }} />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      <div>
                        <label style={{ color:'#aaa', fontSize:'11px', display:'block', marginBottom:'3px' }}>PSC Inspections (e.g. USCG x2, AMSA x1)</label>
                        <input value={(e as any).pscInspections || ''} onChange={ev => updateSea(e.id, 'pscInspections', ev.target.value)}
                          placeholder="USCG x2, Paris MOU x1, AMSA x1"
                          className={inp + " text-xs"} />
                      </div>
                      <div>
                        <label style={{ color:'#aaa', fontSize:'11px', display:'block', marginBottom:'3px' }}>PSC Detentions</label>
                        <input value={(e as any).pscDetentions || ''} onChange={ev => updateSea(e.id, 'pscDetentions', ev.target.value)}
                          placeholder="None / 1 detention (detail)"
                          className={inp + " text-xs"} />
                      </div>
                      <div style={{ gridColumn:'span 2' }}>
                        <label style={{ color:'#aaa', fontSize:'11px', display:'block', marginBottom:'3px' }}>Vetting Inspections (SIRE/CDI/OCIMF)</label>
                        <input value={(e as any).vettingInspections || ''} onChange={ev => updateSea(e.id, 'vettingInspections', ev.target.value)}
                          placeholder="SIRE x3, CDI x1, DocksideSurvey x2"
                          className={inp + " text-xs"} />
                      </div>
                    </div>
                    {((e as any).rightshipInspection || ['Bulk Carrier','General Cargo','Cement','Timber','Coal','Grain'].some(t => e.vesselType?.includes(t))) && (
                      <div style={{ marginTop:'8px', padding:'8px', background:'#0D1B2A', borderRadius:'6px', border:'1px solid #1e3a5f' }}>
                        <label style={{ color:'#D4AF37', fontSize:'11px', display:'block', marginBottom:'6px' }}>⭐ RightShip Inspection Details</label>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                          <div>
                            <label style={{ color:'#aaa', fontSize:'10px', display:'block', marginBottom:'3px' }}>GHG Rating Achieved</label>
                            <select value={(e as any).rightshipGHG || ''} onChange={ev => { ev.stopPropagation(); updateSea(e.id, 'rightshipGHG', ev.target.value); }}
                              style={{ width:'100%', background:'#1a2e47', border:'1px solid #2a4060', color:'white', padding:'5px 8px', borderRadius:'5px', fontSize:'11px' }}>
                              <option value=''>Select GHG Rating</option>
                              <option value='A'>A (Best)</option>
                              <option value='B'>B</option>
                              <option value='C'>C</option>
                              <option value='D'>D</option>
                              <option value='E'>E (Worst)</option>
                              <option value='Not Rated'>Not Rated</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ color:'#aaa', fontSize:'10px', display:'block', marginBottom:'3px' }}>Deficiencies / Observations</label>
                            <input value={(e as any).rightshipDeficiencies || ''} onChange={ev => { ev.stopPropagation(); updateSea(e.id, 'rightshipDeficiencies', ev.target.value); }}
                              placeholder="None / 2 obs, 0 deficiencies"
                              style={{ width:'100%', background:'#1a2e47', border:'1px solid #2a4060', color:'white', padding:'5px 8px', borderRadius:'5px', fontSize:'11px' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addVessel} className="w-full border border-dashed border-[#D4AF37] text-[#D4AF37] py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#D4AF37]/10 transition-colors">
                <Plus size={16} /> Add Another Vessel
              </button>
              <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpenSection('certs'); }}
                style={{ background:'transparent', border:'1px solid #D4AF37', color:'#D4AF37', padding:'6px 16px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', marginTop:'12px' }}>
                Next Section →
              </button>
            </div>
          )}

          {/* ── CERTIFICATES ── */}
          <Section id="certs" icon={<Award size={16} />} title="Certificates & Endorsements" badge={`${filledCerts.length}`} />
          {openSection === "certs" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-4 mb-1">
              {/* CoC */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">Certificate of Competency (CoC)</span>
                  <button onClick={() => addCert("coc")} className="text-[#D4AF37] text-xs flex items-center gap-1"><Plus size={12} />Add</button>
                </div>
                {certs.filter(c => c.category === "coc").map(cert => (
                  <CertRow key={cert.id} cert={cert} UC={UC} rmCert={rmCert} inp={inp} sel={sel} lbl={lbl} />
                ))}
                {certs.filter(c => c.category === "coc").length === 0 && (
                  <button onClick={() => addCert("coc")} className="w-full border border-dashed border-[#1e3a5f] text-gray-500 py-2 rounded-lg text-xs">+ Add CoC</button>
                )}
              </div>

              {/* STCW */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">STCW Endorsements</span>
                  <button onClick={() => addCert("stcw")} className="text-[#D4AF37] text-xs flex items-center gap-1"><Plus size={12} />Add</button>
                </div>
                {certs.filter(c => c.category === "stcw").map(cert => (
                  <CertRow key={cert.id} cert={cert} UC={UC} rmCert={rmCert} inp={inp} sel={sel} lbl={lbl} />
                ))}
              </div>

              {/* Medical */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">Medical Certificates</span>
                  <button onClick={() => addCert("medical")} className="text-[#D4AF37] text-xs flex items-center gap-1"><Plus size={12} />Add</button>
                </div>
                {certs.filter(c => c.category === "medical").map(cert => (
                  <CertRow key={cert.id} cert={cert} UC={UC} rmCert={rmCert} inp={inp} sel={sel} lbl={lbl} />
                ))}
                {certs.filter(c => c.category === "medical").length === 0 && (
                  <button onClick={() => addCert("medical")} className="w-full border border-dashed border-[#1e3a5f] text-gray-500 py-2 rounded-lg text-xs">+ Add Medical</button>
                )}
              </div>

              {/* Other */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">Other (Flag State, Yellow Fever, etc.)</span>
                  <button onClick={() => addCert("other")} className="text-[#D4AF37] text-xs flex items-center gap-1"><Plus size={12} />Add</button>
                </div>
                {certs.filter(c => c.category === "other").map(cert => (
                  <CertRow key={cert.id} cert={cert} UC={UC} rmCert={rmCert} inp={inp} sel={sel} lbl={lbl} />
                ))}
                {certs.filter(c => c.category === "other").length === 0 && (
                  <button onClick={() => addCert("other")} className="w-full border border-dashed border-[#1e3a5f] text-gray-500 py-2 rounded-lg text-xs">+ Add Other</button>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpenSection('edu'); }}
                style={{ background:'transparent', border:'1px solid #D4AF37', color:'#D4AF37', padding:'6px 16px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', marginTop:'12px' }}>
                Next Section →
              </button>
            </div>
          )}

          {/* ── EDUCATION ── */}
          <Section id="edu" icon={<GraduationCap size={16} />} title="Education" badge={`${filledEdu.length}`} />
          {openSection === "edu" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-3 mb-1">
              {edu.map((e, idx) => (
                <div key={e.id} className="border border-[#1e3a5f] rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#D4AF37] text-xs font-bold">🎓 Entry {idx + 1}</span>
                    {edu.length > 1 && <button onClick={() => rmEdu(e.id)} className="text-red-400"><Trash2 size={14} /></button>}
                  </div>
                  <div><label className={lbl}>Institution / Academy</label><input className={inp} placeholder="MAAP, PMI, PMMA..." value={e.institution} onChange={ev => UE(e.id, "institution", ev.target.value)} /></div>
                  <div><label className={lbl}>Qualification / Degree</label><input className={inp} placeholder="BSc Marine Transportation" value={e.qualification} onChange={ev => UE(e.id, "qualification", ev.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Year From</label><input className={inp} placeholder="2014" value={e.yearFrom} onChange={ev => UE(e.id, "yearFrom", ev.target.value)} /></div>
                    <div><label className={lbl}>Year To</label><input className={inp} placeholder="2018" value={e.yearTo} onChange={ev => UE(e.id, "yearTo", ev.target.value)} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addEdu} className="w-full border border-dashed border-[#D4AF37] text-[#D4AF37] py-2 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-[#D4AF37]/10">
                <Plus size={16} /> Add Education
              </button>
              <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpenSection('training'); }}
                style={{ background:'transparent', border:'1px solid #D4AF37', color:'#D4AF37', padding:'6px 16px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', marginTop:'12px' }}>
                Next Section →
              </button>
            </div>
          )}

          {/* ── TRAINING COURSES ── */}
          <Section id="training" icon={<BookOpen size={16} />} title="Training Courses" badge={`${filledTraining.length}`} />
          {openSection === "training" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-3 mb-1">
              {training.map((t, idx) => (
                <div key={t.id} className="border border-[#1e3a5f] rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#D4AF37] text-xs font-bold">📚 Course {idx + 1}</span>
                    <button onClick={() => rmTraining(t.id)} className="text-red-400"><Trash2 size={14} /></button>
                  </div>
                  <div><label className={lbl}>Course Name</label><input className={inp} placeholder="Tanker Familiarisation" value={t.courseName} onChange={ev => UT(t.id, "courseName", ev.target.value)} /></div>
                  <div><label className={lbl}>Institution</label><input className={inp} placeholder="STCW Training Center" value={t.institution} onChange={ev => UT(t.id, "institution", ev.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Date Completed</label><input type="date" className={inp} value={t.dateCompleted} onChange={ev => UT(t.id, "dateCompleted", ev.target.value)} /></div>
                    <div><label className={lbl}>Certificate No.</label><input className={inp} placeholder="TC-12345" value={t.certNo} onChange={ev => UT(t.id, "certNo", ev.target.value)} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addTraining} className="w-full border border-dashed border-[#D4AF37] text-[#D4AF37] py-2 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-[#D4AF37]/10">
                <Plus size={16} /> Add Training Course
              </button>
              <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpenSection('skills'); }}
                style={{ background:'transparent', border:'1px solid #D4AF37', color:'#D4AF37', padding:'6px 16px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', marginTop:'12px' }}>
                Next Section →
              </button>
            </div>
          )}

          {/* ── SKILLS ── */}
          <Section id="skills" icon={<Wrench size={16} />} title="Skills & Experience" />
          {openSection === "skills" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-4 mb-1">
              <div>
                <label className={lbl}>Engine Types Experience</label>
                <input className={inp} placeholder="MAN B&W 6S50MC-C, Wärtsilä 6RT-flex58T-B..." value={skills.engineTypes} onChange={e => setSkills(s => ({ ...s, engineTypes: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Cargo Types Handled</label>
                <input className={inp} placeholder="Crude Oil, Dry Bulk, Chemicals, LNG..." value={skills.cargoTypes} onChange={e => setSkills(s => ({ ...s, cargoTypes: e.target.value }))} />
              </div>
              <div>
                <label className="text-[#D4AF37] text-xs font-semibold mb-2 block">ECDIS Systems</label>
                <div className="flex flex-wrap gap-2">
                  {ECDIS_SYSTEMS.map(sys => (
                    <button key={sys} onClick={() => toggleEcdis(sys)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${skills.ecdis.includes(sys) ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "bg-transparent text-gray-400 border-[#1e3a5f] hover:border-[#D4AF37]"}`}>
                      {sys}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Computer Skills</label>
                <input className={inp} placeholder="MS Office, AMOS, ShipManager..." value={skills.computerSkills} onChange={e => setSkills(s => ({ ...s, computerSkills: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Other Skills & Competencies</label>
                <textarea className={inp + " h-16 resize-none"} placeholder="ISM/ISPS procedures, cargo planning, stability calculations..." value={skills.other} onChange={e => setSkills(s => ({ ...s, other: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Preview Button */}
          <div className="pb-4">
            <button onClick={() => setView("preview")}
              className="w-full bg-[#D4AF37] text-[#0D1B2A] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 shadow-lg hover:bg-yellow-400 transition-colors mt-3">
              <Eye size={20} /> Preview My CV →
            </button>
          </div>
        </div>
      )}

      {/* ══════════ PREVIEW VIEW ══════════ */}
      {view === "preview" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3 pb-2 flex gap-2 print:hidden">
            <button onClick={() => setView("form")}
              className="px-4 py-3 bg-[#132236] text-gray-300 rounded-xl text-sm font-medium flex items-center gap-2 hover:text-white transition-colors">
              <ArrowLeft size={16} /> Back to Edit
            </button>
            <button onClick={handleDownloadPDF}
              className="flex-1 bg-[#D4AF37] text-[#0D1B2A] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors shadow-lg">
              <Printer size={18} /> Download PDF
            </button>
          </div>

          {/* CV Preview Container - WHITE background for printing */}
          <div id="cv-preview" style={{ background:'#fff', color:'#000', fontFamily:'Arial, Helvetica, sans-serif', fontSize:'11px', lineHeight:'1.4', padding:'15mm', maxWidth:'210mm', margin:'0 auto', boxSizing:'border-box' }}>

            {/* HEADER */}
            <div style={{ display:'flex', gap:'20px', marginBottom:'0', paddingBottom:'0' }}>
              {/* Photo box */}
              <div style={{ flexShrink:0 }}>
                {photo
                  ? <img src={photo} style={{ width:'95px', height:'115px', objectFit:'cover', display:'block' }} alt="Profile" />
                  : <div style={{ width:'95px', height:'115px', background:'#e8e8e8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'#999', textAlign:'center', border:'1px solid #ccc' }}>PASSPORT<br/>PHOTO</div>
                }
              </div>
              {/* Name & info */}
              <div style={{ flex:1 }}>
                <div style={{ background:'#0D1B2A', padding:'10px 14px', marginBottom:'6px' }}>
                  <div style={{ fontSize:'22px', fontWeight:'900', color:'#FFFFFF', letterSpacing:'2px', textTransform:'uppercase', lineHeight:'1.1' }}>
                    {personal.firstName || personal.lastName ? `${personal.firstName} ${personal.lastName}`.trim() : 'YOUR NAME'}
                  </div>
                  <div style={{ fontSize:'12px', color:'#D4AF37', fontWeight:'bold', marginTop:'3px', letterSpacing:'1px', textTransform:'uppercase' }}>
                    {personal.rank || 'RANK / POSITION'}
                    {personal.applyingFor ? <span style={{ color:'#aaa', fontWeight:'normal', fontSize:'10px' }}> | Seeking: {personal.applyingFor}</span> : ''}
                  </div>
                </div>
                {/* Two-column contact details */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 16px', fontSize:'9px', color:'#333', lineHeight:'1.8' }}>
                  {personal.nationality && <div><span style={{ color:'#555', fontWeight:'bold', textTransform:'uppercase' }}>Nationality: </span>{personal.nationality}</div>}
                  {personal.dob && <div><span style={{ color:'#555', fontWeight:'bold', textTransform:'uppercase' }}>Date of Birth: </span>{fmtDate(personal.dob)}</div>}
                  {personal.passportNo && <div><span style={{ color:'#555', fontWeight:'bold', textTransform:'uppercase' }}>Passport: </span>{personal.passportNo}</div>}
                  {personal.cdcNo && <div><span style={{ color:'#555', fontWeight:'bold', textTransform:'uppercase' }}>CDC/SB: </span>{personal.cdcNo}{personal.cdcCountry ? ` (${personal.cdcCountry})` : ''}</div>}
                  {personal.phone && <div><span style={{ color:'#555', fontWeight:'bold', textTransform:'uppercase' }}>WhatsApp: </span>{personal.phone}</div>}
                  {personal.email && <div><span style={{ color:'#555', fontWeight:'bold', textTransform:'uppercase' }}>Email: </span>{personal.email}</div>}
                  {personal.address && <div style={{ gridColumn:'span 2' }}><span style={{ color:'#555', fontWeight:'bold', textTransform:'uppercase' }}>Address: </span>{personal.address}</div>}
                </div>
                {/* Availability row */}
                {(personal.availableFrom || personal.expectedSalaryMin) && (
                  <div style={{ marginTop:'5px', padding:'3px 8px', background:'#fffbea', borderLeft:'3px solid #D4AF37', fontSize:'9px', display:'flex', gap:'20px' }}>
                    {personal.availableFrom && <span><strong>AVAILABLE FROM:</strong> {personal.availableFrom}</span>}
                    {personal.expectedSalaryMin && <span><strong>EXPECTED SALARY:</strong> USD {personal.expectedSalaryMin}{personal.expectedSalaryMax ? `–${personal.expectedSalaryMax}` : ''}/month</span>}
                  </div>
                )}
              </div>
            </div>
            {/* Divider line */}
            <div style={{ height:'3px', background:'linear-gradient(to right, #0D1B2A, #D4AF37, #0D1B2A)', margin:'10px 0 12px 0' }} />

            {/* OBJECTIVE / SUMMARY */}
            {personal.summary && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>PROFESSIONAL SUMMARY</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <div style={{ color:'#333', fontStyle:'italic' }}>{personal.summary}</div>
              </div>
            )}

            {/* SEA SERVICE RECORD */}
            {filledSea.length > 0 && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>SEA SERVICE RECORD</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9px' }}>
                  <thead>
                    <tr style={{ background:'#0D1B2A', color:'#fff' }}>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'center', fontSize:'9px', fontWeight:'bold' }}>Sr.</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Vessel Name</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Type</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Flag</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>GRT/DWT</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Rank</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Company</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Sign On</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Sign Off</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Engine Type</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontSize:'9px', fontWeight:'bold' }}>Cargo Handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledSea.map((s: any, i: number) => (
                      <React.Fragment key={s.id || i}>
                        {/* Main vessel row */}
                        <tr style={{ background: i%2===0 ? '#fff' : '#f8f9fa', fontSize:'9px' }}>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'center' }}>{i+1}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px', fontWeight:'bold' }}>{s.vesselName || s.vessel_name || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.vesselType || s.vessel_type || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.flag || s.flagState || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.grt || s.grtDwt || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.rankOnBoard || s.rank || personal.rank || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.company || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.signOn || s.sign_on || s.fromDate || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.signOff || s.sign_off || s.toDate || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{s.engineType || s.engine_type || s.engineTypes || ''}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>
                            {[
                              ...(Array.isArray(s.cargoTypes) ? s.cargoTypes : []),
                              s.cargoType || s.cargo_type || '',
                              s.otherCargo || ''
                            ].filter(Boolean).join(', ')}
                          </td>
                        </tr>
                        {/* Experience sub-row */}
                        {(s.pscInspections || s.vettingInspections || s.rightshipInspection || s.drydockExperience || s.tankWashing || s.holdCleaning || s.wallWash || s.cargoHeating || s.inertGas || s.pscDetentions) && (
                          <tr style={{ background:'#fffde7', fontSize:'8px' }}>
                            <td style={{ border:'1px solid #dee2e6', padding:'2px' }}></td>
                            <td colSpan={10} style={{ border:'1px solid #dee2e6', padding:'3px 6px', color:'#444', fontStyle:'italic', lineHeight:'1.6' }}>
                              <strong style={{ color:'#0D1B2A' }}>Special Experience: </strong>
                              {[
                                s.drydockExperience && 'Drydock',
                                s.tankWashing && 'Tank Washing',
                                s.holdCleaning && 'Hold Cleaning',
                                s.wallWash && 'Wall Wash',
                                s.cargoHeating && 'Cargo Heating',
                                s.inertGas && 'Inert Gas Ops',
                                s.pscInspections && `PSC Inspections: ${s.pscInspections}`,
                                (s.pscDetentions && s.pscDetentions !== 'None') && `PSC Detentions: ${s.pscDetentions}`,
                                s.vettingInspections && `Vetting (SIRE/CDI): ${s.vettingInspections}`,
                                s.rightshipInspection && `RightShip GHG: ${s.rightshipGHG || 'N/A'}${s.rightshipDeficiencies ? ` — ${s.rightshipDeficiencies}` : ''}`,
                              ].filter(Boolean).join('   |   ')}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign:'right', fontSize:'10px', fontWeight:'bold', color:'#0D1B2A', marginTop:'4px' }}>
                  Total Sea Service: {calcTotalSeaService(filledSea)}
                </div>
              </div>
            )}

            {/* CERTIFICATES */}
            {filledCerts.length > 0 && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>CERTIFICATES & ENDORSEMENTS</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9px' }}>
                  <thead>
                    <tr style={{ background:'#0D1B2A', color:'#fff' }}>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', fontWeight:'bold' }}>Sr.</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Certificate Name</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Cert No.</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Issue Date</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Expiry Date</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Issuing Authority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledCerts.map((c: any, i: number) => {
                      const isExpired = c.expiryDate && new Date(c.expiryDate) < new Date();
                      const expiringSoon = c.expiryDate && !isExpired && new Date(c.expiryDate) < new Date(Date.now() + 90*24*60*60*1000);
                      return (
                        <tr key={c.id || i} style={{ background: isExpired ? '#fff0f0' : expiringSoon ? '#fffbe0' : i%2===0 ? '#fff' : '#f8f9fa' }}>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'center' }}>{i+1}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px', fontWeight:'bold' }}>{c.name}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{c.number}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{fmtDate(c.issueDate)}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px', color: isExpired ? 'red' : expiringSoon ? 'orange' : 'inherit' }}>{fmtDate(c.expiryDate) || 'No Expiry'}</td>
                          <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{c.issuingAuthority}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize:'8px', color:'#999', marginTop:'2px' }}>🔴 Expired &nbsp; 🟡 Expiring within 90 days</div>
              </div>
            )}

            {/* EDUCATION */}
            {filledEdu.length > 0 && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>EDUCATION</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9px' }}>
                  <thead>
                    <tr style={{ background:'#0D1B2A', color:'#fff' }}>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Institution</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Qualification</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledEdu.map((e: any, i: number) => (
                      <tr key={e.id || i} style={{ background: i%2===0 ? '#fff' : '#f8f9fa' }}>
                        <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{e.institution}</td>
                        <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{e.qualification}</td>
                        <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{e.yearFrom}{e.yearTo ? ` - ${e.yearTo}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TRAINING COURSES */}
            {filledTraining.length > 0 && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>TRAINING COURSES</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9px' }}>
                  <thead>
                    <tr style={{ background:'#0D1B2A', color:'#fff' }}>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Course</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Institution</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Date</th>
                      <th style={{ border:'1px solid #dee2e6', padding:'3px', textAlign:'left', fontWeight:'bold' }}>Cert No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledTraining.map((t: any, i: number) => (
                      <tr key={t.id || i} style={{ background: i%2===0 ? '#fff' : '#f8f9fa' }}>
                        <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{t.courseName}</td>
                        <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{t.institution}</td>
                        <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{fmtDate(t.dateCompleted)}</td>
                        <td style={{ border:'1px solid #dee2e6', padding:'3px' }}>{t.certNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ENGINE / CARGO EXPERIENCE */}
            {(skills?.engineTypes || skills?.cargoTypes) && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>TECHNICAL EXPERIENCE</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
                  {skills?.engineTypes && (
                    <div>
                      <div style={{ fontSize:'9px', fontWeight:'bold', marginBottom:'3px' }}>MAIN ENGINE TYPES:</div>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        {skills.engineTypes.split(',').map((e: string, i: number) => e.trim() && (
                          <span key={i} style={{ background:'#0D1B2A', color:'#D4AF37', padding:'2px 6px', borderRadius:'3px', fontSize:'9px' }}>{e.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {skills?.cargoTypes && (
                    <div>
                      <div style={{ fontSize:'9px', fontWeight:'bold', marginBottom:'3px' }}>CARGO EXPERIENCE:</div>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        {skills.cargoTypes.split(',').map((c: string, i: number) => c.trim() && (
                          <span key={i} style={{ background:'#0D1B2A', color:'#D4AF37', padding:'2px 6px', borderRadius:'3px', fontSize:'9px' }}>{c.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LANGUAGES */}
            {skills.languages.filter(l => l.language).length > 0 && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>LANGUAGES</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  {skills.languages.filter(l => l.language).map((l, i) => (
                    <span key={i} style={{ fontSize:'10px', color:'#333' }}>{l.language} — <em>{l.level}</em></span>
                  ))}
                </div>
              </div>
            )}

            {/* ECDIS */}
            {skills.ecdis.length > 0 && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>ECDIS SYSTEMS</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                  {skills.ecdis.map(s => <span key={s} style={{ background:'#0D1B2A', color:'#fff', fontSize:'9px', padding:'2px 8px', borderRadius:'12px' }}>{s}</span>)}
                </div>
              </div>
            )}

            {/* ADDITIONAL SKILLS */}
            {(skills.computerSkills || skills.other) && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>ADDITIONAL SKILLS</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                {skills.computerSkills && <p style={{ fontSize:'10px', color:'#333', marginBottom:'2px' }}><strong>Computer:</strong> {skills.computerSkills}</p>}
                {skills.other && <p style={{ fontSize:'10px', color:'#333' }}>{skills.other}</p>}
              </div>
            )}

            {/* EMERGENCY CONTACT */}
            {personal.emergencyName && (
              <div style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', marginTop:'12px' }}>
                  <div style={{ width:'4px', height:'16px', background:'#D4AF37' }} />
                  <div style={{ fontSize:'10px', fontWeight:'900', color:'#0D1B2A', letterSpacing:'1.5px', textTransform:'uppercase' }}>EMERGENCY CONTACT</div>
                  <div style={{ flex:1, height:'1px', background:'#0D1B2A', opacity:0.2 }} />
                </div>
                <p style={{ fontSize:'10px', color:'#333' }}>{personal.emergencyName}{personal.emergencyPhone && ` — ${personal.emergencyPhone}`}</p>
              </div>
            )}

            {/* FOOTER */}
            <div style={{ borderTop:'2px solid #0D1B2A', marginTop:'16px', paddingTop:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <img src="/seaminds-logo.png" style={{ width:'28px', height:'28px', borderRadius:'4px', objectFit:'contain' }} alt="SeaMinds" />
                <div>
                  <div style={{ fontSize:'9px', fontWeight:'bold', color:'#0D1B2A', letterSpacing:'0.5px' }}>SEAMINDS VERIFIED CV</div>
                  <div style={{ fontSize:'8px', color:'#888' }}>seaminds.life · PT Indoglobal Service Solutions</div>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'9px', color:'#888' }}>Generated: {new Date().toLocaleDateString('en-GB')}</div>
                <div style={{ fontSize:'8px', color:'#D4AF37', fontWeight:'bold', letterSpacing:'0.5px' }}>COMPETENCY CERTIFIED PLATFORM</div>
              </div>
              {/* QR Code for verification */}
              <div style={{ textAlign:'center', marginLeft:'12px' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(`https://seaminds.life/verify/${personal.firstName || 'crew'}-${new Date().getFullYear()}`)}&format=png&bgcolor=ffffff`}
                  style={{ width:'60px', height:'60px', display:'block' }}
                  alt="Verify CV"
                  crossOrigin="anonymous"
                />
                <div style={{ fontSize:'7px', color:'#888', marginTop:'2px', textAlign:'center' }}>Scan to verify</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



// ── Sub-component: Certificate Row ──
const CertRow = ({ cert, UC, rmCert, inp, sel, lbl }: {
  cert: Cert; UC: (id: string, f: string, v: string) => void;
  rmCert: (id: string) => void; inp: string; sel: string; lbl: string;
}) => {
  const st = certStatus(cert.expiryDate);
  return (
    <div className="border border-[#1e3a5f] rounded-xl p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        {cert.isCustom
          ? <input className={inp + " flex-1 mr-2 text-xs"} placeholder="Certificate name" value={cert.name} onChange={e => UC(cert.id, "name", e.target.value)} />
          : <span className="text-white text-xs font-medium flex-1 pr-2">{cert.name}</span>}
        <div className="flex items-center gap-2 flex-shrink-0">
          {st === "valid" && <span className="text-green-400 text-xs font-bold">✓ Valid</span>}
          {st === "expiring" && <span className="text-yellow-400 text-xs font-bold">⚠ Expiring</span>}
          {st === "expired" && <span className="text-red-400 text-xs font-bold">✗ Expired</span>}
          {cert.isCustom && <button onClick={() => rmCert(cert.id)} className="text-red-400 ml-1"><Trash2 size={12} /></button>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div><label className={lbl}>Cert No.</label><input className={inp} placeholder="No." value={cert.number} onChange={e => UC(cert.id, "number", e.target.value)} /></div>
        <div><label className={lbl}>Flag State</label><input className={inp} placeholder="Flag" value={cert.flagState} onChange={e => UC(cert.id, "flagState", e.target.value)} /></div>
        <div><label className={lbl}>Issuing Authority</label><input className={inp} placeholder="Authority" value={cert.issuingAuthority} onChange={e => UC(cert.id, "issuingAuthority", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={lbl}>Issue Date</label><input type="date" className={inp} value={cert.issueDate} onChange={e => UC(cert.id, "issueDate", e.target.value)} /></div>
        <div><label className={lbl}>Expiry Date</label><input type="date" className={inp} value={cert.expiryDate} onChange={e => UC(cert.id, "expiryDate", e.target.value)} /></div>
      </div>
    </div>
  );
};

export default ResumeBuilder;
