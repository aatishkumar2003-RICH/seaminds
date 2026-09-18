import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "takeover-evidence";
export const MAX_BYTES = 20 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export interface UploadArgs {
  inspectionId: string;
  file: File;
  caption?: string;
  groupKey?: string;
  itemRef?: string;
  sourceType: "camera" | "gallery" | "document";
}

/**
 * Uploads to the private evidence bucket first; the metadata row is written
 * only after the file lands. Online connection is required — evidence is
 * never queued locally and never reported as saved unless the server has it.
 */
export async function uploadEvidence({
  inspectionId,
  file,
  caption,
  groupKey,
  itemRef,
  sourceType,
}: UploadArgs): Promise<{ error?: string; id?: string }> {
  if (!ALLOWED_MIME.includes(file.type)) return { error: `Unsupported file type: ${file.type || "unknown"}` };
  if (file.size > MAX_BYTES) return { error: "File is larger than 20 MB" };
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return { error: "You are offline. Photo evidence needs a connection to upload." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${inspectionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const up = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (up.error) return { error: up.error.message };

  const ins = await supabase
    .from("takeover_attachments" as any)
    .insert({
      inspection_id: inspectionId,
      group_key: groupKey || null,
      item_ref: itemRef || null,
      storage_path: path,
      caption: caption || null,
      source_type: sourceType,
      mime_type: file.type,
      size_bytes: file.size,
    } as any)
    .select("id")
    .maybeSingle();

  if (ins.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `Upload could not be recorded: ${ins.error.message}` };
  }
  return { id: (ins.data as any)?.id };
}

export async function signedUrl(path: string, seconds = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
