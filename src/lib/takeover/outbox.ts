/**
 * Account + inspection scoped local draft recovery (IndexedDB).
 * Holds unsynced answer text so keystrokes survive reloads and slow networks.
 * This is a local recovery buffer only — it is NOT an audited offline
 * ship-shore system, and photos are never queued here.
 *
 * Every operation resolves only when the IndexedDB transaction has actually
 * completed, and storage failures are returned, never swallowed as success.
 */

const DB_NAME = "seaminds-takeover";
const STORE = "outbox";
const VERSION = 1;

export interface OutboxEntry {
  key: string; // userId|inspectionId|group|ref
  user_id: string;
  inspection_id: string;
  group_key: string;
  item_ref: string;
  data: Record<string, unknown>;
  /** Server version this draft was based on. */
  expected_version: number | null;
  updated_at: number;
}

export interface StorageResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

const supported = () => typeof indexedDB !== "undefined";
export const outboxSupported = supported;

export const outboxKey = (userId: string, inspectionId: string, group: string, ref: string) =>
  `${userId}|${inspectionId}|${group}|${ref}`;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!supported()) return reject(new Error("Local draft storage is not available in this browser"));
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
    } catch (e) {
      return reject(e instanceof Error ? e : new Error("Local draft storage could not be opened"));
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Local draft storage could not be opened"));
    req.onblocked = () => reject(new Error("Local draft storage is blocked by another open tab"));
  });
}

/** Resolves only after the whole transaction commits. */
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<StorageResult<T>> {
  let db: IDBDatabase;
  try {
    db = await open();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      const req = fn(store);
      let value: T | undefined;
      req.onsuccess = () => {
        value = req.result as T;
      };
      transaction.oncomplete = () => resolve({ ok: true, value });
      transaction.onerror = () =>
        resolve({ ok: false, error: transaction.error?.message || "Local draft could not be written" });
      transaction.onabort = () =>
        resolve({ ok: false, error: transaction.error?.message || "Local draft write was aborted" });
    } catch (e) {
      resolve({ ok: false, error: (e as Error).message });
    }
  });
}

export const putDraft = (entry: OutboxEntry) => tx<void>("readwrite", (s) => s.put(entry));
export const deleteDraft = (key: string) => tx<void>("readwrite", (s) => s.delete(key));

/** Drafts are strictly scoped to one account and one inspection. */
export async function listDrafts(userId: string, inspectionId: string): Promise<StorageResult<OutboxEntry[]>> {
  const res = await tx<OutboxEntry[]>("readonly", (s) => s.getAll());
  if (!res.ok) return { ok: false, error: res.error };
  const all = res.value || [];
  return { ok: true, value: all.filter((e) => e.user_id === userId && e.inspection_id === inspectionId) };
}
