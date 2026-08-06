import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { trackPixel } from "@/lib/metaPixel";

const GOLD = "#D4AF37";

interface Props {
  /** The text shared, without the link. */
  text: string;
  /** Where the share should send people. Defaults to the ad landing page. */
  url?: string;
  label?: string;
  compact?: boolean;
}

const ShareResult = ({ text, url = "https://seaminds.life/join", label = "Share", compact = false }: Props) => {
  const [copied, setCopied] = useState(false);
  const full = `${text}\n\n${url}`;

  const share = async () => {
    trackPixel("Share", { content_name: "result_share" });
    try {
      if (navigator.share) {
        await navigator.share({ title: "SeaMinds", text, url });
        return;
      }
    } catch { /* user cancelled — fall through to copy */ }
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const whatsapp = () => {
    trackPixel("Share", { content_name: "result_share_whatsapp" });
    window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, "_blank");
  };

  return (
    <div className={compact ? "flex gap-2" : "flex gap-2 mt-3"}>
      <button
        onClick={whatsapp}
        className="flex-1 rounded-xl py-2.5 font-bold text-[13px] flex items-center justify-center gap-2"
        style={{ background: "#25D366", color: "#fff", border: "none", cursor: "pointer" }}
      >
        Share on WhatsApp
      </button>
      <button
        onClick={share}
        aria-label={label}
        className="rounded-xl px-4 py-2.5 font-bold text-[13px] flex items-center justify-center gap-2"
        style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, cursor: "pointer" }}
      >
        {copied ? <Check size={15} /> : <Share2 size={15} />}
      </button>
    </div>
  );
};

export default ShareResult;
