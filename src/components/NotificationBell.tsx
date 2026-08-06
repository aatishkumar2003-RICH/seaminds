import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X } from "lucide-react";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";

interface Note {
  id: string; kind: string; title: string; body: string | null;
  icon: string | null; screen: string | null; read: boolean; created_at: string;
}

const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const NotificationBell = ({ profileId, onNavigate }: { profileId: string; onNavigate?: (s: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from("notifications" as any)
      .select("id, kind, title, body, icon, screen, read, created_at")
      .eq("crew_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotes((data as any[]) || []);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const unread = notes.filter((n) => !n.read).length;

  const openPanel = async () => {
    setOpen(true);
    await load();
  };

  const markAllRead = async () => {
    setNotes((ns) => ns.map((n) => ({ ...n, read: true })));
    try {
      await supabase.from("notifications" as any).update({ read: true }).eq("crew_id", profileId).eq("read", false);
    } catch { /* ignore */ }
  };

  const tap = async (n: Note) => {
    try { await supabase.from("notifications" as any).update({ read: true }).eq("id", n.id); } catch { /* ignore */ }
    setOpen(false);
    if (n.screen) onNavigate?.(n.screen);
  };

  return (
    <>
      <button onClick={openPanel} aria-label="Notifications" className="relative p-1.5" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
        <Bell size={20} style={{ color: GOLD }} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0, background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 999,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm overflow-y-auto"
            style={{ background: "#0D1B2A", borderLeft: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-4 py-3" style={{ background: "#0D1B2A", borderBottom: `1px solid ${BORDER}` }}>
              <h2 className="text-base font-bold" style={{ color: GOLD }}>Notifications</h2>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[11px] font-semibold" style={{ color: GOLD, background: "transparent", border: "none", cursor: "pointer" }}>
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                  <X size={18} style={{ color: "#94a3b8" }} />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2">
              {notes.length === 0 && (
                <p className="text-center text-sm py-10" style={{ color: "#64748b" }}>
                  Nothing yet. We'll tell you when a company views your CV or new jobs match your rank.
                </p>
              )}
              {notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => tap(n)}
                  className="w-full text-left rounded-2xl p-3 flex gap-3 items-start"
                  style={{
                    background: n.read ? CARD : "rgba(212,175,55,0.10)",
                    border: `1px solid ${n.read ? BORDER : "rgba(212,175,55,0.35)"}`,
                    cursor: "pointer",
                  }}
                >
                  <span className="text-lg shrink-0">{n.icon || "⚓"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-white leading-snug">{n.title}</p>
                    {n.body && <p className="text-[11px] mt-0.5" style={{ color: "#94a3b8" }}>{n.body}</p>}
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: "#64748b" }}>{timeAgo(n.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
