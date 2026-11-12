// Zalo has no public "prefilled text" link. We always copy the full message first (Zalo often drops
// shared text), then open the phone share sheet with the link attached, or Zalo on desktop.
import { toast } from "sonner";

/** Vietnamese numbers become 0xxxxxxxxx (Zalo's chat link format); others keep full digits. */
export const zaloChatUrl = (phone?: string | null) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length >= 11) d = "0" + d.slice(2);
  return d ? `https://zalo.me/${d}` : "https://chat.zalo.me/";
};

const copyText = async (text: string) => {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
};

export async function shareZalo(text: string, phone?: string | null) {
  const copied = await copyText(text);
  if (copied) toast.success("📋 Message copied — paste it into your Zalo chat or group");
  else toast.error("Could not copy. Long-press to copy manually.");
  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (!phone && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share(url ? { title: "SeaMinds", text, url } : { text }); return; }
    catch (e) { if ((e as Error)?.name === "AbortError") return; }
  }
  const win = window.open(zaloChatUrl(phone), "_blank");
  if (!win) toast.message("Open Zalo and paste the message");
}
