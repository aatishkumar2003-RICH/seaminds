import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";

interface Post {
  id: string;
  caption: string;
  post_type: string;
  image_url: string | null;
  status: string;
  views: number;
  interested_count: number;
  created_at: string;
}

interface Lead {
  crew_id: string;
  first_name: string | null;
  rank: string | null;
  nationality: string | null;
  whatsapp: string | null;
  since: string;
}

const MyPostsPanel = ({ managerId }: { managerId: string }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!managerId) return;
    const { data } = await supabase
      .from("company_posts" as any)
      .select("id, caption, post_type, image_url, status, views, interested_count, created_at")
      .eq("manager_id", managerId)
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts(((data as any[]) || []) as Post[]);
    setLoading(false);
  }, [managerId]);

  useEffect(() => { load(); }, [load]);

  const showLeads = async (postId: string) => {
    if (open === postId) { setOpen(null); return; }
    setOpen(postId);
    if (leads[postId]) return;
    const { data } = await supabase.rpc("get_interested_crew" as any, { p_post_id: postId });
    setLeads((s) => ({ ...s, [postId]: ((data as any[]) || []) as Lead[] }));
  };

  if (loading) return null;
  if (posts.length === 0) return null;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginTop: 16 }}>
      <h3 style={{ color: GOLD, fontSize: 14, fontWeight: 800, marginBottom: 12 }}>My Posts</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {posts.map((p) => (
          <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {p.image_url && (
                <img src={p.image_url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.45 }}>
                  {p.caption.length > 110 ? `${p.caption.slice(0, 110)}…` : p.caption}
                </p>
                <div style={{ display: "flex", gap: 14, marginTop: 7, flexWrap: "wrap" }}>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>👁 {p.views || 0} views</span>
                  <span style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>⚓ {p.interested_count || 0} interested</span>
                  {p.status !== "live" && <span style={{ color: "#f59e0b", fontSize: 11 }}>hidden</span>}
                  <span style={{ color: "#64748b", fontSize: 10, marginLeft: "auto" }}>
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {(p.interested_count || 0) > 0 && (
              <button
                onClick={() => showLeads(p.id)}
                style={{
                  marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 9,
                  background: open === p.id ? "rgba(212,175,55,0.15)" : "transparent",
                  color: GOLD, border: `1px solid ${GOLD}`, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {open === p.id ? "Hide interested crew" : `See ${p.interested_count} interested seafarer${p.interested_count === 1 ? "" : "s"}`}
              </button>
            )}

            {open === p.id && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(leads[p.id] || []).length === 0 && (
                  <p style={{ color: "#64748b", fontSize: 11.5 }}>Loading…</p>
                )}
                {(leads[p.id] || []).map((l) => (
                  <div key={l.crew_id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 9, padding: "9px 11px" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
                        {l.first_name || "Seafarer"}{l.rank ? ` · ${l.rank}` : ""}
                      </p>
                      <p style={{ color: "#94a3b8", fontSize: 10.5 }}>
                        {l.nationality || "—"} · {new Date(l.since).toLocaleDateString()}
                      </p>
                    </div>
                    {l.whatsapp && (
                      <a
                        href={`https://wa.me/${String(l.whatsapp).replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flexShrink: 0, background: "#25D366", color: "#fff", borderRadius: 8,
                          padding: "7px 12px", fontSize: 11.5, fontWeight: 700, textDecoration: "none",
                        }}
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ color: "#64748b", fontSize: 10.5, marginTop: 12, lineHeight: 1.5 }}>
        Seafarers who tap "I'm Interested" appear here. Contact them directly — SeaMinds never charges seafarers a fee.
      </p>
    </div>
  );
};

export default MyPostsPanel;
