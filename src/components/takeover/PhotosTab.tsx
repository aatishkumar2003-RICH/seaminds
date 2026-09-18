import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { signedUrl, uploadEvidence } from "@/lib/takeover/photos";
import type { AttachmentRecord } from "@/hooks/takeover/useInspection";

interface Props {
  inspectionId: string;
  attachments: AttachmentRecord[];
  canEdit: boolean;
  onChanged: () => void;
}

export default function PhotosTab({ inspectionId, attachments, canEdit, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const a of attachments) {
        if (a.mime_type === "application/pdf") continue;
        const u = await signedUrl(a.storage_path);
        if (u) next[a.id] = u;
      }
      if (live) setUrls(next);
    })();
    return () => {
      live = false;
    };
  }, [attachments]);

  const pick = (sourceType: "camera" | "gallery" | "document") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = sourceType === "document" ? "application/pdf" : "image/*";
    if (sourceType === "camera") input.setAttribute("capture", "environment");
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      const caption = window.prompt("Caption — what does this evidence prove?") || "";
      const res = await uploadEvidence({ inspectionId, file, caption, sourceType });
      setBusy(false);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Evidence uploaded and recorded");
        onChanged();
      }
    };
    input.click();
  };

  return (
    <div>
      {canEdit && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => pick("camera")} className="min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm flex items-center justify-center gap-2">
            <Camera size={16} /> Camera
          </button>
          <button onClick={() => pick("gallery")} className="min-h-[48px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm flex items-center justify-center gap-2">
            <ImageIcon size={16} /> Gallery
          </button>
          <button onClick={() => pick("document")} className="min-h-[48px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm">
            PDF
          </button>
        </div>
      )}
      {busy && (
        <p className="text-xs text-[#D4AF37] flex items-center gap-2 mb-3">
          <Loader2 className="animate-spin" size={14} /> Uploading — an online connection is required for evidence.
        </p>
      )}
      <p className="text-xs text-[#94A3B8] mb-3">
        Photo log is generated automatically from uploads. Files stay in private storage and open through temporary
        authorised links only.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {attachments.map((a) => (
          <div key={a.id} className="rounded-xl bg-[#112240] border border-[rgba(212,175,55,0.3)] overflow-hidden">
            {urls[a.id] ? (
              <img src={urls[a.id]} alt={a.caption || `Evidence ${a.photo_no}`} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 flex items-center justify-center text-xs text-[#94A3B8]">
                {a.mime_type === "application/pdf" ? "PDF evidence" : "Loading…"}
              </div>
            )}
            <div className="p-2">
              <p className="text-[11px] font-semibold text-[#D4AF37]">
                P{a.photo_no} {a.item_ref ? `· ${a.group_key} ${a.item_ref}` : ""}
              </p>
              <p className="text-[11px] text-slate-300 line-clamp-2">{a.caption || "No caption"}</p>
              <p className="text-[10px] text-[#94A3B8]">
                {a.source_type} · {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
      {!attachments.length && <p className="text-sm text-[#94A3B8] text-center py-6">No evidence uploaded yet.</p>}
    </div>
  );
}
