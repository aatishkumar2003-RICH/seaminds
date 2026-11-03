export const DISPATCH_CATEGORIES = [
  { id: "engine", label: "Engine Overhaul", emoji: "⚙️" },
  { id: "bridge", label: "Bridge & Navigation", emoji: "🧭" },
  { id: "cargo", label: "Cargo Ops", emoji: "📦" },
  { id: "life_at_sea", label: "Life at Sea", emoji: "🌊" },
  { id: "port_call", label: "Port Call", emoji: "⚓" },
  { id: "cadet_prep", label: "Cadet Prep", emoji: "🎓" },
] as const;

export type DispatchCategory = (typeof DISPATCH_CATEGORIES)[number]["id"];

/** Accepts only https YouTube / youtu.be links (matches the database check). */
export function normalizeYoutubeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  return /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(v) ? v : null;
}

/** Shrinks a photo to max 1600px WebP to save crew mobile data. */
export async function compressPhoto(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Compression failed"))), "image/webp", 0.8),
  );
}
