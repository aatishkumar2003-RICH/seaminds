import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useInspection } from "@/hooks/takeover/useInspection";
import { computeStats, type AnyAnswer } from "@/lib/takeover/answers";
import type { GroupKey } from "@/lib/takeover/template";
import SignInGate from "@/components/takeover/SignInGate";
import MasterTab from "@/components/takeover/MasterTab";
import SparesTab from "@/components/takeover/SparesTab";
import SafetyTab from "@/components/takeover/SafetyTab";
import CertificatesTab from "@/components/takeover/CertificatesTab";
import PhotosTab from "@/components/takeover/PhotosTab";
import ReportTab from "@/components/takeover/ReportTab";
import MembersDialog from "@/components/takeover/MembersDialog";
import { SaveIndicator } from "@/components/takeover/ui";
import { uploadEvidence } from "@/lib/takeover/photos";

type Tab = "master" | "spares" | "safety" | "certificates" | "photos" | "report";

const TABS: [Tab, string][] = [
  ["master", "Master"],
  ["spares", "Spares"],
  ["safety", "Safety"],
  ["certificates", "Certificates"],
  ["photos", "Photos"],
  ["report", "Report"],
];

export default function TakeoverInspection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [tab, setTab] = useState<Tab>("master");
  const [showMembers, setShowMembers] = useState(false);

  const {
    inspection,
    answers,
    attachments,
    loading,
    loadError,
    saveState,
    conflict,
    canEdit,
    reload,
    updateAnswer,
    resolveConflictKeepMine,
    resolveConflictTakeServer,
  } = useInspection(id);

  const photoRefs = useMemo(
    () => new Set(attachments.filter((a) => a.group_key && a.item_ref).map((a) => `${a.group_key}:${a.item_ref}`)),
    [attachments]
  );
  const stats = useMemo(() => computeStats(answers, photoRefs), [answers, photoRefs]);

  const addPhoto = (group: GroupKey) => (ref: string) => {
    if (!id) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const caption = window.prompt("Caption — what does this photo prove?") || "";
      const res = await uploadEvidence({
        inspectionId: id,
        file,
        caption,
        groupKey: group,
        itemRef: ref,
        sourceType: "camera",
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Photo uploaded");
        reload();
      }
    };
    input.click();
  };

  const update = (group: GroupKey) => (ref: string, patch: AnyAnswer) => updateAnswer(group, ref, patch);

  if (isReady && !user) return <SignInGate />;

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-20">
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/management/inspections")} className="flex items-center gap-1 text-[#D4AF37] min-h-[44px]">
            <ChevronLeft size={20} /> Inspections
          </button>
          <div className="flex items-center gap-3">
            <SaveIndicator state={saveState} />
            {inspection && (
              <button onClick={() => setShowMembers(true)} className="text-[#D4AF37] p-2">
                <Users size={18} />
              </button>
            )}
          </div>
        </div>

        {loading && <p className="text-sm text-[#94A3B8] mt-6">Loading inspection…</p>}
        {loadError && <p className="text-sm text-red-300 mt-6">{loadError}</p>}

        {inspection && (
          <>
            <h1 className="text-lg font-bold text-[#D4AF37] mt-2">{inspection.vessel_name}</h1>
            <p className="text-[11px] text-[#94A3B8]">
              IMO {inspection.imo || "not supplied"} · {inspection.status === "submitted" ? "submitted (locked)" : "draft"} ·{" "}
              {stats.answered}/{stats.total} answered · {stats.verified} verified · {stats.deficiencies} deficiencies
            </p>
            {!canEdit && inspection.status === "draft" && (
              <p className="text-[11px] text-amber-300 mt-1">You have read-only access to this inspection.</p>
            )}

            <div className="flex gap-2 overflow-x-auto py-3 sticky top-0 bg-[#0D1B2A] z-10">
              {TABS.map(([t, l]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`shrink-0 min-h-[44px] px-4 rounded-xl text-sm font-semibold border ${
                    tab === t ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)] text-slate-300"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {conflict && (
              <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 mb-3">
                <p className="text-sm font-semibold text-amber-200">
                  This item changed on another device ({conflict.group} {conflict.ref}). Your work has been kept, not
                  overwritten.
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={resolveConflictKeepMine} className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm">
                    Keep my version
                  </button>
                  <button onClick={resolveConflictTakeServer} className="min-h-[44px] px-4 rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm">
                    Use the other device's version
                  </button>
                </div>
              </div>
            )}

            {tab === "master" && (
              <MasterTab answers={answers} canEdit={canEdit} photoRefs={photoRefs} onUpdate={update("master")} onAddPhoto={addPhoto("master")} />
            )}
            {tab === "spares" && <SparesTab answers={answers} canEdit={canEdit} onUpdate={update("spares")} />}
            {tab === "safety" && (
              <SafetyTab answers={answers} canEdit={canEdit} photoRefs={photoRefs} onUpdate={update("safety")} onAddPhoto={addPhoto("safety")} />
            )}
            {tab === "certificates" && <CertificatesTab answers={answers} canEdit={canEdit} onUpdate={update("certificates")} />}
            {tab === "photos" && id && (
              <PhotosTab inspectionId={id} attachments={attachments} canEdit={canEdit} onChanged={reload} />
            )}
            {tab === "report" && (
              <ReportTab inspection={inspection} answers={answers} attachments={attachments} canEdit={canEdit} onSubmitted={reload} />
            )}
          </>
        )}
      </div>

      {showMembers && id && (
        <MembersDialog inspectionId={id} isOwner={inspection?.owner_id === user?.id} onClose={() => setShowMembers(false)} />
      )}
    </div>
  );
}
