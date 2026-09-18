import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useInspection } from "@/hooks/takeover/useInspection";
import { answerKey, computeStats, type AnyAnswer } from "@/lib/takeover/answers";
import { titleOf } from "@/lib/takeover/findings";
import type { GroupKey } from "@/lib/takeover/template";
import SignInGate from "@/components/takeover/SignInGate";
import MasterTab from "@/components/takeover/MasterTab";
import SparesTab from "@/components/takeover/SparesTab";
import SafetyTab from "@/components/takeover/SafetyTab";
import CertificatesTab from "@/components/takeover/CertificatesTab";
import FindingsTab from "@/components/takeover/FindingsTab";
import PhotosTab from "@/components/takeover/PhotosTab";
import ReportTab from "@/components/takeover/ReportTab";
import MembersDialog from "@/components/takeover/MembersDialog";
import { SaveIndicator } from "@/components/takeover/ui";
import { isPhotoEvidence, uploadEvidence, type SourceType } from "@/lib/takeover/photos";

type Tab = "master" | "spares" | "safety" | "certificates" | "findings" | "photos" | "report";

const TABS: [Tab, string][] = [
  ["master", "Master"],
  ["spares", "Spares"],
  ["safety", "Safety"],
  ["certificates", "Certificates"],
  ["findings", "Findings"],
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
    storageError,
    saveState,
    itemStatus,
    conflicts,
    canEdit,
    reload,
    reloadAttachments,
    updateAnswer,
    retryNow,
    flush,
    resolveConflictKeepMine,
    resolveConflictTakeServer,
  } = useInspection(id);

  /** Only image evidence satisfies a photo-required check. */
  const photoRefs = useMemo(
    () =>
      new Set(
        attachments
          .filter((a) => a.group_key && a.item_ref && isPhotoEvidence(a.mime_type))
          .map((a) => `${a.group_key}:${a.item_ref}`)
      ),
    [attachments]
  );
  const stats = useMemo(() => computeStats(answers, photoRefs), [answers, photoRefs]);
  const conflictList = Object.entries(conflicts);

  const addPhoto = (group: GroupKey) => (ref: string, source: SourceType) => {
    if (!id) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (source === "camera_requested") input.setAttribute("capture", "environment");
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
        sourceType: source,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Photo uploaded");
        // Refresh evidence only — pending answers stay exactly as typed.
        reloadAttachments();
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
            {(saveState === "failed" || saveState === "unsynced") && (
              <button onClick={() => void retryNow()} className="text-[#D4AF37] flex items-center gap-1 text-xs font-semibold">
                <RefreshCw size={14} /> Retry
              </button>
            )}
            {inspection && (
              <button onClick={() => setShowMembers(true)} className="text-[#D4AF37] p-2">
                <Users size={18} />
              </button>
            )}
          </div>
        </div>

        {loading && <p className="text-sm text-[#94A3B8] mt-6">Loading inspection…</p>}
        {loadError && (
          <div className="rounded-2xl border border-red-400/50 bg-red-500/10 p-4 mt-4">
            <p className="text-sm text-red-200">{loadError}</p>
            <button onClick={() => void reload()} className="mt-2 text-xs font-bold text-[#D4AF37]">
              Try loading again
            </button>
          </div>
        )}
        {storageError && (
          <p className="text-[11px] text-amber-300 mt-2">
            Local draft recovery is not working on this device ({storageError}). Your entries still save to the server,
            but nothing is kept locally if the page closes before a save completes.
          </p>
        )}

        {inspection && (
          <>
            <h1 className="text-lg font-bold text-[#D4AF37] mt-2">{inspection.vessel_name}</h1>
            <p className="text-[11px] text-[#94A3B8]">
              IMO {inspection.imo || "not supplied"} ·{" "}
              {inspection.status === "submitted"
                ? `submitted (locked)${inspection.is_partial ? " — PARTIAL" : ""}`
                : "draft"}{" "}
              · {stats.answered}/{stats.total} answered · {stats.verified} verified · {stats.notVerified} recorded but
              not verified · {stats.deficiencies} findings
            </p>
            {!canEdit && inspection.status === "draft" && (
              <p className="text-[11px] text-amber-300 mt-1">
                You have read-only access to this inspection. Entry controls are disabled and the server would reject
                any change.
              </p>
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

            {conflictList.map(([key, c]) => (
              <div key={key} className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 mb-3">
                <p className="text-sm font-semibold text-amber-200">
                  {c.group} {c.ref} · {titleOf(c.group, c.ref)} changed on another device. Your work is kept, not
                  overwritten.
                </p>
                <div className="grid md:grid-cols-2 gap-2 mt-2 text-[11px]">
                  <div className="rounded-xl bg-[#0D1B2A] p-2">
                    <p className="text-[#D4AF37] font-bold mb-1">Your version (this device)</p>
                    <pre className="whitespace-pre-wrap text-slate-200">{JSON.stringify(c.localData, null, 1)}</pre>
                  </div>
                  <div className="rounded-xl bg-[#0D1B2A] p-2">
                    <p className="text-[#D4AF37] font-bold mb-1">Server version {c.serverVersion}</p>
                    <pre className="whitespace-pre-wrap text-slate-200">{JSON.stringify(c.serverData, null, 1)}</pre>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => void resolveConflictKeepMine(key)}
                    className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm"
                  >
                    Keep my version
                  </button>
                  <button
                    onClick={() => void resolveConflictTakeServer(key)}
                    className="min-h-[44px] px-4 rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm"
                  >
                    Use the other device's version
                  </button>
                </div>
              </div>
            ))}

            {tab === "master" && (
              <MasterTab
                answers={answers}
                canEdit={canEdit}
                photoRefs={photoRefs}
                itemStatus={itemStatus}
                onUpdate={update("master")}
                onAddPhoto={addPhoto("master")}
              />
            )}
            {tab === "spares" && (
              <SparesTab answers={answers} canEdit={canEdit} itemStatus={itemStatus} onUpdate={update("spares")} />
            )}
            {tab === "safety" && (
              <SafetyTab
                answers={answers}
                canEdit={canEdit}
                photoRefs={photoRefs}
                itemStatus={itemStatus}
                onUpdate={update("safety")}
                onAddPhoto={addPhoto("safety")}
              />
            )}
            {tab === "certificates" && (
              <CertificatesTab
                answers={answers}
                canEdit={canEdit}
                itemStatus={itemStatus}
                onUpdate={update("certificates")}
              />
            )}
            {tab === "findings" && <FindingsTab answers={answers} />}
            {tab === "photos" && id && (
              <PhotosTab
                inspectionId={id}
                attachments={attachments}
                canEdit={canEdit}
                onChanged={reloadAttachments}
              />
            )}
            {tab === "report" && (
              <ReportTab
                inspection={inspection}
                answers={answers}
                attachments={attachments}
                canEdit={canEdit}
                saveState={saveState}
                conflictCount={conflictList.length}
                flush={flush}
                onSubmitted={reload}
              />
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
