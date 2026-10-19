import { useEffect, useState } from "react";

/** Generates a QR code locally (no external image host) so screens and PDFs never show a blank box. */
export const useQrDataUrl = (text: string, opts: { dark?: string; light?: string } = {}) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(text, { margin: 1, width: 320, color: { dark: opts.dark || "#000000", light: opts.light || "#ffffff" } }))
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => {});
    return () => { alive = false; };
  }, [text, opts.dark, opts.light]);
  return url;
};
