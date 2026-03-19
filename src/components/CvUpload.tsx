import { useState, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Check, Loader2, FileText, Ship, GraduationCap, Stethoscope, Upload } from "lucide-react";

interface CvUploadProps {
  onParsed: (data: {
    firstName?: string;
    lastName?: string;
    nationality?: string;
    role?: string;
    yearsAtSea?: string;
    vesselImo?: string;
    shipName?: string;
    whatsappNumber?: string;
  }) => void;
  onFileReady?: (file: File) => void;
}

const RANK_MAP: Record<string, string> = {
  "Captain": "Captain",
  "Chief Officer": "Officer",
  "2nd Officer": "Officer",
  "3rd Officer": "Officer",
  "Chief Engineer": "Engineer",
  "2nd Engineer": "Engineer",
  "3rd Engineer": "Engineer",
  "4th Engineer": "Engineer",
  "ETO": "Engineer",
  "Bosun": "Rating",
  "AB Seaman": "Rating",
  "OS": "Rating",
  "Oiler": "Rating",
  "Cook": "Rating",
  "Steward": "Rating",
};

const YEARS_MAP: Record<string, string> = {
  "Less than 1 year": "Less than 1 year",
  "1-2 years": "1-3 years",
  "1-3 years": "1-3 years",
  "3-5 years": "3-7 years",
  "3-7 years": "3-7 years",
  "6-10 years": "7-15 years",
  "7-15 years": "7-15 years",
  "11-15 years": "7-15 years",
  "15+ years": "15+ years",
};

const CvUpload = ({ onParsed, onFileReady }: CvUploadProps) => {
  const { accessToken, user } = useAuth();
  const [status, setStatus] = useState<"idle" | "reading" | "success" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cvSummary, setCvSummary] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fileRef.current?.click();
  };

  const handleFile = async (file: File) => {
    console.log('CV Upload: file selected', file?.name, file?.type, file?.size);
    setFileName(file.name);
    setStatus("reading");
    setErrorMsg("");
    setShowConfirmation(false);
    setCvSummary(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setIsProcessing(true);
      let data: any, error: any;
      try {
        console.log('CV Upload: calling parse-cv-documents');
        const result = await supabase.functions.invoke("parse-cv-documents", {
          body: { file_base64: base64, mime_type: file.type },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        data = result.data;
        error = result.error;
        console.log('CV Upload: response', data, error);
      } finally {
        setIsProcessing(false);
      }

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Could not read CV");
      }

      const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
      console.log('CV Upload: parsed data', parsed);

      // Show confirmation screen instead of immediately saving
      setCvSummary(parsed);
      setShowConfirmation(true);
      setStatus("success");
      onFileReady?.(file);
      trackEvent("cv_upload_success");
    } catch (e) {
      console.error("CV parse error:", e);
      setErrorMsg(e instanceof Error ? e.message : "Could not read CV. Please fill manually.");
      setStatus("error");
    }
  };

  const handleConfirm = async () => {
    if (!cvSummary) return;

    const cv = cvSummary.personal || cvSummary;
    const mapped: Parameters<CvUploadProps["onParsed"]>[0] = {};

    // Try new format fields first, fall back to personal object
    const firstName = cv.firstName || (cvSummary.name ? cvSummary.name.split(" ")[0] : "");
    const lastName = cv.lastName || (cvSummary.name ? cvSummary.name.split(" ").slice(1).join(" ") : "");
    
    if (firstName) mapped.firstName = firstName;
    if (lastName) mapped.lastName = lastName;
    if (cv.nationality || cvSummary.nationality) mapped.nationality = cv.nationality || cvSummary.nationality;
    
    const rankVal = cv.rank || cvSummary.rank;
    if (rankVal && RANK_MAP[rankVal]) mapped.role = RANK_MAP[rankVal];
    else if (rankVal) mapped.role = rankVal;
    
    const yearsVal = cv.yearsAtSea || cvSummary.years_experience;
    if (yearsVal) mapped.yearsAtSea = YEARS_MAP[yearsVal] || yearsVal;
    if (cv.imoNumber) mapped.vesselImo = cv.imoNumber;
    if (cv.currentVessel) mapped.shipName = cv.currentVessel;
    if (cv.phone) mapped.whatsappNumber = cv.phone;

    console.log('CV Upload: confirmed, mapped data', mapped);
    onParsed(mapped);
    setShowConfirmation(false);

    // Save structured document data to crew_cv_data
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("crew_cv_data").upsert({
          user_id: session.user.id,
          certificates: (cvSummary.certificates || []) as any,
          sea_service: (cvSummary.sea_service || cvSummary.vessel_experience || []) as any,
          medical: (cvSummary.medical || []) as any,
          education: (cvSummary.education || []) as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        console.log('CV Upload: document data saved to crew_cv_data');
      }
    } catch (saveErr) { console.log("CV data save (non-blocking):", saveErr); }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      {/* Processing state */}
      {isProcessing && (
        <div className="rounded-xl p-5 text-center space-y-3" style={{ border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.05)" }}>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-[3px] border-muted animate-spin" style={{ borderTopColor: "hsl(var(--primary))" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={16} className="text-primary" />
              </div>
            </div>
          </div>
          <p className="font-bold text-sm text-primary">🤖 AI is reading your CV...</p>
          <p className="text-xs text-muted-foreground">This may take 15–20 seconds</p>
          <div className="space-y-1.5 text-left max-w-xs mx-auto">
            {["Extracting personal details...", "Reading certificates...", "Identifying sea service..."].map((step) => (
              <div key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={10} className="animate-spin text-primary shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation screen */}
      {!isProcessing && showConfirmation && cvSummary && (
        <div style={{ background: '#0D1B2A', border: '1px solid #D4AF37', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#D4AF37', marginBottom: '16px', fontSize: '15px', fontWeight: 'bold' }}>✅ CV Read Successfully — Please Confirm</h3>

          {/* Rank & Experience */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#888', fontSize: '12px' }}>RANK / POSITION</label>
            <input value={cvSummary?.rank || cvSummary?.personal?.rank || ''} onChange={e => setCvSummary({...cvSummary, rank: e.target.value, personal: { ...cvSummary.personal, rank: e.target.value }})}
              style={{ display:'block', width:'100%', background:'#1a2e47', border:'1px solid #2a4060', color:'white', padding:'8px', borderRadius:'6px', marginTop:'4px', fontSize: '13px' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#888', fontSize: '12px' }}>YEARS OF EXPERIENCE</label>
            <input value={cvSummary?.years_experience || cvSummary?.personal?.yearsAtSea || ''} onChange={e => setCvSummary({...cvSummary, years_experience: e.target.value, personal: { ...cvSummary.personal, yearsAtSea: e.target.value }})}
              style={{ display:'block', width:'100%', background:'#1a2e47', border:'1px solid #2a4060', color:'white', padding:'8px', borderRadius:'6px', marginTop:'4px', fontSize: '13px' }} />
          </div>

          {/* Vessel Experience */}
          {(cvSummary?.sea_service || cvSummary?.vessel_experience || []).length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#888', fontSize: '12px' }}>VESSEL TYPES WORKED ON</label>
              <div style={{ color: 'white', fontSize: '13px', marginTop: '4px' }}>
                {(cvSummary?.sea_service || cvSummary?.vessel_experience || []).slice(0, 3).map((v: any, i: number) => (
                  <div key={i} style={{ background:'#1a2e47', padding:'6px 10px', borderRadius:'6px', marginBottom:'4px' }}>
                    {v.vessel_name} — {v.vessel_type} ({v.rank || v.role}) {v.sign_on || v.from_date} to {v.sign_off || v.to_date}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Engine type for engineers */}
          {cvSummary?.main_engine_types?.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#888', fontSize: '12px' }}>MAIN ENGINE EXPERIENCE</label>
              <div style={{ color: '#D4AF37', fontSize: '13px', marginTop: '4px' }}>{cvSummary.main_engine_types.join(', ')}</div>
            </div>
          )}

          {/* Cargo for deck officers */}
          {cvSummary?.cargo_experience?.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#888', fontSize: '12px' }}>CARGO EXPERIENCE</label>
              <div style={{ color: '#D4AF37', fontSize: '13px', marginTop: '4px' }}>{cvSummary.cargo_experience.join(', ')}</div>
            </div>
          )}

          {/* Certificates count */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#888', fontSize: '12px' }}>CERTIFICATES FOUND</label>
            <div style={{ color: 'white', fontSize: '13px', marginTop: '4px' }}>{(cvSummary?.certificates || []).length} certificates detected</div>
          </div>

          {/* AI Summary */}
          {cvSummary?.summary && (
            <div style={{ background:'#1a2e47', padding:'12px', borderRadius:'8px', marginBottom:'16px', color:'#ccc', fontSize:'13px', fontStyle:'italic' }}>
              "{cvSummary.summary}"
            </div>
          )}

          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={handleConfirm}
              style={{ flex:1, background:'#D4AF37', color:'#0D1B2A', border:'none', padding:'12px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', fontSize: '14px' }}>
              ✓ Confirm & Proceed
            </button>
            <button onClick={() => { setShowConfirmation(false); setCvSummary(null); setStatus("idle"); }}
              style={{ background:'transparent', color:'#888', border:'1px solid #2a4060', padding:'12px 16px', borderRadius:'8px', cursor:'pointer', fontSize: '13px' }}>
              Re-upload
            </button>
          </div>
        </div>
      )}

      {/* Idle state */}
      {!isProcessing && !showConfirmation && status === "idle" && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full rounded-xl p-5 text-center transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{
            border: "1px dashed hsl(var(--primary))",
            background: "hsl(var(--primary) / 0.05)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(var(--primary) / 0.15)" }}>
              <Upload size={20} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-primary">Upload Your CV</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF or photo — AI extracts certificates & sea service</p>
            </div>
          </div>
        </button>
      )}

      {/* Reading but not yet processing */}
      {!isProcessing && !showConfirmation && status === "reading" && (
        <div className="rounded-xl p-5 text-center" style={{ border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.05)" }}>
          <Loader2 size={20} className="animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Preparing {fileName}...</p>
        </div>
      )}

      {/* Success state (after confirmation was done) */}
      {!isProcessing && !showConfirmation && status === "success" && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(var(--primary) / 0.3)" }}>
          <div className="p-4 flex items-center gap-3" style={{ background: "hsl(var(--primary) / 0.1)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.2)" }}>
              <Check size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">✓ CV Confirmed</p>
              <p className="text-xs text-muted-foreground">Data saved successfully</p>
            </div>
          </div>
          <div className="px-4 py-2 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Review your details below</p>
            <button onClick={handleClick} className="text-xs text-primary underline">Re-upload</button>
          </div>
        </div>
      )}

      {/* Error state */}
      {!isProcessing && !showConfirmation && status === "error" && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full rounded-xl p-5 text-center transition-all hover:opacity-90"
          style={{ border: "1px solid hsl(var(--destructive) / 0.3)", background: "hsl(var(--destructive) / 0.05)" }}
        >
          <p className="text-sm font-medium text-destructive">❌ {errorMsg}</p>
          <p className="text-xs text-muted-foreground mt-1">Tap to try again or fill manually</p>
        </button>
      )}
    </div>
  );
};

export default CvUpload;
