import { useState, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";

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
  const [status, setStatus] = useState<"idle" | "reading" | "success" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStatus("reading");
    setErrorMsg("");

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
        const { data: { session } } = await supabase.auth.getSession();
        const result = await supabase.functions.invoke("parse-cv-documents", {
          body: { file_base64: base64, mime_type: file.type },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        data = result.data;
        error = result.error;
      } finally {
        setIsProcessing(false);
      }

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Could not read CV");
      }

      const cv = data.data;
      const mapped: Parameters<CvUploadProps["onParsed"]>[0] = {};

      if (cv.firstName) mapped.firstName = cv.firstName;
      if (cv.lastName) mapped.lastName = cv.lastName;
      if (cv.nationality) mapped.nationality = cv.nationality;
      if (cv.rank && RANK_MAP[cv.rank]) mapped.role = RANK_MAP[cv.rank];
      if (cv.yearsAtSea) mapped.yearsAtSea = YEARS_MAP[cv.yearsAtSea] || cv.yearsAtSea;
      if (cv.imoNumber) mapped.vesselImo = cv.imoNumber;
      if (cv.currentVessel) mapped.shipName = cv.currentVessel;
      if (cv.whatsapp || cv.phone) mapped.whatsappNumber = cv.whatsapp || cv.phone;

      onParsed(mapped);
      onFileReady?.(file);
      setStatus("success");
      trackEvent("cv_upload_success");
    } catch (e) {
      console.error("CV parse error:", e);
      setErrorMsg(e instanceof Error ? e.message : "Could not read CV. Please fill manually.");
      setStatus("error");
    }
  };

  return (
    <div>
      {isProcessing ? (
        <div style={{ color: '#D4AF37', textAlign: 'center', padding: '16px' }}>
          ⏳ AI is reading your CV... This may take 15-20 seconds
        </div>
      ) : (
      <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-xl p-5 text-center transition-all hover:opacity-90"
        style={{
          border: "1px dashed #D4AF37",
          background: "rgba(212,175,55,0.05)",
        }}
      >
        {status === "idle" && (
          <>
            <div className="text-[32px] mb-2">📄</div>
            <div className="font-bold text-base" style={{ color: "#D4AF37" }}>
              Upload Your CV
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              PDF or photo — AI reads and fills your profile automatically
            </div>
            <div className="text-xs text-muted-foreground mt-2">Supports PDF, JPG, PNG</div>
          </>
        )}
        {status === "reading" && (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 rounded-full border-[3px] border-muted"
              style={{
                borderTopColor: "#D4AF37",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div className="text-sm text-muted-foreground">{fileName}</div>
            <div className="font-bold text-base" style={{ color: "#D4AF37" }}>
              🤖 AI Reading CV...
            </div>
          </div>
        )}
        {status === "success" && (
          <div className="font-medium text-sm" style={{ color: "#22c55e" }}>
            ✓ CV read — please review and confirm your details below
          </div>
        )}
        {status === "error" && (
          <>
            <div className="font-medium text-sm text-destructive">{errorMsg}</div>
            <div className="text-xs text-muted-foreground mt-1">Tap to try again or fill manually</div>
          </>
        )}
      </button>
    </div>
  );
};

export default CvUpload;
