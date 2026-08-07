import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";

interface Post {
  id: string;
  company_name: string;
  post_type: string;
  caption: string;
  image_url: string | null;
  whatsapp: string | null;
  link_url: string | null;
  status: string;
  verified: boolean;
  reports: number;
  views: number;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  hiring: "🚢 Hiring", update: "📢 Update", fleet: "⚓ Fleet",
  training: "🎓 Training", welfare: "🤝 Welfare",
};

const CompanyPostsTab = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "live" | "hidden">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company_posts" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setPosts(((data as any[]) || []) as Post[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (p: Post, status: string) => {
    setBusy(p.id);
    const { error } = await supabase.from("company_posts" as any).update({ status }).eq("id", p.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "live" ? "Post is live again." : "Post hidden from the feed.");
    load();
  };

  const toggleVerified = async (p: Post) => {
    setBusy(p.id);
    const { error } = await supabase.from("company_posts" as any).update({ verified: !p.verified }).eq("id", p.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(!p.verified ? "Marked as verified company." : "Verified badge removed.");
    load();
  };

  const remove = async (p: Post) => {
    if (!window.confirm(`Delete this post from ${p.company_name}?\n\nThis cannot be undone.`)) return;
    setBusy(p.id);
    const { error } = await supabase.from("company_posts" as any).delete().eq("id", p.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Post deleted.");
    load();
  };

  const shown = posts.filter((p) =>
    filter === "all" ? true : filter === "live" ? p.status === "live" : p.status !== "live"
  );

  const btn = (bg: string, color: string, border: string): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
    fontWeight: 600, background: bg, color, border,
  });

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h2 style={{ color: GOLD, fontSize: 16, fontWeight: 800 }}>Company Posts</h2>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>
          {posts.filter((p) => p.status === "live").length} live · {posts.length} total
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {(["all", "live", "hidden"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                background: filter === f ? GOLD : "transparent",
                color: filter === f ? "#0D1B2A" : GOLD,
                border: `1px solid ${GOLD}`,
              }}>
              {f === "all" ? "All" : f === "live" ? "Live" : "Hidden"}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>}
      {!loading && shown.length === 0 && (
        <p style={{ color: "#64748b", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
          No company posts yet.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shown.map((p) => (
          <div key={p.id} style={{
            background: CARD, border: `1px solid ${p.reports > 0 ? "#ef4444" : BORDER}`,
            borderRadius: 14, padding: 14, opacity: p.status === "live" ? 1 : 0.6,
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              {p.image_url && (
                <img src={p.image_url} alt="" style={{ width: 74, height: 74, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: GOLD, fontWeight: 800, fontSize: 13 }}>{p.company_name}</span>
                  {p.verified && <span style={{ color: "#22c55e", fontSize: 11 }}>✅ verified</span>}
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>{TYPE_LABEL[p.post_type] || p.post_type}</span>
                  {p.status !== "live" && <span style={{ color: "#f59e0b", fontSize: 11 }}>hidden</span>}
                  {p.reports > 0 && <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>⚠ {p.reports} reports</span>}
                  <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 10 }}>
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ color: "#cbd5e1", fontSize: 12.5, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {p.caption.length > 260 ? `${p.caption.slice(0, 260)}…` : p.caption}
                </p>
                {p.whatsapp && <p style={{ color: "#64748b", fontSize: 11, marginTop: 5 }}>📲 {p.whatsapp}</p>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {p.status === "live" ? (
                <button disabled={busy === p.id} onClick={() => setStatus(p, "hidden")}
                  style={btn("transparent", "#f59e0b", "1px solid rgba(245,158,11,0.5)")}>
                  Hide from feed
                </button>
              ) : (
                <button disabled={busy === p.id} onClick={() => setStatus(p, "live")}
                  style={btn("transparent", "#22c55e", "1px solid rgba(34,197,94,0.5)")}>
                  Publish again
                </button>
              )}
              <button disabled={busy === p.id} onClick={() => toggleVerified(p)}
                style={btn("transparent", GOLD, `1px solid ${GOLD}`)}>
                {p.verified ? "Remove verified" : "Mark verified"}
              </button>
              <button disabled={busy === p.id} onClick={() => remove(p)}
                style={btn("transparent", "#ef4444", "1px solid rgba(239,68,68,0.5)")}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompanyPostsTab;
