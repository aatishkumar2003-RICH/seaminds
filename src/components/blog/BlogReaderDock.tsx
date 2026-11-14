import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * SEO-safe reader prompt: the full article always stays on the page for Google.
 * The dock appears only for signed-out readers after real engagement
 * (40% scroll AND 12s reading), never on load, never covers the article,
 * and stays dismissed for 3 days once closed.
 */
const DISMISS_KEY = "sm_blog_dock_dismissed_at";
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

const BlogReaderDock = ({ slug }: { slug: string }) => {
  const { user, isReady } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isReady || user) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (at && Date.now() - at < COOLDOWN_MS) return;
    } catch { /* ignore */ }
    let scrolled = false, timed = false;
    const tryShow = () => { if (scrolled && timed) setShow(true); };
    const timer = window.setTimeout(() => { timed = true; tryShow(); }, 12000);
    const onScroll = () => {
      const h = document.documentElement;
      const depth = (h.scrollTop + window.innerHeight) / Math.max(h.scrollHeight, 1);
      if (depth >= 0.4) { scrolled = true; tryShow(); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
  }, [isReady, user]);

  if (!show || user) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  };
  const next = encodeURIComponent(`/blog/${slug}`);

  return (
    <div role="dialog" aria-label="Join SeaMinds free"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 animate-in slide-in-from-bottom duration-500"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <div className="relative mx-auto max-w-xl rounded-2xl p-4 shadow-2xl"
        style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}>
        <button onClick={dismiss} aria-label="Close"
          className="absolute right-2 top-2 rounded-full p-1.5" style={{ color: "#94A3B8" }}>
          <X className="h-4 w-4" />
        </button>
        <p className="pr-6 text-sm font-bold" style={{ color: "#D4AF37" }}>⚓ Enjoying this maritime report?</p>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: "#CBD5E1" }}>
          Join free for daily maritime news, job alerts and certificate expiry reminders.
        </p>
        <div className="mt-3 flex gap-2">
          <Link to={`/join?next=${next}`}
            className="flex-1 rounded-xl py-2.5 text-center text-sm font-bold"
            style={{ background: "#D4AF37", color: "#0D1B2A" }}>
            Join free
          </Link>
          <Link to={`/join?next=${next}`}
            className="flex-1 rounded-xl py-2.5 text-center text-sm font-bold"
            style={{ background: "transparent", color: "#D4AF37", border: "1px solid #D4AF37" }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BlogReaderDock;
