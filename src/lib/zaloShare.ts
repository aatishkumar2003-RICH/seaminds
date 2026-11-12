// Zalo has no public "prefilled text" link. Phones: open the system share sheet (Zalo appears there).
// Desktop: copy the message, then open Zalo (a specific chat when we have the number) so the manager pastes it.
import { toast } from "sonner";

/** Vietnamese numbers become 0xxxxxxxxx (Zalo's chat link format); others keep full digits. */
export const zaloChatUrl = (phone?: string | null) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length >= 11) d = "0" + d.slice(2);
  return d ? `https://zalo.me/${d}` : "https://chat.zalo.me/";
};

export async function shareZalo(text: string, phone?: string | null) {
  if (!phone && typeof navigator !== "undefined" && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ text }); return; } catch (e) { if ((e as Error)?.name === "AbortError") return; }
  }
  const win = window.open(zaloChatUrl(phone), "_blank");
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Message copied — paste it in Zalo");
  } catch { toast.error("Could not copy. Long-press to copy manually."); }
  if (!win) toast.message("Open Zalo and paste the message");
}
