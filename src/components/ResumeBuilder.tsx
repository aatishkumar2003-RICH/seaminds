import { useState, useRef } from "react";
import {
  Camera, Plus, Trash2, Eye, Edit3, Award, Ship, FileText,
  User, GraduationCap, Globe, ChevronDown, ChevronUp,
  Printer, Anchor, Star, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─────────── TYPES ───────────
interface SeaEntry {
  id: string; vesselName: string; imoNumber: string; vesselType: string;
  flagState: string; company: string; rankOnBoard: string; engineType: string;
  grtDwt: string; fromDate: string; toDate: string;
}
interface Cert {
  id: string; name: string; number: string; issueDate: string;
  expiryDate: string; isCustom?: boolean;
}
interface Language { language: string; level: string; }

// ─────────── CONSTANTS ───────────
const RANKS = ["Captain / Master","Chief Officer","2nd Officer","3rd Officer",
  "Chief Engineer","2nd Engineer","3rd Engineer","4th Engineer","ETO / EEO",
  "Bosun","AB Seaman","Ordinary Seaman (OS)","Fitter","Oiler","Wiper",
  "Cook","Messman / Steward","Deck Cadet","Engine Cadet"];

const VESSEL_TYPES = ["Bulk Carrier","Container Ship","Oil Tanker","Chemical Tanker",
  "LNG Carrier","LPG Carrier","RORO","General Cargo","Offshore Supply Vessel",
  "Platform Supply Vessel","Anchor Handling Vessel","Passenger / Cruise Ship",
  "Dredger","Tug / Towage","Car Carrier","Reefer","Other"];

const ENGINE_TYPES = ["2-Stroke Diesel (MAN B&W)","2-Stroke Diesel (Wärtsilä/Sulzer)",
  "4-Stroke Diesel","Diesel Electric","Steam Turbine","Gas Turbine","Dual Fuel LNG","Other"];

const ECDIS_SYSTEMS = ["JRC","Furuno","Transas / Navtor","Kongsberg","Raytheon Anschütz",
  "Wärtsilä NAVI-SAILOR","Consilium","Nobeltec","Kelvin Hughes","Yokogawa"];

const STD_CERTS: string[] = [
  "Certificate of Competency (CoC)",
  "STCW Basic Safety Training (BST)",
  "Proficiency in Survival Craft & Rescue Boats (PSSR)",
  "Elementary First Aid (EFA)",
  "Advanced Fire Fighting (AFF)",
  "GMDSS — General Operator Certificate (GOC)",
  "Medical Certificate (ENG1 / PEME)",
  "CDC / Seaman's Book",
  "Oil Tanker Endorsement (OT)",
  "Chemical Tanker Endorsement (CT)",
  "LNG/LPG Tanker Endorsement",
  "STCW Security Awareness (SAQ)",
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

const fmtMonth = (m: string) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(mo) - 1]} ${y}`;
};

// ─────────── COMPONENT ───────────
const ResumeBuilder = () => {
  const [view, setView] = useState<"form" | "preview">("form");
  const [openSection, setOpenSection] = useState<string | null>("personal");
  const [photo, setPhoto] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const [personal, setPersonal] = useState({
    firstName: "", lastName: "", rank: "", nationality: "",
    dob: "", phone: "", email: "", address: "",
    passportNo: "", cdcNo: "", cdcCountry: "", summary: "",
  });

  const [sea, setSea] = useState<SeaEntry[]>([{
    id: "1", vesselName: "", imoNumber: "", vesselType: "", flagState: "",
    company: "", rankOnBoard: "", engineType: "", grtDwt: "", fromDate: "", toDate: "",
  }]);

  const [certs, setCerts] = useState<Cert[]>(
    STD_CERTS.map((name, i) => ({
      id: String(i), name, number: "", issueDate: "", expiryDate: "", isCustom: false,
    }))
  );

  const [edu, setEdu] = useState({ academy: "", degree: "", year: "", country: "" });

  const [skills, setSkills] = useState({
    ecdis: [] as string[],
    languages: [{ language: "English", level: "Fluent" }] as Language[],
    other: "",
  });

  // ── Handlers ──
  const P = (f: string, v: string) => setPersonal(p => ({ ...p, [f]: v }));
  const addVessel = () => setSea(s => [...s, {
    id: Date.now().toString(), vesselName: "", imoNumber: "", vesselType: "",
    flagState: "", company: "", rankOnBoard: "", engineType: "", grtDwt: "", fromDate: "", toDate: "",
  }]);
  const rmVessel = (id: string) => setSea(s => s.filter(e => e.id !== id));
  const U = (id: string, f: string, v: string) =>
    setSea(s => s.map(e => e.id === id ? { ...e, [f]: v } : e));
  const UC = (id: string, f: string, v: string) =>
    setCerts(c => c.map(cert => cert.id === id ? { ...cert, [f]: v } : cert));
  const addCert = () => setCerts(c => [...c, {
    id: Date.now().toString(), name: "", number: "", issueDate: "", expiryDate: "", isCustom: true,
  }]);
  const rmCert = (id: string) => setCerts(c => c.filter(cert => cert.id !== id));
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

  const handlePrint = () => {
    const div = printRef.current;
    if (!div) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>CV - ${personal.firstName} ${personal.lastName}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Georgia,serif;color:#1a1a1a;background:#fff}
        .cv-header{background:#0D1B2A;color:#fff;padding:24px;display:flex;align-items:center;gap:20px}
        .cv-photo{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #D4AF37;flex-shrink:0}
        .cv-photo-ph{width:96px;height:96px;border-radius:50%;background:#1a2d47;border:2px solid #D4AF37;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:36px}
        .cv-name{font-size:22px;font-weight:700;color:#fff}
        .cv-rank{color:#D4AF37;font-size:15px;margin-top:2px}
        .cv-contact{color:#ccc;font-size:12px;margin-top:4px}
        .cv-body{padding:24px;display:flex;gap:20px}
        .cv-main{flex:2;border-right:2px solid #eee;padding-right:20px}
        .cv-side{flex:1}
        .cv-section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0D1B2A;border-bottom:2px solid #D4AF37;padding-bottom:4px;margin-bottom:10px;margin-top:16px}
        .vessel-card{background:#f7f8fa;border:1px solid #eee;border-radius:6px;padding:10px;margin-bottom:8px}
        .vessel-name{font-weight:700;color:#0D1B2A;font-size:13px}
        .vessel-rank{color:#D4AF37;font-weight:600;font-size:12px}
        .vessel-meta{color:#666;font-size:11px;margin-top:2px}
        .cert-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:11px}
        .cert-name{color:#333}
        .cert-meta{color:#999;font-size:10px}
        .status-valid{color:#22c55e}
        .status-expiring{color:#f59e0b}
        .status-expired{color:#ef4444}
        .chip{display:inline-block;background:#0D1B2A;color:#fff;font-size:10px;padding:2px 8px;border-radius:12px;margin:2px}
        .summary{border-left:3px solid #D4AF37;padding:8px 12px;color:#444;font-size:12px;font-style:italic;margin-bottom:12px}
        .edu-box{background:#f7f8fa;border-radius:6px;padding:10px}
        .lang-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#444}
        .footer{background:#0D1B2A;padding:8px;text-align:center;margin-top:16px}
        .footer p{color:#D4AF37;font-size:10px}
        @page{margin:0.5cm}
      </style></head><body>${div.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleScanCV = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanMessage('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('parse-cv-documents', {
        body: { file_base64: base64, mime_type: file.type },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (error || !data?.success) throw new Error(error?.message || 'Scan failed');
      const cv = data.data;
      let filled = 0;
      if (cv.name || cv.rank || cv.nationality || cv.date_of_birth) {
        setPersonal((p) => ({
          ...p,
          ...(cv.name && { firstName: cv.name.split(' ')[0], lastName: cv.name.split(' ').slice(1).join(' ') }),
          ...(cv.rank && { rank: cv.rank }),
          ...(cv.nationality && { nationality: cv.nationality }),
          ...(cv.date_of_birth && { dob: cv.date_of_birth }),
        }));
        filled++;
      }
      if (cv.sea_service?.length > 0) {
        setSea(cv.sea_service.map((s: any) => ({
          id: String(Date.now()) + String(Math.random()),
          vesselName: s.vessel_name || '',
          imoNumber: '',
          vesselType: s.vessel_type || '',
          flagState: s.flag || '',
          company: s.company || '',
          rankOnBoard: s.rank || '',
          engineType: s.engine_type || '',
          grtDwt: '',
          fromDate: s.sign_on || '',
          toDate: s.sign_off || '',
        })));
        filled++;
      }
      if (cv.certificates?.length > 0) {
        setCerts(cv.certificates.map((c: any) => ({
          id: String(Date.now()) + String(Math.random()),
          name: c.name || '',
          number: c.number || '',
          issueDate: c.issue_date || '',
          expiryDate: c.expiry_date || '',
          isCustom: true,
        })));
        filled++;
      }
      if (cv.education?.length > 0) {
        const first = cv.education[0];
        setEdu({
          academy: typeof first === 'string' ? first : first.institution || '',
          degree: typeof first === 'string' ? '' : first.qualification || '',
          year: typeof first === 'string' ? '' : first.year || '',
          country: '',
        });
        filled++;
      }
      if (cv.main_engine_types?.length > 0 || cv.cargo_experience?.length > 0) {
        setSkills((s) => ({
          ...s,
          other: [
            s.other,
            cv.main_engine_types?.length > 0 ? `Engine types: ${cv.main_engine_types.join(', ')}` : '',
            cv.cargo_experience?.length > 0 ? `Cargo: ${cv.cargo_experience.join(', ')}` : '',
          ].filter(Boolean).join('. '),
        }));
        filled++;
      }
      if (cv.summary) {
        setPersonal((p) => ({ ...p, summary: p.summary || cv.summary }));
      }
      const total = (cv.sea_service?.length || 0) + (cv.certificates?.length || 0);
      setScanMessage(`✅ CV scanned — ${total} records imported across ${filled} sections. Review and fill any missing details.`);
      setOpenSection('personal');
    } catch (err: any) {
      setScanMessage('❌ Could not read CV: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = '';
    }
  };

  // ── Shared styles ──
  const inp = "w-full bg-[#0a1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none placeholder:text-gray-600";
  const sel = "w-full bg-[#0a1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none";
  const lbl = "text-gray-400 text-xs mb-1 block";

  const Section = ({ id, icon, title }: { id: string; icon: React.ReactNode; title: string }) => (
    <button
      onClick={() => setOpenSection(openSection === id ? null : id)}
      className="w-full flex items-center justify-between p-3.5 bg-[#132236] rounded-xl mb-1 text-left hover:bg-[#1a2d47] transition-colors"
    >
      <div className="flex items-center gap-2 text-white text-sm font-semibold">
        {icon}{title}
      </div>
      {openSection === id
        ? <ChevronUp size={16} className="text-[#D4AF37]" />
        : <ChevronDown size={16} className="text-gray-500" />}
    </button>
  );

  // ── Filtered for preview ──
  const filledSea = sea.filter(s => s.vesselName);
  const filledCerts = certs.filter(c => c.name && c.number);
  const fullName = `${personal.firstName} ${personal.lastName}`.trim() || "Your Name";

  return (
    <div className="flex flex-col h-full bg-[#0D1B2A]">

      {/* ─── TAB BAR ─── */}
      <div className="flex gap-2 p-3 pb-1">
        {(["form","preview"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${view === v ? "bg-[#D4AF37] text-[#0D1B2A]" : "bg-[#132236] text-gray-400 hover:text-white"}`}>
            {v === "form" ? <><Edit3 size={16}/> Build CV</> : <><Eye size={16}/> Preview &amp; Print</>}
          </button>
        ))}
      </div>

      {/* ══════════ FORM VIEW ══════════ */}
      {view === "form" && (
        <div className="flex-1 overflow-y-auto px-3 pt-2 space-y-1">

          {/* ── AI SCAN CV ── */}
          <div className="rounded-xl p-4 mb-2" style={{ background: '#0D1B2A', border: '1px solid #D4AF37' }}>
            <input ref={scanInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleScanCV} />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚡</span>
              <span className="text-[#D4AF37] font-bold text-sm">AI Auto-Fill</span>
            </div>
            <p className="text-gray-400 text-xs mb-3">Upload your existing CV — AI extracts and fills all fields automatically</p>
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); scanInputRef.current?.click(); }}
              disabled={scanning}
              style={{ background: '#D4AF37', color: '#0D1B2A', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', opacity: scanning ? 0.7 : 1 }}
            >
              {scanning ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Scanning CV...</span>
              ) : '📄 Scan My CV'}
            </button>
            {scanMessage && <p className="text-xs mt-3" style={{ color: scanMessage.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{scanMessage}</p>}
          </div>

          {/* ── PERSONAL ── */}
          <Section id="personal" icon={<User size={16}/>} title="Personal Details" />
          {openSection === "personal" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-3 mb-1">
              <div className="flex items-center gap-3 mb-2">
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                <button onClick={() => photoRef.current?.click()} title="Upload photo" className="flex-shrink-0">
                  {photo
                    ? <img src={photo} alt="Photo" className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37]" />
                    : <div className="w-16 h-16 rounded-full bg-[#132236] border-2 border-dashed border-[#1e3a5f] flex flex-col items-center justify-center text-gray-500">
                        <Camera size={18} />
                        <span className="text-[8px] mt-0.5">Add Photo</span>
                      </div>
                  }
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>First Name</label><input className={inp} placeholder="Juan" value={personal.firstName} onChange={e=>P("firstName",e.target.value)}/></div>
                <div><label className={lbl}>Last Name</label><input className={inp} placeholder="Dela Cruz" value={personal.lastName} onChange={e=>P("lastName",e.target.value)}/></div>
              </div>
              <div><label className={lbl}>Rank / Position</label>
                <select className={sel} value={personal.rank} onChange={e=>P("rank",e.target.value)}>
                  <option value="">Select rank...</option>{RANKS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Nationality</label><input className={inp} placeholder="Filipino" value={personal.nationality} onChange={e=>P("nationality",e.target.value)}/></div>
                <div><label className={lbl}>Date of Birth</label><input type="date" className={inp} value={personal.dob} onChange={e=>P("dob",e.target.value)}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>WhatsApp / Phone</label><input className={inp} placeholder="+63..." value={personal.phone} onChange={e=>P("phone",e.target.value)}/></div>
                <div><label className={lbl}>Email Address</label><input className={inp} placeholder="name@email.com" value={personal.email} onChange={e=>P("email",e.target.value)}/></div>
              </div>
              <div><label className={lbl}>Home Address / City, Country</label><input className={inp} placeholder="Manila, Philippines" value={personal.address} onChange={e=>P("address",e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Passport Number</label><input className={inp} placeholder="P1234567A" value={personal.passportNo} onChange={e=>P("passportNo",e.target.value)}/></div>
                <div><label className={lbl}>CDC / Seaman Book No.</label><input className={inp} placeholder="CDC-123456" value={personal.cdcNo} onChange={e=>P("cdcNo",e.target.value)}/></div>
              </div>
              <div>
                <label className={lbl}>Professional Summary (optional — describe your career in 2–3 sentences)</label>
                <textarea className={inp+" h-20 resize-none"} placeholder="Experienced 2nd Engineer with 8+ years on bulk carriers and tankers..." value={personal.summary} onChange={e=>P("summary",e.target.value)}/>
              </div>
            </div>
          )}

          {/* ── SEA SERVICE ── */}
          <Section id="sea" icon={<Ship size={16}/>} title={`Sea Service History (${sea.length} vessel${sea.length>1?"s":""})`}/>
          {openSection === "sea" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-4 mb-1">
              {sea.map((e,idx)=>(
                <div key={e.id} className="border border-[#1e3a5f] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#D4AF37] text-xs font-bold">🚢 VESSEL {idx+1}</span>
                    {sea.length>1&&<button onClick={()=>rmVessel(e.id)} className="text-red-400 hover:text-red-300 transition-colors"><Trash2 size={14}/></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Vessel Name *</label><input className={inp} placeholder="MV Pacific Star" value={e.vesselName} onChange={ev=>U(e.id,"vesselName",ev.target.value)}/></div>
                    <div><label className={lbl}>IMO Number</label><input className={inp} placeholder="9123456" value={e.imoNumber} onChange={ev=>U(e.id,"imoNumber",ev.target.value)}/></div>
                  </div>
                  <div><label className={lbl}>Vessel Type</label>
                    <select className={sel} value={e.vesselType} onChange={ev=>U(e.id,"vesselType",ev.target.value)}>
                      <option value="">Select type...</option>{VESSEL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Flag State</label><input className={inp} placeholder="Panama" value={e.flagState} onChange={ev=>U(e.id,"flagState",ev.target.value)}/></div>
                    <div><label className={lbl}>Rank on Board</label>
                      <select className={sel} value={e.rankOnBoard} onChange={ev=>U(e.id,"rankOnBoard",ev.target.value)}>
                        <option value="">Rank...</option>{RANKS.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className={lbl}>Manning Agency / Company</label><input className={inp} placeholder="Anglo-Eastern, Columbia, Bernhard Schulte..." value={e.company} onChange={ev=>U(e.id,"company",ev.target.value)}/></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Engine Type</label>
                      <select className={sel} value={e.engineType} onChange={ev=>U(e.id,"engineType",ev.target.value)}>
                        <option value="">Engine type...</option>{ENGINE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div><label className={lbl}>GRT / DWT</label><input className={inp} placeholder="180,000 DWT" value={e.grtDwt} onChange={ev=>U(e.id,"grtDwt",ev.target.value)}/></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>From (Month/Year)</label><input type="month" className={inp} value={e.fromDate} onChange={ev=>U(e.id,"fromDate",ev.target.value)}/></div>
                    <div><label className={lbl}>To (Month/Year)</label><input type="month" className={inp} value={e.toDate} onChange={ev=>U(e.id,"toDate",ev.target.value)}/></div>
                  </div>
                </div>
              ))}
              <button onClick={addVessel} className="w-full border border-dashed border-[#D4AF37] text-[#D4AF37] py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#D4AF37]/10 transition-colors">
                <Plus size={16}/> Add Another Vessel
              </button>
            </div>
          )}

          {/* ── CERTIFICATES ── */}
          <Section id="certs" icon={<Award size={16}/>} title="Certificates & Endorsements"/>
          {openSection === "certs" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-2 mb-1">
              <p className="text-gray-500 text-xs mb-3">Fill in the certificates you hold. Leave blank any you don't have.</p>
              {certs.map(cert=>{
                const st = certStatus(cert.expiryDate);
                return (
                  <div key={cert.id} className="border border-[#1e3a5f] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      {cert.isCustom
                        ? <input className={inp+" flex-1 mr-2 text-xs"} placeholder="Certificate name" value={cert.name} onChange={e=>UC(cert.id,"name",e.target.value)}/>
                        : <span className="text-white text-xs font-medium flex-1 pr-2">{cert.name}</span>
                      }
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {st==="valid"&&<span className="text-green-400 text-xs font-bold">✓ Valid</span>}
                        {st==="expiring"&&<span className="text-yellow-400 text-xs font-bold">⚠ Expiring</span>}
                        {st==="expired"&&<span className="text-red-400 text-xs font-bold">✗ Expired</span>}
                        {cert.isCustom&&<button onClick={()=>rmCert(cert.id)} className="text-red-400 ml-1"><Trash2 size={12}/></button>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className={lbl}>Cert No.</label><input className={inp} placeholder="No." value={cert.number} onChange={e=>UC(cert.id,"number",e.target.value)}/></div>
                      <div><label className={lbl}>Issue Date</label><input type="date" className={inp} value={cert.issueDate} onChange={e=>UC(cert.id,"issueDate",e.target.value)}/></div>
                      <div><label className={lbl}>Expiry Date</label><input type="date" className={inp} value={cert.expiryDate} onChange={e=>UC(cert.id,"expiryDate",e.target.value)}/></div>
                    </div>
                  </div>
                );
              })}
              <button onClick={addCert} className="w-full border border-dashed border-[#D4AF37] text-[#D4AF37] py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#D4AF37]/10 transition-colors">
                <Plus size={16}/> Add Custom Certificate
              </button>
            </div>
          )}

          {/* ── EDUCATION ── */}
          <Section id="edu" icon={<GraduationCap size={16}/>} title="Education"/>
          {openSection === "edu" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-3 mb-1">
              <div><label className={lbl}>Maritime Academy / College</label><input className={inp} placeholder="MAAP, DLMM, NMTI, DMET..." value={edu.academy} onChange={e=>setEdu(d=>({...d,academy:e.target.value}))}/></div>
              <div><label className={lbl}>Degree / Diploma</label><input className={inp} placeholder="BSc Marine Transportation, BSc Marine Engineering..." value={edu.degree} onChange={e=>setEdu(d=>({...d,degree:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Year of Graduation</label><input className={inp} placeholder="2018" value={edu.year} onChange={e=>setEdu(d=>({...d,year:e.target.value}))}/></div>
                <div><label className={lbl}>Country</label><input className={inp} placeholder="Philippines" value={edu.country} onChange={e=>setEdu(d=>({...d,country:e.target.value}))}/></div>
              </div>
            </div>
          )}

          {/* ── SKILLS ── */}
          <Section id="skills" icon={<Globe size={16}/>} title="Skills & Languages"/>
          {openSection === "skills" && (
            <div className="bg-[#0a1929] rounded-xl p-4 space-y-4 mb-1">
              <div>
                <label className="text-[#D4AF37] text-sm font-semibold mb-2 block">ECDIS Systems Known</label>
                <div className="flex flex-wrap gap-2">
                  {ECDIS_SYSTEMS.map(sys=>(
                    <button key={sys} onClick={()=>toggleEcdis(sys)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${skills.ecdis.includes(sys) ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "bg-transparent text-gray-400 border-[#1e3a5f] hover:border-[#D4AF37]"}`}>
                      {sys}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#D4AF37] text-sm font-semibold">Languages</label>
                  <button onClick={addLang} className="text-[#D4AF37] text-xs flex items-center gap-1 hover:opacity-80"><Plus size={12}/>Add</button>
                </div>
                {skills.languages.map((l,i)=>(
                  <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-center">
                    <div className="col-span-2"><input className={inp} placeholder="Language" value={l.language} onChange={e=>UL(i,"language",e.target.value)}/></div>
                    <div className="col-span-2">
                      <select className={sel} value={l.level} onChange={e=>UL(i,"level",e.target.value)}>
                        {LEVELS.map(lv=><option key={lv} value={lv}>{lv}</option>)}
                      </select>
                    </div>
                    {skills.languages.length>1&&<button onClick={()=>rmLang(i)} className="text-red-400 flex justify-center"><Trash2 size={14}/></button>}
                  </div>
                ))}
              </div>

              <div>
                <label className={lbl}>Other Skills & Competencies</label>
                <textarea className={inp+" h-16 resize-none"} placeholder="ISM/ISPS procedures, cargo planning, stability calculations, LRIT, AIS, VDR, autopilot systems..." value={skills.other} onChange={e=>setSkills(s=>({...s,other:e.target.value}))}/>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="pb-4">
            <button onClick={()=>setView("preview")}
              className="w-full bg-[#D4AF37] text-[#0D1B2A] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 shadow-lg hover:bg-yellow-400 transition-colors mt-3">
              <Eye size={20}/> Preview My CV →
            </button>
            <p className="text-gray-600 text-xs text-center mt-2">Preview → Print / Save as PDF</p>
          </div>
        </div>
      )}

      {/* ══════════ PREVIEW VIEW ══════════ */}
      {view === "preview" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3 pb-2 flex gap-2">
            <button onClick={handlePrint}
              className="flex-1 bg-[#D4AF37] text-[#0D1B2A] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors shadow-lg">
              <Printer size={18}/> Download / Print PDF
            </button>
          </div>
          <p className="text-gray-500 text-xs text-center pb-2">A print dialog will open — select "Save as PDF"</p>

          {/* ── CV DOCUMENT ── */}
          <div ref={printRef} className="mx-3 mb-10 bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl" style={{fontFamily:"Georgia, serif"}}>

            {/* Header */}
            <div className="cv-header bg-[#0D1B2A] p-5 flex items-center gap-5">
              {photo
                ? <img src={photo} alt="CV Photo" className="cv-photo w-20 h-20 rounded-full object-cover flex-shrink-0" style={{border:"3px solid #D4AF37"}}/>
                : <div className="cv-photo-ph w-20 h-20 rounded-full bg-[#1a2d47] flex items-center justify-center flex-shrink-0 text-3xl" style={{border:"2px solid #D4AF37"}}>👤</div>
              }
              <div>
                <div className="cv-name text-xl font-bold text-white">{fullName}</div>
                <div className="cv-rank text-[#D4AF37] text-sm font-semibold mt-0.5">{personal.rank||"Rank / Position"}</div>
                <div className="cv-contact text-gray-300 text-xs mt-1 space-y-0.5">
                  {[personal.nationality, personal.phone, personal.email, personal.address].filter(Boolean).join(" · ") || "Contact details..."}
                </div>
                {(personal.passportNo||personal.cdcNo) && (
                  <div className="text-gray-400 text-xs mt-1">
                    {personal.passportNo&&`Passport: ${personal.passportNo}`}{personal.passportNo&&personal.cdcNo&&" · "}{personal.cdcNo&&`CDC: ${personal.cdcNo}`}
                  </div>
                )}
              </div>
            </div>

            <div className="cv-body p-5 flex gap-4">
              {/* Main column */}
              <div className="cv-main flex-[2] pr-4 border-r border-gray-200">
                {personal.summary&&(
                  <div className="cv-summary border-l-4 border-[#D4AF37] pl-3 py-1 mb-4">
                    <p className="text-gray-600 text-xs italic">{personal.summary}</p>
                  </div>
                )}

                {/* Sea Service */}
                {filledSea.length>0&&(
                  <div className="mb-4">
                    <div className="cv-section-title text-[#0D1B2A] font-bold text-xs uppercase tracking-widest border-b-2 border-[#D4AF37] pb-1 mb-2 flex items-center gap-2">
                      <span>⚓</span> SEA SERVICE RECORD
                    </div>
                    <div className="space-y-2">
                      {filledSea.map(e=>(
                        <div key={e.id} className="vessel-card bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="vessel-name font-bold text-[#0D1B2A] text-xs">{e.vesselName}</span>
                              {e.imoNumber&&<span className="text-gray-400 text-xs ml-2">IMO {e.imoNumber}</span>}
                            </div>
                            <span className="vessel-rank text-[#D4AF37] font-bold text-xs">{e.rankOnBoard}</span>
                          </div>
                          <div className="vessel-meta text-gray-500 text-xs mt-0.5">
                            {[e.vesselType, e.grtDwt&&e.grtDwt, e.flagState&&`Flag: ${e.flagState}`, e.company].filter(Boolean).join(" · ")}
                          </div>
                          {e.engineType&&<div className="text-gray-400 text-xs">Engine: {e.engineType}</div>}
                          {(e.fromDate||e.toDate)&&(
                            <div className="text-gray-400 text-xs mt-0.5">{fmtMonth(e.fromDate)||"?"} — {fmtMonth(e.toDate)||"Present"}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certificates */}
                {filledCerts.length>0&&(
                  <div>
                    <div className="cv-section-title text-[#0D1B2A] font-bold text-xs uppercase tracking-widest border-b-2 border-[#D4AF37] pb-1 mb-2 flex items-center gap-2">
                      <span>📋</span> CERTIFICATES &amp; ENDORSEMENTS
                    </div>
                    {filledCerts.map(c=>{
                      const st=certStatus(c.expiryDate);
                      return (
                        <div key={c.id} className="cert-row flex items-center justify-between py-1 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className={st==="valid"?"text-green-500":st==="expiring"?"text-yellow-500":st==="expired"?"text-red-500":"text-gray-300"} style={{fontSize:"10px"}}>
                              {st==="valid"?"✓":st==="expiring"?"⚠":st==="expired"?"✗":"·"}
                            </span>
                            <span className="cert-name text-gray-800 text-xs">{c.name}</span>
                          </div>
                          <div className="cert-meta text-gray-400 text-xs text-right">
                            {c.number&&`No. ${c.number}`}{c.expiryDate&&` · Exp: ${c.expiryDate}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Side column */}
              <div className="cv-side flex-1 space-y-4">
                {/* Education */}
                {edu.academy&&(
                  <div>
                    <div className="cv-section-title text-[#0D1B2A] font-bold text-xs uppercase tracking-widest border-b-2 border-[#D4AF37] pb-1 mb-2">🎓 Education</div>
                    <div className="edu-box bg-gray-50 rounded-lg p-2.5">
                      <div className="font-bold text-[#0D1B2A] text-xs">{edu.academy}</div>
                      {edu.degree&&<div className="text-gray-600 text-xs">{edu.degree}</div>}
                      {(edu.year||edu.country)&&<div className="text-gray-400 text-xs">{[edu.year,edu.country].filter(Boolean).join(", ")}</div>}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {skills.languages.filter(l=>l.language).length>0&&(
                  <div>
                    <div className="cv-section-title text-[#0D1B2A] font-bold text-xs uppercase tracking-widest border-b-2 border-[#D4AF37] pb-1 mb-2">🌐 Languages</div>
                    {skills.languages.filter(l=>l.language).map((l,i)=>(
                      <div key={i} className="lang-row flex justify-between text-xs text-gray-700 py-0.5">
                        <span>{l.language}</span><span className="text-gray-400">{l.level}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ECDIS */}
                {skills.ecdis.length>0&&(
                  <div>
                    <div className="cv-section-title text-[#0D1B2A] font-bold text-xs uppercase tracking-widest border-b-2 border-[#D4AF37] pb-1 mb-2">🖥️ ECDIS</div>
                    <div className="flex flex-wrap gap-1">
                      {skills.ecdis.map(s=><span key={s} className="chip bg-[#0D1B2A] text-white text-xs px-2 py-0.5 rounded-full">{s}</span>)}
                    </div>
                  </div>
                )}

                {/* Other Skills */}
                {skills.other&&(
                  <div>
                    <div className="cv-section-title text-[#0D1B2A] font-bold text-xs uppercase tracking-widest border-b-2 border-[#D4AF37] pb-1 mb-2">⚙️ Skills</div>
                    <p className="text-gray-600 text-xs leading-relaxed">{skills.other}</p>
                  </div>
                )}

                {/* SeaMinds Badge */}
                <div className="mt-4 bg-[#0D1B2A] rounded-xl p-3 text-center">
                  <div className="text-[#D4AF37] font-bold text-xs flex items-center justify-center gap-1">
                    <Anchor size={12}/> SeaMinds Verified
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">seaminds.life</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="footer bg-[#0D1B2A] py-2 text-center">
              <p className="text-[#D4AF37] text-xs font-medium">Generated by SeaMinds · The Maritime Wellness &amp; Competency Platform · seaminds.life</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeBuilder;
