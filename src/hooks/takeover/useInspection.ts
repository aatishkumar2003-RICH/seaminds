import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { answerKey, type AnswerMap, type AnyAnswer } from "@/lib/takeover/answers";
import type { GroupKey } from "@/lib/takeover/template";
import { deleteDraft, listDrafts, outboxKey, putDraft } from "@/lib/takeover/outbox";

export type SaveState = "idle" | "saving" | "saved" | "unsynced" | "failed" | "conflict";
export type ItemStatus = "clean" | "pending" | "saving" | "failed" | "conflict";

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
  is_partial?: boolean;
  submitted_at: string | null;
  submitted_by: string | null;
  submitted_snapshot?: Record<string, unknown> | null;
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

/** Authoritative per-item record held outside React state. */
interface Item {
  group: GroupKey;
  ref: string;
  data: AnyAnswer;
  /** Local revision counter — increments on every keystroke batch. */
  rev: number;
  /** Revision the server has acknowledged. */
  ackedRev: number;
  version: number;
  updated_at?: string;
  sending: boolean;
  failed: boolean;
}

const DEBOUNCE_MS = 700;

export function useInspection(inspectionId?: string) {
  const { user, isReady } = useAuth();
  const userId = user?.id;

  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflicts, setConflicts] = useState<Record<string, ConflictInfo>>({});
  const [itemStatus, setItemStatus] = useState<Record<string, ItemStatus>>({});
  const [canEdit, setCanEdit] = useState(false);

  const items = useRef<Record<string, Item>>({});
  const conflictsRef = useRef<Record<string, ConflictInfo>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /**
   * Bumped whenever the account or inspection changes, or the hook unmounts.
   * Every async callback checks it, so a save started for one user or record
   * can never write into the state of another.
   */
  const gen = useRef(0);

  const clearTimers = () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  };

  /** Publishes the authoritative refs into React state for rendering. */
  const publish = useCallback(() => {
    const map: AnswerMap = {};
    const status: Record<string, ItemStatus> = {};
    let pending = 0;
    let saving = 0;
    let failed = 0;
    Object.entries(items.current).forEach(([k, it]) => {
      map[k] = { group_key: it.group, item_ref: it.ref, data: it.data, version: it.version, updated_at: it.updated_at };
      let s: ItemStatus = "clean";
      if (conflictsRef.current[k]) s = "conflict";
      else if (it.sending) s = "saving";
      else if (it.failed) s = "failed";
      else if (it.rev !== it.ackedRev) s = "pending";
      status[k] = s;
      if (s === "saving") saving++;
      else if (s === "failed") failed++;
      else if (s === "pending") pending++;
    });
    setAnswers(map);
    setItemStatus(status);
    setConflicts({ ...conflictsRef.current });
    const hasConflict = Object.keys(conflictsRef.current).length > 0;
    setSaveState(
      failed ? "failed" : hasConflict ? "conflict" : saving ? "saving" : pending ? "unsynced" : "saved"
    );
  }, []);

  // ---------------------------------------------------------------- loading
  const loadAttachments = useCallback(async () => {
    if (!inspectionId) return;
    const myGen = gen.current;
    const res = await supabase
      .from("takeover_attachments" as any)
      .select("*")
      .eq("inspection_id", inspectionId)
      .order("photo_no", { ascending: true });
    if (myGen !== gen.current) return;
    if (res.error) {
      setLoadError(`Evidence list could not be refreshed: ${res.error.message}`);
      return;
    }
    setAttachments(((res.data as any[]) || []) as AttachmentRecord[]);
  }, [inspectionId]);

  const load = useCallback(async () => {
    if (!inspectionId || !userId) return;
    const myGen = gen.current;
    setLoading(true);
    setLoadError(null);

    const [insRes, ansRes, attRes, editRes] = await Promise.all([
      supabase.from("takeover_inspections" as any).select("*").eq("id", inspectionId).maybeSingle(),
      supabase.from("takeover_answers" as any).select("*").eq("inspection_id", inspectionId),
      supabase
        .from("takeover_attachments" as any)
        .select("*")
        .eq("inspection_id", inspectionId)
        .order("photo_no", { ascending: true }),
      supabase.rpc("takeover_can_edit" as any, { _inspection_id: inspectionId }),
    ]);
    if (myGen !== gen.current) return;

    if (insRes.error || !insRes.data) {
      setLoadError("This inspection is not available to your account.");
      setLoading(false);
      return;
    }
    const rec = insRes.data as unknown as InspectionRecord;
    setInspection(rec);
    // Real server permission, not a guess from the status field.
    setCanEdit(editRes.error ? false : Boolean(editRes.data));

    if (ansRes.error) {
      // Never replace existing data with an empty map on a failed read.
      setLoadError(`Answers could not be loaded: ${ansRes.error.message}. Nothing has been changed — retry before editing.`);
      setLoading(false);
      return;
    }
    if (attRes.error) setLoadError(`Evidence could not be loaded: ${attRes.error.message}`);
    else setAttachments(((attRes.data as any[]) || []) as AttachmentRecord[]);

    const next: Record<string, Item> = {};
    ((ansRes.data as any[]) || []).forEach((r) => {
      next[answerKey(r.group_key, r.item_ref)] = {
        group: r.group_key,
        ref: r.item_ref,
        data: r.data || {},
        rev: 0,
        ackedRev: 0,
        version: r.version,
        updated_at: r.updated_at,
        sending: false,
        failed: false,
      };
    });

    // Restore every unsynced local draft for this account + inspection.
    conflictsRef.current = {};
    const drafts = await listDrafts(userId, inspectionId);
    if (myGen !== gen.current) return;
    if (!drafts.ok) setStorageError(drafts.error || "Local draft recovery is unavailable on this device.");
    else {
      setStorageError(null);
      for (const d of drafts.value || []) {
        const k = answerKey(d.group_key as GroupKey, d.item_ref);
        const server = next[k];
        const serverVersion = server?.version ?? 0;
        next[k] = {
          group: d.group_key as GroupKey,
          ref: d.item_ref,
          data: d.data as AnyAnswer,
          rev: 1,
          ackedRev: 0,
          version: serverVersion,
          updated_at: server?.updated_at,
          sending: false,
          failed: false,
        };
        // The server moved on while this draft was waiting — that is a conflict,
        // not a reason to drop the inspector's work.
        if ((d.expected_version ?? 0) !== serverVersion) {
          conflictsRef.current[k] = {
            group: d.group_key as GroupKey,
            ref: d.item_ref,
            serverData: (server?.data as AnyAnswer) || {},
            serverVersion,
            localData: d.data as AnyAnswer,
          };
        }
      }
    }

    items.current = next;
    publish();
    setLoading(false);
  }, [inspectionId, userId, publish]);

  useEffect(() => {
    gen.current += 1;
    clearTimers();
    items.current = {};
    conflictsRef.current = {};
    setAnswers({});
    setConflicts({});
    setItemStatus({});
    setSaveState("idle");
    if (isReady && userId && inspectionId) load();
    else if (isReady && !userId) setLoading(false);
    return () => {
      gen.current += 1;
      clearTimers();
    };
  }, [isReady, userId, inspectionId, load]);

  // ------------------------------------------------------------- persistence
  const persistDraft = useCallback(
    async (it: Item) => {
      if (!inspectionId || !userId) return;
      const res = await putDraft({
        key: outboxKey(userId, inspectionId, it.group, it.ref),
        user_id: userId,
        inspection_id: inspectionId,
        group_key: it.group,
        item_ref: it.ref,
        data: it.data as Record<string, unknown>,
        expected_version: it.version,
        updated_at: Date.now(),
      });
      if (!res.ok) setStorageError(res.error || "This device could not keep a local copy of your last entry.");
      else setStorageError(null);
    },
    [inspectionId, userId]
  );

  /** Serialised per item: loops until the latest revision is acknowledged. */
  const pushItem = useCallback(
    async (key: string) => {
      const myGen = gen.current;
      if (!inspectionId || !userId) return;
      const it = items.current[key];
      if (!it || it.sending) return;
      if (conflictsRef.current[key]) return; // wait for the inspector to resolve it

      it.sending = true;
      publish();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const cur = items.current[key];
          if (!cur || cur.rev === cur.ackedRev) break;
          const sentRev = cur.rev;
          const sentVersion = cur.version;
          const payload = cur.data;

          const { data: res, error } = await supabase.rpc("takeover_save_answer" as any, {
            p_inspection_id: inspectionId,
            p_group_key: cur.group,
            p_item_ref: cur.ref,
            p_data: payload as any,
            p_expected_version: sentVersion,
          });
          if (myGen !== gen.current) return; // account or record changed — discard

          const r = res as any;
          if (error) throw new Error(error.message);
          const live = items.current[key];
          if (!live) return;

          if (r?.conflict) {
            conflictsRef.current[key] = {
              group: live.group,
              ref: live.ref,
              serverData: (r.data || {}) as AnyAnswer,
              serverVersion: Number(r.version || 0),
              localData: live.data,
            };
            break;
          }
          if (r?.error) throw new Error(r.error);

          // Acknowledge ONLY the revision that was sent; never overwrite newer typing.
          live.version = Number(r.version);
          live.updated_at = r.updated_at;
          live.failed = false;
          if (live.ackedRev < sentRev) live.ackedRev = sentRev;
          if (live.rev === live.ackedRev) {
            await deleteDraft(outboxKey(userId, inspectionId, live.group, live.ref));
          }
        }
      } catch (e) {
        if (myGen !== gen.current) return;
        const live = items.current[key];
        if (live) live.failed = true;
      } finally {
        if (myGen === gen.current) {
          const live = items.current[key];
          if (live) live.sending = false;
          publish();
        }
      }
    },
    [inspectionId, userId, publish]
  );

  /** Local-first update: state changes instantly, only the network is debounced. */
  const updateAnswer = useCallback(
    (group: GroupKey, ref: string, patch: AnyAnswer) => {
      if (!inspectionId || !userId || !canEdit) return;
      const k = answerKey(group, ref);
      const cur =
        items.current[k] ||
        (items.current[k] = {
          group,
          ref,
          data: {},
          rev: 0,
          ackedRev: 0,
          version: 0,
          sending: false,
          failed: false,
        });
      cur.data = { ...cur.data, ...patch };
      cur.rev += 1;
      cur.failed = false;
      publish();

      // Local recovery copy is written immediately, before any success is shown.
      void persistDraft(cur);

      clearTimeout(timers.current[k]);
      timers.current[k] = setTimeout(() => {
        delete timers.current[k];
        void pushItem(k);
      }, DEBOUNCE_MS);
    },
    [inspectionId, userId, canEdit, publish, persistDraft, pushItem]
  );

  const pendingKeys = () =>
    Object.keys(items.current).filter((k) => {
      const it = items.current[k];
      return it.rev !== it.ackedRev || it.failed;
    });

  const retryNow = useCallback(async () => {
    clearTimers();
    const keys = pendingKeys();
    keys.forEach((k) => {
      const it = items.current[k];
      if (it) it.failed = false;
    });
    publish();
    await Promise.all(keys.map((k) => pushItem(k)));
  }, [pushItem, publish]);

  /** Flush everything and report honestly what is still not on the server. */
  const flush = useCallback(async () => {
    await retryNow();
    const stillPending = pendingKeys();
    return {
      pending: stillPending.length,
      conflicts: Object.keys(conflictsRef.current).length,
      answerCount: Object.values(items.current).filter((i) => i.version > 0).length,
      versionSum: Object.values(items.current).reduce((s, i) => s + (i.version || 0), 0),
    };
  }, [retryNow]);

  useEffect(() => {
    const onOnline = () => void retryNow();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retryNow]);

  // -------------------------------------------------------------- conflicts
  const resolveConflictKeepMine = useCallback(
    async (key: string) => {
      const c = conflictsRef.current[key];
      const it = items.current[key];
      if (!c || !it) return;
      delete conflictsRef.current[key];
      it.version = c.serverVersion;
      it.rev += 1;
      await persistDraft(it);
      publish();
      await pushItem(key);
    },
    [persistDraft, publish, pushItem]
  );

  const resolveConflictTakeServer = useCallback(
    async (key: string) => {
      const c = conflictsRef.current[key];
      const it = items.current[key];
      if (!c || !it) return;
      delete conflictsRef.current[key];
      it.data = c.serverData;
      it.version = c.serverVersion;
      it.ackedRev = it.rev;
      it.failed = false;
      if (userId && inspectionId) await deleteDraft(outboxKey(userId, inspectionId, it.group, it.ref));
      publish();
    },
    [userId, inspectionId, publish]
  );

  return {
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
    reload: load,
    reloadAttachments: loadAttachments,
    updateAnswer,
    retryNow,
    flush,
    resolveConflictKeepMine,
    resolveConflictTakeServer,
  };
}
