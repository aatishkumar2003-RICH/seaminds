/**
 * Account + inspection scoped local draft recovery (IndexedDB).
 * Holds unsynced answer text so keystrokes survive reloads and slow networks.
 * This is a local recovery buffer only — it is NOT an audited offline
 * ship-shore system, and photos are never queued here.
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
  expected_version: number | null;
  updated_at: number;
}

const supported = () => typeof indexedDB !== "undefined";

function open(): Promise<IDBDatabase | null> {
  if (!supported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const outboxKey = (userId: string, inspectionId: string, group: string, ref: string) =>
  `${userId}|${inspectionId}|${group}|${ref}`;

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const store = db.transaction(STORE, mode).objectStore(STORE);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const putDraft = (entry: OutboxEntry) => tx<void>("readwrite", (s) => s.put(entry));
export const deleteDraft = (key: string) => tx<void>("readwrite", (s) => s.delete(key));

export async function listDrafts(userId: string, inspectionId: string): Promise<OutboxEntry[]> {
  const all = (await tx<OutboxEntry[]>("readonly", (s) => s.getAll())) || [];
  return all.filter((e) => e.user_id === userId && e.inspection_id === inspectionId);
}

export const outboxSupported = supported;
