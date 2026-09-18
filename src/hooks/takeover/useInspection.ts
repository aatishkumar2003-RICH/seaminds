import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { answerKey, type AnswerMap, type AnyAnswer } from "@/lib/takeover/answers";
import type { GroupKey } from "@/lib/takeover/template";
import { deleteDraft, listDrafts, outboxKey, putDraft } from "@/lib/takeover/outbox";

export type SaveState = "idle" | "saving" | "saved" | "unsynced" | "failed";

export interface InspectionRecord {
  id: string;
  owner_id: string;
  vessel_name: string;
  imo: string | null;
  flag: string | null;
  class_society: string | null;
  port_of_registry: string | null;
  inspector_name: string | null;
  started_on: string;
  status: "draft" | "submitted";
  limitation_note: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  template_id: string;
  template_version: number;
  record_version: number;
  created_at: string;
  updated_at: string;
}

export interface AttachmentRecord {
  id: string;
  inspection_id: string;
  group_key: string | null;
  item_ref: string | null;
  photo_no: number | null;
  storage_path: string;
  caption: string | null;
  source_type: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface ConflictInfo {
  group: GroupKey;
  ref: string;
  serverData: AnyAnswer;
  serverVersion: number;
  localData: AnyAnswer;
}

export function useInspection(inspectionId?: string) {
  const { user, isReady } = useAuth();
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef(0);

  const load = useCallback(async () => {
    if (!inspectionId || !user) return;
    setLoading(true);
    setLoadError(null);
    const [insRes, ansRes, attRes] = await Promise.all([
      supabase.from("takeover_inspections" as any).select("*").eq("id", inspectionId).maybeSingle(),
      supabase.from("takeover_answers" as any).select("*").eq("inspection_id", inspectionId),
      supabase
        .from("takeover_attachments" as any)
        .select("*")
        .eq("inspection_id", inspectionId)
        .order("photo_no", { ascending: true }),
    ]);

    if (insRes.error || !insRes.data) {
      setLoadError("This inspection is not available to your account.");
      setLoading(false);
      return;
    }
    const rec = insRes.data as unknown as InspectionRecord;
    setInspection(rec);

    const map: AnswerMap = {};
    ((ansRes.data as any[]) || []).forEach((r) => {
      map[answerKey(r.group_key, r.item_ref)] = {
        id: r.id,
        group_key: r.group_key,
        item_ref: r.item_ref,
        data: r.data || {},
        version: r.version,
        updated_at: r.updated_at,
      };
    });

    // merge any locally recovered drafts that never reached the server
    const drafts = await listDrafts(user.id, inspectionId);
    let recovered = false;
    for (const d of drafts) {
      const k = answerKey(d.group_key as GroupKey, d.item_ref);
      const server = map[k];
      if (!server || (d.expected_version ?? 0) >= server.version) {
        map[k] = {
          ...(server || { group_key: d.group_key as GroupKey, item_ref: d.item_ref, version: 0 }),
          data: d.data as AnyAnswer,
        } as any;
        recovered = true;
      }
    }

    setAnswers(map);
    setAttachments(((attRes.data as any[]) || []) as AttachmentRecord[]);
    setCanEdit(rec.status === "draft");
    if (recovered) setSaveState("unsynced");
    setLoading(false);
  }, [inspectionId, user]);

  useEffect(() => {
    if (isReady && user && inspectionId) load();
    else if (isReady && !user) setLoading(false);
  }, [isReady, user, inspectionId, load]);

  const pushAnswer = useCallback(
    async (group: GroupKey, ref: string, data: AnyAnswer, expected: number | null) => {
      if (!inspectionId || !user) return;
      const obKey = outboxKey(user.id, inspectionId, group, ref);
      inflight.current += 1;
      setSaveState("saving");
      try {
        const { data: res, error } = await supabase.rpc("takeover_save_answer" as any, {
          p_inspection_id: inspectionId,
          p_group_key: group,
          p_item_ref: ref,
          p_data: data as any,
          p_expected_version: expected,
        });
        const r = res as any;
        if (error) throw error;
        if (r?.conflict) {
          setConflict({ group, ref, serverData: r.data || {}, serverVersion: r.version, localData: data });
          setSaveState("unsynced");
          return;
        }
        if (r?.error) {
          setSaveState("failed");
          return;
        }
        setAnswers((prev) => {
          const k = answerKey(group, ref);
          return { ...prev, [k]: { ...(prev[k] || { group_key: group, item_ref: ref, data }), data, version: r.version, updated_at: r.updated_at } };
        });
        await deleteDraft(obKey);
        if (inflight.current <= 1) setSaveState("saved");
      } catch {
        setSaveState("failed");
      } finally {
        inflight.current = Math.max(0, inflight.current - 1);
      }
    },
    [inspectionId, user]
  );

  /** Local-first update: state changes instantly, server save is debounced per item. */
  const updateAnswer = useCallback(
    (group: GroupKey, ref: string, patch: AnyAnswer) => {
      if (!inspectionId || !user || !canEdit) return;
      const k = answerKey(group, ref);
      let merged: AnyAnswer = {};
      let expected: number | null = null;
      setAnswers((prev) => {
        const cur = prev[k];
        merged = { ...(cur?.data || {}), ...patch };
        expected = cur?.version ?? null;
        return { ...prev, [k]: { ...(cur || { group_key: group, item_ref: ref, version: 0 }), data: merged } as any };
      });
      setSaveState("unsynced");

      clearTimeout(timers.current[k]);
      timers.current[k] = setTimeout(() => {
        putDraft({
          key: outboxKey(user.id, inspectionId, group, ref),
          user_id: user.id,
          inspection_id: inspectionId,
          group_key: group,
          item_ref: ref,
          data: merged as any,
          expected_version: expected,
          updated_at: Date.now(),
        });
        pushAnswer(group, ref, merged, expected);
      }, 700);
    },
    [inspectionId, user, canEdit, pushAnswer]
  );

  const resolveConflictKeepMine = useCallback(async () => {
    if (!conflict) return;
    await pushAnswer(conflict.group, conflict.ref, conflict.localData, conflict.serverVersion);
    setConflict(null);
  }, [conflict, pushAnswer]);

  const resolveConflictTakeServer = useCallback(() => {
    if (!conflict) return;
    const k = answerKey(conflict.group, conflict.ref);
    setAnswers((prev) => ({
      ...prev,
      [k]: { group_key: conflict.group, item_ref: conflict.ref, data: conflict.serverData, version: conflict.serverVersion },
    }));
    if (inspectionId && user) deleteDraft(outboxKey(user.id, inspectionId, conflict.group, conflict.ref));
    setConflict(null);
    setSaveState("saved");
  }, [conflict, inspectionId, user]);

  return {
    inspection,
    answers,
    attachments,
    loading,
    loadError,
    saveState,
    conflict,
    canEdit,
    reload: load,
    updateAnswer,
    setAttachments,
    resolveConflictKeepMine,
    resolveConflictTakeServer,
  };
}
