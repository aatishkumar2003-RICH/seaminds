import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Search, Send, Loader2, Bookmark, Trash2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import PhotoAnnotator from "./bridge/PhotoAnnotator";
import GoDeepCard from "./GoDeepCard";

type Msg = { role: "user" | "assistant"; content: string };

const SaveToPocket = ({ messages, onSaved }: { messages: Msg[]; onSaved?: (item: any) => void }) => {
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    const lastUser = [...messages].reverse().find(m => m.role === "user")?.content || "";
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant")?.content || "";
    const item = { query: lastUser, answer: lastAssistant, savedAt: new Date().toISOString() };
    onSaved?.(item);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="flex justify-center" style={{ marginTop: 20, marginBottom: 12 }}>
      <button
        onClick={handleSave}
        className="rounded transition-colors"
        style={{
          border: saved ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.2)",
          color: saved ? "#22c55e" : "#e2e8f0",
          padding: "6px 16px",
          fontSize: 13,
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {saved ? "✓ Saved to Pocket" : "💾 Save to My Pocket"}
      </button>
    </div>
  );
};

const BRIDGE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bridge-chat`;
const DIAGNOSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diagnose-equipment`;

const QUICK_TAPS = ["MARPOL", "SOLAS", "ISM Code", "MLC 2006", "STCW"];

const EQUIPMENT_REGISTER = [
  { emoji: "⚙️", title: "PROPULSION", subtitle: "ISM §10 — Safety Critical",
    equipment: [
      { name: "Main Engine", code: "ME-001", critical: true, tasks: ["Daily — Check RPM, temp, pressure logs per OEM manual","250 hrs — Change LO filters, check fuel injectors","1,000 hrs — Cylinder head inspection, valve clearance (Class/OEM)","4,000 hrs — Major overhaul: pistons, liners, bearings (IACS UR M1)","8,000 hrs — Complete overhaul: crankshaft, all bearings (Class Survey)"] },
      { name: "Aux Generator (DG)", code: "DG-001", critical: true, tasks: ["250 hrs — LO & filter change","1,000 hrs — Valve clearance, injector calibration","4,000 hrs — Overhaul: pistons, liners, turbocharger (Class Survey)"] },
      { name: "Steering Gear", code: "SG-001", critical: true, tasks: ["Pre-departure — Test changeover, manual steering (SOLAS Ch II-1)","Weekly — Hydraulic oil level & pipe inspection","3 months — Full system test both units","12 months — Class survey: relief valves, pumps, rams"] },
      { name: "Stern Tube & Seals", code: "ST-001", critical: true, tasks: ["3 months — Oil level and quality check","12 months — Seal condition inspection","5 years — Full survey: bearing replacement if worn (Class)"] },
    ]},
  { emoji: "🚑", title: "LIFE SAVING (LSA)", subtitle: "SOLAS Ch III — Safety Critical",
    equipment: [
      { name: "Lifeboats (P&S)", code: "LB-001", critical: true, tasks: ["Weekly — Engine test run 3 min, log entry (SOLAS III/20)","Monthly — Full operational check","12 months — On-load release mechanism test","2.5 years — Service by accredited station","5 years — Davit load test, wire/fall check (SOLAS III Reg 20.8)"] },
      { name: "EPIRB", code: "EP-001", critical: true, tasks: ["Monthly — LED self-test check","12 months — Hydrostatic release unit replacement","Battery — Replace per label expiry date","Registration — Must be registered with MMSI (GMDSS)"] },
      { name: "Life Rafts", code: "LR-001", critical: true, tasks: ["12 months — Full service by approved station (SOLAS III/20)","3 months — Hydrostatic release inspection","Annual — Container condition check, stowage verification"] },
      { name: "Immersion Suits", code: "IS-001", critical: true, tasks: ["Monthly — Visual: seams, zip, face seal check","12 months — Full pressure test","Replace — On expiry date or if any damage found"] },
      { name: "Line Throwing Appliance", code: "LTA-001", critical: true, tasks: ["3 months — Visual inspection of rocket and line","12 months — Functional check (SOLAS III Reg 18)","Replace — On expiry date of rockets"] },
    ]},
  { emoji: "🔥", title: "FIRE FIGHTING", subtitle: "SOLAS Ch II-2 — Safety Critical",
    equipment: [
      { name: "Main Fire Pump", code: "FP-001", critical: true, tasks: ["Weekly — Test run & pressure check (SOLAS II-2/10)","3 months — Full flow test with fire hose","12 months — Overhaul: impeller, seals, shaft"] },
      { name: "Emergency Fire Pump", code: "EFP-001", critical: true, tasks: ["Weekly — Start and run test, log entry","3 months — Full operational test from emergency power","12 months — Class service certification"] },
      { name: "CO₂ Fixed System", code: "CO2-001", critical: true, tasks: ["3 months — Visual: cylinders, pipes, nozzles","12 months — CO₂ bottle weight check (>10% loss = refill)","2 years — Full system inspection by certified technician","Annual — Check manual release wires and pull boxes"] },
      { name: "Fire Extinguishers (Portable)", code: "FE-001", critical: false, tasks: ["Monthly — Pressure gauge & seal check","12 months — Service by approved technician","5 years — Hydrostatic test (CO₂ type)"] },
      { name: "Fixed Foam System", code: "FF-001", critical: true, tasks: ["3 months — System inspection: foam tank, valves, nozzles","12 months — Foam sample analysis for quality","5 years — Full shore-based testing (tankers: SOLAS II-2)"] },
    ]},
  { emoji: "🧭", title: "NAVIGATION", subtitle: "SOLAS Ch V — Safety Critical",
    equipment: [
      { name: "ECDIS (Primary & Backup)", code: "ECDIS-001", critical: true, tasks: ["Daily — ENC update status verification","Weekly — Backup system switchover test","3 months — Position sensor cross-check","12 months — Performance test by qualified technician","5 years — Type approval compliance check (SOLAS V/19)"] },
      { name: "Radar (S-Band & X-Band)", code: "RAD-001", critical: true, tasks: ["Weekly — Performance monitor check","3 months — Heading marker alignment & bearing accuracy","12 months — Performance test: reflector test, range accuracy"] },
      { name: "Gyrocompass", code: "GYR-001", critical: true, tasks: ["Daily — Compare with magnetic compass, log error","3 months — Latitude/speed error correction check","12 months — Full calibration by technician (SOLAS V/19)"] },
      { name: "GMDSS (MF/HF/VHF/Sat)", code: "GMDSS-001", critical: true, tasks: ["Daily — Radio log entry, DSC watch maintained (ITU/SOLAS IV)","Weekly — Internal DSC distress alert test","12 months — Shore-based test by approved technician","5 years — Battery replacement for DSC/NAVTEX units"] },
      { name: "VDR / SVDR", code: "VDR-001", critical: true, tasks: ["Weekly — Indicator light check","12 months — Annual performance test by approved service (SOLAS V/20)","Capsule — Inspect float-free capsule annually"] },
      { name: "AIS Class A", code: "AIS-001", critical: true, tasks: ["Daily — Verify MMSI, position accuracy transmitted","Weekly — Test SART response","12 months — Position fix accuracy cross-check (SOLAS V/19)"] },
    ]},
  { emoji: "🌊", title: "MARPOL SYSTEMS", subtitle: "MARPOL Annex I/IV/VI",
    equipment: [
      { name: "Oily Water Separator (OWS)", code: "OWS-001", critical: true, tasks: ["Monthly — Calibrate 15ppm bilge alarm (MARPOL Annex I Reg 14)","3 months — Inspect separator filter/coalescer","12 months — Full service: clean chambers, replace filter","Ongoing — Maintain Oil Record Book Part I entries"] },
      { name: "Sewage Treatment Plant", code: "STP-001", critical: false, tasks: ["Daily — Check biological tank level and aeration","Monthly — Sample test for MARPOL Annex IV compliance","12 months — Full service and tank cleaning"] },
      { name: "Incinerator", code: "INC-001", critical: false, tasks: ["Weekly — Combustion chamber inspection (MARPOL Annex VI)","3 months — Burner and ignition system check","12 months — Full service: flue, fans, controls, temperature recorder"] },
    ]},
  { emoji: "⚓", title: "DECK & HULL", subtitle: "Class / Flag State Requirements",
    equipment: [
      { name: "Anchor Windlass", code: "AW-001", critical: false, tasks: ["Weekly — Run test both directions","3 months — Grease all moving parts, check brakes","12 months — Full inspection: brakes, gears, motor controller","5 years — Class survey load test"] },
      { name: "Hatch Covers", code: "HC-001", critical: false, tasks: ["Each voyage — Visual check: seals, cleats, drain plugs","3 months — Ultrasonic hatch cover leak test","12 months — Full inspection: hydraulics, seals, locking devices"] },
      { name: "Watertight Doors", code: "WTD-001", critical: true, tasks: ["Weekly — Open/close test, log entry (SOLAS II-1/15)","3 months — Hydraulic & mechanical override test","12 months — Class inspection: seals, hinges, remote control"] },
      { name: "Mooring Equipment", code: "ME-002", critical: false, tasks: ["Monthly — Visual: ropes/wires, fairleads, bitts","12 months — Full inspection: winch brakes, rendering loads","5 years — Replace wires/ropes per MBL test results"] },
    ]},
  { emoji: "🔧", title: "AUXILIARY SYSTEMS", subtitle: "Pumps, Purifiers, Compressors",
    equipment: [
      { name: "Fuel Oil Purifier", code: "FOP-001", critical: false, tasks: ["Daily — Check temperatures and back-pressure","Weekly — Clean bowl (if no auto-desludge fitted)","1,000 hrs — Full dismantling and bowl clean","2,000 hrs — Bearing replacement, frame inspection"] },
      { name: "Air Compressor (Main)", code: "AC-001", critical: false, tasks: ["Weekly — Drain condensate, check pressure gauge","250 hrs — Oil change, valve inspection","1,000 hrs — Overhaul: pistons, rings, valves, unloaders"] },
      { name: "Bilge System", code: "BIL-001", critical: true, tasks: ["Weekly — Test bilge pumps and high-level alarms (SOLAS II-1)","3 months — Strum box cleaning, valve inspection","12 months — Full system inspection: valves, pipes, sensors, OILY check"] },
      { name: "Ballast Pumps", code: "BP-001", critical: false, tasks: ["Monthly — Test run all pumps","3 months — Seal and bearing inspection","12 months — Overhaul: impeller, shaft seal, valve glands"] },
    ]},
  { emoji: "📋", title: "ISM/RECORDS", subtitle: "ISM Code §10 — Mandatory Records",
    equipment: [
      { name: "Safety Management System (SMS)", code: "SMS-001", critical: true, tasks: ["Monthly — Master review: drill records, near-miss reports (ISM §9)","3 months — Safety committee meeting and minutes","12 months — Internal ISM audit (ISM §12)","2.5 years — Intermediate ISM verification by class/flag","5 years — ISM renewal DOC/SMC audit"] },
      { name: "Oil Record Book (ORB)", code: "ORB-001", critical: true, tasks: ["Every operation — Immediate entry per MARPOL Annex I Reg 17","Monthly — Master check and countersign entries","Retention — Keep 3 years after last entry (MARPOL)"] },
      { name: "Safety Certificates", code: "SC-001", critical: true, tasks: ["Track expiry — SOLAS Safety Cert, IOPP Cert, SMC, MLC Certificate","Renewal — Start process 6 months before expiry","Annual — Intermediate survey flag/class endorsement"] },
    ]},
];


async function streamBridgeChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(BRIDGE_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    onError(body.error || "Failed to get response");
    return;
  }

  if (!resp.body) { onError("No response body"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  onDone();
}

const Bridge = () => {
  const [searchValue, setSearchValue] = useState("");
  const [activeDept, setActiveDept] = useState<typeof EQUIPMENT_REGISTER[number] | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showPocket, setShowPocket] = useState(false);
  const [pocketItems, setPocketItems] = useState<{query: string; answer: string; savedAt: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [diagnosisImage, setDiagnosisImage] = useState<string | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [diagnosisQuery, setDiagnosisQuery] = useState("");
  const [rawPhotoSrc, setRawPhotoSrc] = useState<string | null>(null);
  const [activeEquipment, setActiveEquipment] = useState<null | {name:string; code:string; critical:boolean; tasks:string[]}>(null);

  const loadPocket = () => {
    const items = JSON.parse(localStorage.getItem("bridge_pocket") || "[]");
    setPocketItems(items);
  };

  const deletePocketItem = (index: number) => {
    const updated = pocketItems.filter((_, i) => i !== index);
    setPocketItems(updated);
    localStorage.setItem("bridge_pocket", JSON.stringify(updated));
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuery = async (query: string) => {
    if (!query.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: query.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSearchValue("");
    setShowChat(true);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamBridgeChat({
      messages: newMessages,
      onDelta: upsertAssistant,
      onDone: () => { setIsLoading(false); setMessageCount(prev => prev + 1); },
      onError: (err) => {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${err}` }]);
        setIsLoading(false);
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(searchValue);
  };

  const handleChipClick = (question: string) => {
    setActiveDept(null);
    sendQuery(question);
  };

  const handleQuickTap = (term: string) => {
    sendQuery(`Explain ${term} — key points every seafarer should know`);
  };

  const handleBackToHome = () => {
    setShowChat(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawPhotoSrc(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitDiagnosis = async (annotatedDataUrl: string) => {
    setRawPhotoSrc(null);
    setDiagnosisImage(annotatedDataUrl);
    setDiagnosisLoading(true);
    setDiagnosisResult(null);

    const base64 = annotatedDataUrl.split(",")[1];
    const mimeType = annotatedDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";

    let resultSoFar = "";
    try {
      const resp = await fetch(DIAGNOSE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ image_base64: base64, mime_type: mimeType }),
      });

      if (!resp.ok || !resp.body) {
        const body = await resp.json().catch(() => ({}));
        setDiagnosisResult(`⚠️ ${body.error || "Failed to analyze image"}`);
        setDiagnosisLoading(false);
        return;
      }

      const streamReader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              resultSoFar += content;
              setDiagnosisResult(resultSoFar);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      const equipMatch = resultSoFar.match(/\*\*EQUIPMENT IDENTIFIED:\*\*\s*(.+)/);
      const faultMatch = resultSoFar.match(/\*\*FAULT\/CONDITION DETECTED:\*\*\s*(.+)/);
      const equip = equipMatch?.[1]?.trim() || "ship equipment";
      const fault = faultMatch?.[1]?.trim() || "fault diagnosis";
      setDiagnosisQuery(`${equip} ${fault}`);
    } catch (err) {
      setDiagnosisResult(`⚠️ ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setDiagnosisLoading(false);
  };

  const handleNewDiagnosis = () => {
    setDiagnosisImage(null);
    setDiagnosisResult(null);
    setDiagnosisQuery("");
    setRawPhotoSrc(null);
  };

  // Annotator view
  if (rawPhotoSrc) {
    return (
      <PhotoAnnotator
        imageSrc={rawPhotoSrc}
        onSubmit={submitDiagnosis}
        onCancel={() => setRawPhotoSrc(null)}
      />
    );
  }

  // Diagnosis result view
  if (diagnosisImage && (diagnosisLoading || diagnosisResult)) {
    const ytUrl = diagnosisQuery ? `https://www.youtube.com/results?search_query=maritime+${encodeURIComponent(diagnosisQuery)}` : "";
    const ytCards = diagnosisQuery ? [
      `${diagnosisQuery} — Full Explanation`,
      `${diagnosisQuery} — Step by Step Guide`,
      `${diagnosisQuery} — IMO Requirements`,
    ] : [];
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={handleNewDiagnosis} style={{ color: "#D4AF37" }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#D4AF37" }}>EQUIPMENT DIAGNOSIS</h2>
            <p className="text-[10px] text-muted-foreground">AI Photo Analysis</p>
          </div>
          <button
            onClick={handleNewDiagnosis}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded"
          >
            New Diagnosis
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Image preview */}
          <img
            src={diagnosisImage}
            alt="Equipment"
            className="w-full rounded-xl object-cover"
            style={{ maxHeight: 200 }}
          />
          {/* Loading */}
          {diagnosisLoading && !diagnosisResult && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground" style={{ background: "rgba(13,27,42,0.8)" }}>
              <Loader2 size={14} className="animate-spin" /> 🔍 Analysing equipment...
            </div>
          )}
          {/* Result */}
          {diagnosisResult && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(13,27,42,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:text-[#D4AF37]">
                <ReactMarkdown>{diagnosisResult}</ReactMarkdown>
              </div>
            </div>
          )}
          {/* YouTube section */}
          {diagnosisResult && !diagnosisLoading && ytCards.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ color: "#D4AF37", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>▶ Watch on YouTube</h3>
              {ytCards.map((title, i) => (
                <div
                  key={i}
                  onClick={() => window.open(ytUrl, "_blank")}
                  className="flex items-center gap-3 rounded-lg cursor-pointer"
                  style={{ background: "rgba(13,27,42,0.85)", borderLeft: "2px solid #FF0000", padding: 12, marginBottom: 8 }}
                >
                  <span style={{ color: "#FF0000", fontSize: 18, flexShrink: 0 }}>▶</span>
                  <div>
                    <div className="text-sm text-foreground">{title}</div>
                    <div className="text-[11px] text-muted-foreground">Search on YouTube →</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Official References */}
          {diagnosisResult && !diagnosisLoading && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ color: "#D4AF37", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 Official References</h3>
              {[
                { name: "IMO Official Site", url: "https://www.imo.org" },
                { name: "gCaptain Maritime News", url: "https://gcaptain.com" },
                { name: "Marine Insight Guides", url: "https://www.marineinsight.com" },
                { name: "BIMCO Resources", url: "https://www.bimco.org" },
              ].map((ref, i) => (
                <div
                  key={i}
                  onClick={() => window.open(ref.url, "_blank")}
                  className="flex items-center justify-between cursor-pointer py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>📄</span>
                    <span className="text-sm text-foreground">{ref.name}</span>
                  </div>
                  <span style={{ color: "#D4AF37", fontSize: 14 }}>→</span>
                </div>
              ))}
            </div>
          )}
          {/* Save to Pocket */}
          {diagnosisResult && !diagnosisLoading && (
            <SaveToPocket messages={[
              { role: "user", content: `Equipment Photo Diagnosis` },
              { role: "assistant", content: diagnosisResult },
            ]} />
          )}
        </div>
      </div>
    );
  }

  // Chat view
  if (showChat) {
    return (
      <div className="flex flex-col h-full">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={handleBackToHome} style={{ color: "#D4AF37" }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#D4AF37" }}>PMS</h2>
            <p className="text-[10px] text-muted-foreground">Technical Reference AI</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setShowChat(false); setMessageCount(0); }}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded"
            >
              New Query
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "text-foreground"
                    : ""
                }`}
                style={
                  msg.role === "user"
                    ? { background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)" }
                    : { background: "rgba(13,27,42,0.8)", border: "1px solid rgba(255,255,255,0.05)" }
                }
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:text-[#D4AF37]">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground" style={{ background: "rgba(13,27,42,0.8)" }}>
                <Loader2 size={14} className="animate-spin" /> Searching references...
              </div>
            </div>
          )}
          {/* Go Deeper card */}
          {messageCount === 3 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (() => {
            const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
            if (!lastUserMsg) return null;
            return (
              <GoDeepCard
                lastQuery={lastUserMsg.content}
                header="🔍 Want to research further?"
                subtext="Open this topic in a free AI with no message limits"
              />
            );
          })()}
          {/* YouTube Videos Section - show after AI has responded */}
          {messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (() => {
            const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
            if (!lastUserMsg) return null;
            const q = lastUserMsg.content;
            const ytUrl = `https://www.youtube.com/results?search_query=maritime+${encodeURIComponent(q)}`;
            const cards = [
              `${q} — Full Explanation`,
              `${q} — Step by Step Guide`,
              `${q} — IMO Requirements`,
            ];
            return (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ color: "#D4AF37", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>▶ Watch on YouTube</h3>
                {cards.map((title, i) => (
                  <div
                    key={i}
                    onClick={() => window.open(ytUrl, "_blank")}
                    className="flex items-center gap-3 rounded-lg cursor-pointer"
                    style={{ background: "rgba(13,27,42,0.85)", borderLeft: "2px solid #FF0000", padding: 12, marginBottom: 8 }}
                  >
                    <span style={{ color: "#FF0000", fontSize: 18, flexShrink: 0 }}>▶</span>
                    <div>
                      <div className="text-sm text-foreground">{title}</div>
                      <div className="text-[11px] text-muted-foreground">Search on YouTube →</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Official References */}
          {messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ color: "#D4AF37", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 Official References</h3>
              {[
                { name: "IMO Official Site", url: "https://www.imo.org" },
                { name: "gCaptain Maritime News", url: "https://gcaptain.com" },
                { name: "Marine Insight Guides", url: "https://www.marineinsight.com" },
                { name: "BIMCO Resources", url: "https://www.bimco.org" },
              ].map((ref, i) => (
                <div
                  key={i}
                  onClick={() => window.open(ref.url, "_blank")}
                  className="flex items-center justify-between cursor-pointer py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>📄</span>
                    <span className="text-sm text-foreground">{ref.name}</span>
                  </div>
                  <span style={{ color: "#D4AF37", fontSize: 14 }}>→</span>
                </div>
              ))}
            </div>
          )}
          {/* Save to Pocket */}
          {messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (
            <SaveToPocket messages={messages} />
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border">
          <div className="flex gap-2">
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!searchValue.trim() || isLoading}
              className="px-3 py-2.5 rounded-xl transition-colors disabled:opacity-30"
              style={{ background: "#D4AF37", color: "#0D1B2A" }}
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Pocket view
  if (showPocket) {
    return (
      <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
        <button onClick={() => setShowPocket(false)} className="flex items-center gap-2 mb-4" style={{ color: "#D4AF37" }}>
          <ArrowLeft size={18} /> <span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold" style={{ color: "#D4AF37" }}>💾 My Pocket</h2>
          <p className="text-xs text-muted-foreground">{pocketItems.length} saved {pocketItems.length === 1 ? "item" : "items"}</p>
        </div>
        {pocketItems.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <p>No saved items yet.</p>
            <p className="text-xs mt-1">Use "Save to My Pocket" after any Bridge answer.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pocketItems.map((item, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "rgba(13,27,42,0.85)", border: "1px solid rgba(212,175,55,0.15)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-foreground flex-1">{item.query}</span>
                  <button onClick={() => deletePocketItem(i)} className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{item.answer}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(item.savedAt).toLocaleDateString()}</p>
                <button
                  onClick={() => {
                    setMessages([
                      { role: "user", content: item.query },
                      { role: "assistant", content: item.answer },
                    ]);
                    setShowPocket(false);
                    setShowChat(true);
                  }}
                  className="text-[11px] mt-2 font-medium"
                  style={{ color: "#D4AF37" }}
                >
                  View full answer →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Equipment detail view
  if (activeEquipment) {
    return (
      <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
        <button onClick={() => setActiveEquipment(null)} className="flex items-center gap-2 mb-4" style={{ color: "#D4AF37" }}>
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center mb-4">
          <div className="text-xs font-mono mb-1" style={{ color: "#D4AF37" }}>{activeEquipment.code}</div>
          <h2 className="text-lg font-bold text-foreground">{activeEquipment.name}</h2>
          {activeEquipment.critical && <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>⚠ SAFETY CRITICAL — ISM §10</span>}
        </div>
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid rgba(212,175,55,0.2)" }}>
          <div className="px-3 py-2" style={{ background: "rgba(212,175,55,0.1)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#D4AF37" }}>Maintenance Schedule</span>
          </div>
          {activeEquipment.tasks.map((task, i) => {
            const [interval, ...rest] = task.split(" — ");
            return (
              <div key={i} className="px-3 py-2.5 flex gap-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 0 ? "rgba(13,27,42,0.8)" : "rgba(13,27,42,0.6)" }}>
                <span className="text-[11px] font-bold shrink-0 w-20" style={{ color: "#D4AF37" }}>{interval}</span>
                <span className="text-[11px] text-foreground">{rest.join(" — ")}</span>
              </div>
            );
          })}
        </div>
        <button onClick={() => { const name = activeEquipment.name; setActiveEquipment(null); handleChipClick(`Explain step-by-step maintenance procedure for ${name} on a merchant vessel. Include safety precautions, tools required, and IMO/Class regulatory references.`); }}
          className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #D4AF37, #C5941F)", color: "#0D1B2A" }}>
          🤖 Ask AI — How to Perform This Maintenance
        </button>
      </div>
    );
  }

  // Department drill-down
  if (activeDept) {
    return (
      <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
        <button onClick={() => setActiveDept(null)} className="flex items-center gap-2 mb-4" style={{ color: "#D4AF37" }}>
          <ArrowLeft size={18} /> <span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">{activeDept.emoji}</div>
          <h2 className="text-lg font-bold" style={{ color: "#D4AF37" }}>{activeDept.title}</h2>
          <p className="text-xs text-muted-foreground">{activeDept.subtitle}</p>
        </div>
        <div className="flex flex-col gap-2">
          {activeDept.equipment.map((eq) => (
            <button key={eq.code}
              onClick={() => setActiveEquipment(eq)}
              className="text-left text-sm px-4 py-3 rounded-xl transition-colors"
              style={{ background: "rgba(13,27,42,0.8)", border: `1px solid ${eq.critical ? "rgba(239,68,68,0.5)" : "rgba(212,175,55,0.3)"}`, color: "#e2e8f0" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm" style={{ color: eq.critical ? "#fca5a5" : "#e2e8f0" }}>{eq.name}</span>
                {eq.critical && <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>⚠ CRITICAL</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">{eq.code} · {eq.tasks.length} scheduled tasks</div>
              <div className="text-[10px] mt-1" style={{ color: "#D4AF37" }}>{eq.tasks[0]}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Home view
  return (
    <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold tracking-wider" style={{ color: "#D4AF37" }}>PMS</h1>
        <p className="text-xs text-muted-foreground">Planned Maintenance & Reference</p>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Ask any technical question..."
          className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#D4AF37]"
        />
        {searchValue.trim() && (
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded" style={{ color: "#D4AF37" }}>
            <Send size={16} />
          </button>
        )}
      </form>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {QUICK_TAPS.map((t) => (
          <button
            key={t}
            onClick={() => handleQuickTap(t)}
            className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
            style={{ border: "1px solid #D4AF37", color: "#D4AF37", background: "transparent" }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Camera / Photo Diagnose button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelect}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-3 w-full rounded-xl mb-4 transition-colors text-left"
        style={{ border: "1px solid #D4AF37", background: "transparent", padding: 14 }}
      >
        <Camera size={22} style={{ color: "#D4AF37", flexShrink: 0 }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: "#D4AF37" }}>Diagnose Equipment from Photo</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Photo any alarm, gauge or display — AI gives technical diagnosis</div>
        </div>
      </button>

      {/* My Pocket button */}
      <button
        onClick={() => { loadPocket(); setShowPocket(true); }}
        className="flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl text-sm w-full transition-colors"
        style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", background: "rgba(13,27,42,0.5)" }}
      >
        <Bookmark size={14} /> My Pocket
      </button>

      <div className="grid grid-cols-2 gap-3">
        {EQUIPMENT_REGISTER.map((dept) => (
          <button
            key={dept.title}
            onClick={() => setActiveDept(dept)}
            className="flex flex-col items-start p-4 rounded-xl text-left transition-all hover:border-[#D4AF37]"
            style={{ background: "rgba(13,27,42,0.85)", border: "1px solid rgba(212,175,55,0.15)" }}
          >
            <span className="text-2xl mb-2">{dept.emoji}</span>
            <span className="text-xs font-bold tracking-wide" style={{ color: "#D4AF37" }}>{dept.title}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{dept.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Bridge;
