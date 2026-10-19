import { supabase } from "@/integrations/supabase/client";

export const VESSEL_TYPES = ["Tanker", "Bulk Carrier", "Container", "Gas Carrier", "General Cargo", "Offshore / Tug", "Other"] as const;
export const MAX_PHOTOS = 8;

export const MARKETPLACE_NOTICE =
  "SeaMinds is a connection platform only. We are not a ship broker, surveyor, escrow agent or party to any sale. All vessel details, photos and prices are supplied by the seller and are not verified by SeaMinds. Buyers must carry out their own physical inspection, class, title, sanctions and legal checks, and agree terms (MOA) directly with the seller. SeaMinds accepts no liability for any listing, transaction, loss or dispute.";

/** Resize + convert an image to WebP (max 1920px, q≈0.82) to keep uploads small on ship connections. */
export async function compressPhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("compress failed"))), "image/webp", 0.82));
}

export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("ship-listings").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}
