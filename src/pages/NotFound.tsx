import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { ChevronLeft } from "lucide-react";

const NAVY = "#0D1B2A";
const CARD = "#112240";
const GOLD = "#D4AF37";
const BORDER = "rgba(212,175,55,0.3)";

interface NotFoundProps {
  title?: string;
  message?: string;
  links?: { href: string; label: string }[];
}

const DEFAULT_LINKS = [
  { href: "/feed", label: "Live maritime vacancies" },
  { href: "/", label: "SeaMinds home" },
  { href: "/for-companies", label: "For companies" },
];

const NotFound = ({ title, message, links }: NotFoundProps) => {
  useEffect(() => {
    document.title = title ? `${title} | SeaMinds` : "Page not found | SeaMinds";
  }, [title]);

  const list = links && links.length ? links : DEFAULT_LINKS;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "18px 16px 60px" }}>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#94A3B8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        <ChevronLeft size={16} /> SeaMinds Home
      </a>

      <div style={{ maxWidth: 560, margin: "56px auto 0", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 26, textAlign: "center" }}>
        <p style={{ fontSize: 34 }}>⚓</p>
        <h1 style={{ color: GOLD, fontSize: 22, fontWeight: 900, marginTop: 6 }}>{title || "Page not found"}</h1>
        <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
          {message || "This page is not on board. It may have been moved, or the link may be mistyped — the pages below are always live."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 20 }}>
          {list.map((l) => (
            <a key={l.href} href={l.href}
              style={{ display: "block", padding: "11px 14px", borderRadius: 11, background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
