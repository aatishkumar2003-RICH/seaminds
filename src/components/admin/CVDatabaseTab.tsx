import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

interface CVRow {
  user_id: string;
  path: string;
  size: number;
  uploaded_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  nationality?: string;
  whatsapp_number?: string;
  ship_name?: string;
  parsed?: any;
}

const card: React.CSSProperties = {
  background: "#112240",
  border: "1px solid #1e3a5f",
  borderRadius: 12,
  padding: 16,
};

const th: React.CSSProperties = {
  color: "#D4AF37",
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  borderBottom: "1px solid #1e3a5f",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  color: "#e5e7eb",
  padding: "10px 12px",
  fontSize: 13,
  borderBottom: "1px solid #1e3a5f",
  verticalAlign: "top",
};

export default function CVDatabaseTab() {
  const [rows, setRows] = useState<CVRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CVRow | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) List all CV files from storage bucket (uploaded PDFs)
      const { data: files } = await supabase.storage
        .from("crew-cvs")
        .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

      const filesByUser: Record<string, { path: string; size: number; uploaded_at: string }> = {};
      for (const f of files || []) {
        if (f.id && f.metadata) {
          filesByUser[f.name] = {
            path: f.name,
            size: (f.metadata as any).size || 0,
            uploaded_at: (f as any).created_at || "",
          };
        } else {
          const uid = f.name;
          const { data: inner } = await supabase.storage
            .from("crew-cvs")
            .list(uid, { limit: 5, sortBy: { column: "created_at", order: "desc" } });
          const first = inner?.[0];
          if (first) {
            filesByUser[uid] = {
              path: `${uid}/${first.name}`,
              size: (first.metadata as any)?.size || 0,
              uploaded_at: (first as any).created_at || "",
            };
          }
        }
      }

      // 2) Fetch ALL parsed/built CV data (Resume Builder saves here)
      const { data: parsedRows } = await supabase
        .from("crew_cv_data")
        .select("*")
        .order("updated_at", { ascending: false });

      // 3) Union: every user that has either a stored PDF or a crew_cv_data row
      const allIds = new Set<string>([
        ...Object.keys(filesByUser),
        ...((parsedRows || []).map((r: any) => r.user_id)),
      ]);
      const ids = Array.from(allIds);
      if (ids.length === 0) { setRows([]); return; }

      // 4) Fetch matching crew profiles
      const { data: profiles } = await supabase
        .from("crew_profiles")
        .select("id, first_name, last_name, email, role, rank, nationality, whatsapp_number, ship_name")
        .in("id", ids);

      const profByUser: Record<string, any> = {};
      (profiles || []).forEach((p: any) => (profByUser[p.id] = p));
      const parsedByUser: Record<string, any> = {};
      (parsedRows || []).forEach((r: any) => (parsedByUser[r.user_id] = r));

      const merged: CVRow[] = ids.map((uid) => {
        const file = filesByUser[uid];
        const parsed = parsedByUser[uid];
        return {
          user_id: uid,
          path: file?.path || "",
          size: file?.size || 0,
          uploaded_at: file?.uploaded_at || parsed?.updated_at || "",
          ...(profByUser[uid] || {}),
          role: (profByUser[uid] as any)?.rank || (profByUser[uid] as any)?.role,
          parsed,
        };
      });

      merged.sort((a, b) => (b.uploaded_at || "").localeCompare(a.uploaded_at || ""));
      setRows(merged);
    } catch (e: any) {
      console.error("CV load error:", e);
      toast.error("Failed to load CVs");
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    load();
  }, [load]);

  const openCV = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("crew-cvs")
      .createSignedUrl(path, 3600);
    if (error || !data) return toast.error("Cannot open CV");
    window.open(data.signedUrl, "_blank");
  };

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [
      r.first_name, r.last_name, r.email, r.role, r.nationality,
      r.ship_name, r.whatsapp_number, r.user_id,
    ].some((v) => (v || "").toString().toLowerCase().includes(q));
  });

  const withParsed = rows.filter((r) => r.parsed).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }}>
        <div style={card}>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Total CVs uploaded</div>
          <div style={{ color: "#D4AF37", fontSize: 26, fontWeight: 700 }}>{rows.length}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Parsed by AI</div>
          <div style={{ color: "#D4AF37", fontSize: 26, fontWeight: 700 }}>{withParsed}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Awaiting parse</div>
          <div style={{ color: "#D4AF37", fontSize: 26, fontWeight: 700 }}>{rows.length - withParsed}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, rank, ship, WhatsApp…"
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 8,
            background: "#0D1B2A", color: "#fff",
            border: "1px solid #1e3a5f", fontSize: 14,
          }}
        />
        <button
          onClick={load}
          style={{
            padding: "10px 16px", borderRadius: 8, cursor: "pointer",
            background: "transparent", color: "#D4AF37",
            border: "1px solid #D4AF37", fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: 16, color: "#D4AF37", fontWeight: 700 }}>
          CV Database {loading ? "(Loading…)" : `(${filtered.length})`}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Rank</th>
              <th style={th}>Nationality</th>
              <th style={th}>WhatsApp</th>
              <th style={th}>Email</th>
              <th style={th}>Ship</th>
              <th style={th}>Uploaded</th>
              <th style={th}>Size</th>
              <th style={th}>AI Parsed</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.user_id}>
                <td style={td}>
                  {(r.first_name || "") + " " + (r.last_name || "") || <span style={{ color: "#6b7280" }}>—</span>}
                </td>
                <td style={td}>{r.role || "—"}</td>
                <td style={td}>{r.nationality || "—"}</td>
                <td style={td}>{r.whatsapp_number || "—"}</td>
                <td style={td}>{r.email || "—"}</td>
                <td style={td}>{r.ship_name || "—"}</td>
                <td style={td}>{r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : "—"}</td>
                <td style={td}>{r.size ? `${(r.size / 1024).toFixed(0)} KB` : "—"}</td>
                <td style={td}>
                  {r.parsed ? (
                    <span style={{ color: "#10b981", fontWeight: 600 }}>Yes</span>
                  ) : (
                    <span style={{ color: "#f59e0b" }}>No</span>
                  )}
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    {r.path && (
                      <button
                        onClick={() => openCV(r.path)}
                        style={{
                          padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                          background: "#D4AF37", color: "#0D1B2A",
                          border: "none", fontWeight: 600, fontSize: 12,
                        }}
                      >
                        View PDF
                      </button>
                    )}

                    {r.parsed && (
                      <button
                        onClick={() => setSelected(r)}
                        style={{
                          padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                          background: "transparent", color: "#D4AF37",
                          border: "1px solid #D4AF37", fontWeight: 600, fontSize: 12,
                        }}
                      >
                        Data
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={10}>
                  <div style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                    No CVs found.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for parsed data */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0D1B2A", border: "1px solid #D4AF37", borderRadius: 12,
              padding: 20, maxWidth: 800, width: "100%", maxHeight: "85vh", overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ color: "#D4AF37", fontWeight: 700, fontSize: 18 }}>
                Parsed CV — {selected.first_name} {selected.last_name}
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: "transparent", color: "#D4AF37", border: "none", cursor: "pointer", fontSize: 20 }}
              >
                ✕
              </button>
            </div>
            <pre
              style={{
                background: "#112240", color: "#e5e7eb", padding: 12, borderRadius: 8,
                fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}
            >
{JSON.stringify(selected.parsed, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
