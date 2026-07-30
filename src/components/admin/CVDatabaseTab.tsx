import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { generateUniqueCvId } from "@/lib/cvId";


interface CVRow {
  user_id: string;
  path: string;
  size: number;
  uploaded_at: string;
  cv_uid?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  nationality?: string;
  whatsapp_number?: string;
  ship_name?: string;
  parsed?: any;
  source: "uploaded" | "built" | "both";
}

const parseMaybeJson = (value: any) => {
  if (!value) return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const asArray = (value: any) => {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed : [];
};

const text = (...values: any[]) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return "";
};

const getFullName = (row: CVRow) => text(`${row.first_name || ""} ${row.last_name || ""}`.trim(), row.email, "Unnamed crew");

const NAT_MAP: Record<string, string> = {
  indian: "IND", india: "IND", filipino: "PHI", philippines: "PHI", philippine: "PHI",
  indonesian: "IDN", indonesia: "IDN", romanian: "ROU", romania: "ROU",
  vietnamese: "VNM", vietnam: "VNM", vietnamesee: "VNM", chinese: "CHN", china: "CHN",
  bangladeshi: "BGD", bangladesh: "BGD", pakistani: "PAK", pakistan: "PAK",
  srilankan: "LKA", "sri lankan": "LKA", ukrainian: "UKR", ukraine: "UKR",
};

const codeNationality = (value: string) => {
  const key = text(value).toLowerCase();
  return NAT_MAP[key] || key.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "XXX";
};

const codeGender = (value: string) => {
  const key = text(value).toLowerCase();
  if (key.startsWith("m")) return "M";
  if (key.startsWith("f")) return "F";
  return "X";
};

const codeRank = (value: string) => {
  const rank = text(value);
  if (/eto\s*cadet/i.test(rank)) return "ETC";
  if (/deck\s*cadet|trainee\s*officer\s*\(deck\)/i.test(rank)) return "DCT";
  if (/engine\s*cadet|trainee\s*officer\s*\(engine\)/i.test(rank)) return "ECT";
  if (/master|captain/i.test(rank)) return "CAP";
  if (/chief\s*officer|chief mate|c\/?o\b/i.test(rank)) return "CO";
  if (/2nd\s*off|second\s*off/i.test(rank)) return "2OF";
  if (/3rd\s*off|third\s*off/i.test(rank)) return "3OF";
  if (/chief\s*eng|c\/?e\b/i.test(rank)) return "CE";
  if (/2nd\s*eng|second\s*eng|\b2e\b/i.test(rank)) return "2E";
  if (/3rd\s*eng|third\s*eng/i.test(rank)) return "3E";
  if (/4th\s*eng|fourth\s*eng/i.test(rank)) return "4E";
  if (/eto|electro/i.test(rank)) return "ETO";
  if (/trainee\s*os|ordinary\s*seaman|\bos\b/i.test(rank)) return "OS";
  if (/trainee\s*cook|cook/i.test(rank)) return "CK";
  if (/cadet/i.test(rank)) return "CDT";
  if (/trainee/i.test(rank)) return "TRN";
  return rank.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "XXX";
};

const hash5 = (seed: string) => {
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) + h) ^ seed.charCodeAt(i);
  return (Math.abs(h) >>> 0).toString(36).toUpperCase().padStart(5, "0").slice(-5);
};

const buildAdminCvUid = (opts: { nationality?: string; gender?: string; rank?: string; lastRank?: string; seed: string }) => {
  return `SM-${codeNationality(opts.nationality || "")}-${codeGender(opts.gender || "")}-${codeRank(opts.lastRank || opts.rank || "")}-${hash5(opts.seed)}`;
};

const fmtDate = (value: any) => {
  const dateText = text(value);
  if (!dateText) return "—";
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return dateText;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const addPdfSection = (pdf: any, title: string, y: number) => {
  pdf.setFillColor(13, 27, 42);
  pdf.rect(14, y, 182, 7, "F");
  pdf.setTextColor(212, 175, 55);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(title, 17, y + 5);
  return y + 11;
};

const ensurePage = (pdf: any, y: number) => {
  if (y < 280) return y;
  pdf.addPage();
  return 16;
};

const normalizeBuiltCV = (row: any) => {
  if (!row) return null;
  const medical = parseMaybeJson(row.medical) || {};
  const personal = medical?.personal || {};
  return {
    ...row,
    certificates: asArray(row.certificates),
    sea_service: asArray(row.sea_service),
    education: asArray(row.education),
    medical,
    personal,
    skills: medical?.skills || {},
    training: medical?.training || [],
    photo: medical?.photo || null,
    cv_uid: text(medical?.cv_uid, personal?.cvUid, personal?.cv_uid),
  };
};

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
        .select("id, first_name, last_name, email, role, rank, nationality, whatsapp_number, ship_name, crew_unique_id")
        .in("id", ids);

      const profByUser: Record<string, any> = {};
      (profiles || []).forEach((p: any) => (profByUser[p.id] = p));
      const parsedByUser: Record<string, any> = {};
      (parsedRows || []).forEach((r: any) => (parsedByUser[r.user_id] = normalizeBuiltCV(r)));

      const merged: CVRow[] = ids.map((uid) => {
        const file = filesByUser[uid];
        const parsed = parsedByUser[uid];
        const profile = profByUser[uid] || {};
        const personal = parsed?.personal || {};
        const latestSea = (parsed?.sea_service || []).find((s: any) => text(s.vesselName, s.vessel_name));
        const smartCvUid = buildAdminCvUid({
          nationality: text(personal.nationality, profile.nationality),
          gender: text(personal.gender, profile.gender),
          rank: text(personal.rank, personal.applyingFor, profile.rank, profile.role),
          lastRank: text(latestSea?.rankOnBoard, latestSea?.rank),
          seed: text(uid, personal.email, profile.email),
        });
        return {
          user_id: uid,
          path: file?.path || "",
          size: file?.size || 0,
          uploaded_at: file?.uploaded_at || parsed?.updated_at || "",
          cv_uid: text(parsed?.cv_uid, personal.cvUid, personal.cv_uid, smartCvUid, profile.crew_unique_id),
          ...profile,
          first_name: text(profile.first_name, personal.firstName, personal.first_name, personal.name?.split(" ")?.[0]),
          last_name: text(profile.last_name, personal.lastName, personal.last_name, personal.name?.split(" ")?.slice(1).join(" ")),
          email: text(profile.email, personal.email),
          role: text(profile.rank, personal.rank, personal.applyingFor, profile.role, latestSea?.rankOnBoard, latestSea?.rank),
          nationality: text(profile.nationality, personal.nationality),
          whatsapp_number: text(profile.whatsapp_number, personal.phone, personal.whatsapp),
          ship_name: text(profile.ship_name, personal.currentVessel, latestSea?.vesselName, latestSea?.vessel_name),
          parsed,
          source: file && parsed ? "both" : file ? "uploaded" : "built",
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

  const regenerateId = async (row: CVRow) => {
    const gender =
      row.parsed?.personal?.gender ||
      row.parsed?.medical?.personal?.gender ||
      (row.cv_uid?.endsWith("-F") ? "Female" : "Male");
    if (!window.confirm(`Regenerate CV ID for ${row.first_name || row.user_id}?`)) return;
    try {
      const fresh = await generateUniqueCvId({ nationality: row.nationality, gender });
      const { error } = await supabase
        .from("crew_profiles")
        .update({ crew_unique_id: fresh })
        .eq("id", row.user_id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, cv_uid: fresh } : r)));
      toast.success(`New CV ID: ${fresh}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not regenerate ID");
    }
  };

  const openCV = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("crew-cvs")
      .createSignedUrl(path, 3600);
    if (error || !data) return toast.error("Cannot open CV");
    window.open(data.signedUrl, "_blank");
  };


  const downloadBuiltCV = async (row: CVRow) => {
    if (!row.parsed) return toast.error("No built CV data available");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const parsed = row.parsed;
      const personal = parsed.personal || {};
      const sea = asArray(parsed.sea_service);
      const certs = asArray(parsed.certificates);
      const education = asArray(parsed.education);
      const training = asArray(parsed.training);
      const skills = parsed.skills || {};
      const name = getFullName(row);
      let y = 16;

      pdf.setFillColor(13, 27, 42);
      pdf.rect(0, 0, 210, 31, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(name.toUpperCase(), 14, 13, { maxWidth: 126 });
      pdf.setTextColor(212, 175, 55);
      pdf.setFontSize(10);
      pdf.text(text(row.role, personal.rank, "Rank not specified"), 14, 22, { maxWidth: 126 });
      pdf.setFillColor(212, 175, 55);
      pdf.roundedRect(146, 8, 50, 12, 2, 2, "F");
      pdf.setTextColor(13, 27, 42);
      pdf.setFontSize(8);
      pdf.text(text(row.cv_uid, "CV UID PENDING"), 171, 16, { align: "center" });
      y = 38;

      pdf.setTextColor(30, 30, 30);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const contactLines = [
        [`Nationality`, text(row.nationality, personal.nationality, "—")],
        [`Gender`, text(personal.gender, "—")],
        [`DOB`, fmtDate(personal.dob || personal.date_of_birth)],
        [`Passport`, text(personal.passportNo, personal.passport_no, "—")],
        [`CDC/SB`, text(personal.cdcNo, personal.cdc_no, "—")],
        [`WhatsApp`, text(row.whatsapp_number, personal.phone, personal.whatsapp, "—")],
        [`Email`, text(row.email, personal.email, "—")],
        [`Available`, fmtDate(personal.availableFrom)],
      ];
      contactLines.forEach(([label, value], index) => {
        const x = index % 2 === 0 ? 14 : 108;
        const lineY = y + Math.floor(index / 2) * 6;
        pdf.setFont("helvetica", "bold");
        pdf.text(`${label}:`, x, lineY);
        pdf.setFont("helvetica", "normal");
        pdf.text(value, x + 24, lineY, { maxWidth: 65 });
      });
      y += 30;

      if (text(personal.summary)) {
        y = addPdfSection(pdf, "PROFESSIONAL SUMMARY", y);
        pdf.setTextColor(35, 35, 35);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const lines = pdf.splitTextToSize(personal.summary, 178);
        pdf.text(lines, 14, y);
        y += lines.length * 5 + 5;
      }

      if (sea.some((s: any) => text(s.vesselName, s.vessel_name))) {
        y = ensurePage(pdf, addPdfSection(pdf, "SEA SERVICE", y));
        pdf.setFontSize(8);
        sea.filter((s: any) => text(s.vesselName, s.vessel_name)).forEach((s: any, index: number) => {
          y = ensurePage(pdf, y);
          pdf.setTextColor(13, 27, 42);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${index + 1}. ${text(s.vesselName, s.vessel_name)}`, 14, y);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(45, 45, 45);
          pdf.text([
            text(s.rankOnBoard, s.rank, row.role),
            text(s.vesselType, s.vessel_type),
            text(s.company),
            `${text(s.fromDate, s.sign_on)} - ${text(s.toDate, s.sign_off)}`,
          ].filter(Boolean).join(" | "), 18, y + 5, { maxWidth: 176 });
          y += 12;
        });
      } else if (/cadet|trainee/i.test(text(row.role, personal.rank))) {
        y = ensurePage(pdf, addPdfSection(pdf, "SEA SERVICE", y));
        pdf.setTextColor(70, 70, 70);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.text("New joiner / cadet profile — sea service not required yet.", 14, y);
        y += 10;
      }

      if (certs.some((c: any) => text(c.name))) {
        y = ensurePage(pdf, addPdfSection(pdf, "CERTIFICATES", y));
        pdf.setFontSize(8);
        certs.filter((c: any) => text(c.name)).forEach((c: any, index: number) => {
          y = ensurePage(pdf, y);
          pdf.setTextColor(13, 27, 42);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${index + 1}. ${text(c.name)}`, 14, y, { maxWidth: 86 });
          pdf.setTextColor(45, 45, 45);
          pdf.setFont("helvetica", "normal");
          pdf.text(`No: ${text(c.number, c.cert_no, "—")} | Exp: ${fmtDate(c.expiryDate || c.expiry_date)}`, 108, y, { maxWidth: 86 });
          y += 6;
        });
        y += 4;
      }

      if (education.some((e: any) => text(e.institution, e.qualification)) || training.some((t: any) => text(t.courseName))) {
        y = ensurePage(pdf, addPdfSection(pdf, "EDUCATION & TRAINING", y));
        pdf.setTextColor(45, 45, 45);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        [...education, ...training].forEach((item: any) => {
          y = ensurePage(pdf, y);
          pdf.text(`• ${text(item.qualification, item.courseName, item.institution)} ${text(item.institution) ? `— ${text(item.institution)}` : ""}`, 14, y, { maxWidth: 178 });
          y += 5;
        });
        y += 4;
      }

      if (text(skills.engineTypes, skills.cargoTypes, skills.computerSkills, skills.other)) {
        y = ensurePage(pdf, addPdfSection(pdf, "SKILLS", y));
        pdf.setTextColor(45, 45, 45);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        const skillText = [
          text(skills.engineTypes) && `Engine: ${text(skills.engineTypes)}`,
          text(skills.cargoTypes) && `Cargo: ${text(skills.cargoTypes)}`,
          Array.isArray(skills.ecdis) && skills.ecdis.length ? `ECDIS: ${skills.ecdis.join(", ")}` : "",
          text(skills.computerSkills) && `Computer: ${text(skills.computerSkills)}`,
          text(skills.other),
        ].filter(Boolean).join("\n");
        pdf.text(pdf.splitTextToSize(skillText, 178), 14, y);
      }

      pdf.setFontSize(7);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated from SeaMinds Admin CV Database • ${new Date().toLocaleString()}`, 14, 290);
      pdf.save(`SeaMinds-CV-${text(row.cv_uid, row.user_id).replace(/[^A-Za-z0-9-]/g, '')}-${name.replace(/\s+/g, '-')}.pdf`);
    } catch (e) {
      console.error("Admin CV PDF error:", e);
      toast.error("Could not generate CV PDF");
    }
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
  const readyForPdf = rows.filter((r) => r.parsed || r.path).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }}>
        <div style={card}>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Total CV records</div>
          <div style={{ color: "#D4AF37", fontSize: 26, fontWeight: 700 }}>{rows.length}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Built in Resume Builder</div>
          <div style={{ color: "#D4AF37", fontSize: 26, fontWeight: 700 }}>{withParsed}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>PDF files uploaded</div>
          <div style={{ color: "#D4AF37", fontSize: 26, fontWeight: 700 }}>{rows.filter((r) => r.path).length}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Ready to download</div>
          <div style={{ color: "#D4AF37", fontSize: 26, fontWeight: 700 }}>{readyForPdf}</div>
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
              <th style={th}>CV UID</th>
              <th style={th}>Rank</th>
              <th style={th}>Nationality</th>
              <th style={th}>WhatsApp</th>
              <th style={th}>Email</th>
              <th style={th}>Ship</th>
              <th style={th}>Uploaded</th>
              <th style={th}>Size</th>
              <th style={th}>Source</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.user_id}>
                <td style={td}>
                  {getFullName(r) || <span style={{ color: "#6b7280" }}>—</span>}
                </td>
                <td style={td}><span style={{ color: "#D4AF37", fontFamily: "monospace", fontWeight: 700 }}>{r.cv_uid || "—"}</span></td>
                <td style={td}>{r.role || "—"}</td>
                <td style={td}>{r.nationality || "—"}</td>
                <td style={td}>{r.whatsapp_number || "—"}</td>
                <td style={td}>{r.email || "—"}</td>
                <td style={td}>{r.ship_name || "—"}</td>
                <td style={td}>{r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : "—"}</td>
                <td style={td}>{r.size ? `${(r.size / 1024).toFixed(0)} KB` : "—"}</td>
                <td style={td}>
                  <span style={{ color: r.source === "built" ? "#10b981" : "#D4AF37", fontWeight: 600 }}>
                    {r.source === "both" ? "Built + PDF" : r.source === "built" ? "Built CV" : "PDF"}
                  </span>
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
                        onClick={() => downloadBuiltCV(r)}
                        style={{
                          padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                          background: "#D4AF37", color: "#0D1B2A",
                          border: "none", fontWeight: 600, fontSize: 12,
                        }}
                      >
                        Generate PDF
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

                    <button
                      onClick={() => regenerateId(r)}
                      title="Admin only — issue a new unique CV ID"
                      style={{
                        padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                        background: "transparent", color: "#94a3b8",
                        border: "1px solid #334155", fontWeight: 600, fontSize: 12,
                      }}
                    >
                      Regenerate ID
                    </button>
                  </div>

                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={11}>
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
