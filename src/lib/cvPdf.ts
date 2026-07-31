/** Shared SeaMinds CV → PDF generator (navy #0D1B2A / gold #D4AF37). */

const parseMaybeJson = (value: any) => {
  if (!value) return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const asArray = (value: any) => {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed : [];
};

export const text = (...values: any[]) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return "";
};

const fmtDate = (value: any) => {
  const dateText = text(value);
  if (!dateText) return "—";
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return dateText;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const addSection = (pdf: any, title: string, y: number) => {
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

export interface CvPdfInput {
  name: string;
  cvUid?: string;
  rank?: string;
  nationality?: string;
  email?: string;
  whatsapp?: string;
  /** raw crew_cv_data row (medical may be object or string) */
  cv: any;
  footer?: string;
}

export async function generateCvPdf(input: CvPdfInput) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const cv = input.cv || {};
  const medical = parseMaybeJson(cv.medical) || {};
  const personal = medical.personal || {};
  const skills = medical.skills || {};
  const training = asArray(medical.training);
  const sea = asArray(cv.sea_service);
  const certs = asArray(cv.certificates);
  const education = asArray(cv.education);
  const photoData: string | null = medical.photo || null;
  const name = text(input.name, personal.name, "Unnamed crew");
  const rank = text(input.rank, personal.rank, personal.applyingFor, "Rank not specified");
  const cvUid = text(input.cvUid, medical.cv_uid, personal.cvUid, "CV UID PENDING");

  let y = 16;
  pdf.setFillColor(13, 27, 42);
  pdf.rect(0, 0, 210, 31, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(name.toUpperCase(), 14, 13, { maxWidth: 126 });
  pdf.setTextColor(212, 175, 55);
  pdf.setFontSize(10);
  pdf.text(rank, 14, 22, { maxWidth: 126 });
  pdf.setFillColor(212, 175, 55);
  pdf.roundedRect(146, 8, 50, 12, 2, 2, "F");
  pdf.setTextColor(13, 27, 42);
  pdf.setFontSize(8);
  pdf.text(cvUid, 171, 16, { align: "center" });
  y = 38;

  const hasPhoto = !!(photoData && typeof photoData === "string" && photoData.startsWith("data:image"));
  if (hasPhoto) {
    try {
      const fmt = photoData!.includes("image/png") ? "PNG" : "JPEG";
      pdf.setDrawColor(212, 175, 55);
      pdf.rect(163, 36, 26, 32);
      pdf.addImage(photoData!, fmt, 163, 36, 26, 32, undefined, "FAST");
    } catch (err) {
      console.warn("CV photo could not be embedded:", err);
    }
  }

  pdf.setTextColor(30, 30, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const contactLines: [string, string][] = [
    ["Nationality", text(input.nationality, personal.nationality, "—")],
    ["Gender", text(personal.gender, "—")],
    ["DOB", fmtDate(personal.dob || personal.date_of_birth)],
    ["Passport", text(personal.passportNo, personal.passport_no, "—")],
    ["CDC/SB", text(personal.cdcNo, personal.cdc_no, "—")],
    ["WhatsApp", text(input.whatsapp, personal.phone, personal.whatsapp, "—")],
    ["Email", text(input.email, personal.email, "—")],
    ["Available", fmtDate(personal.availableFrom)],
  ];
  contactLines.forEach(([label, value], index) => {
    const isRight = index % 2 === 1;
    const x = isRight ? 100 : 14;
    const lineY = y + Math.floor(index / 2) * 6;
    pdf.setFont("helvetica", "bold");
    pdf.text(`${label}:`, x, lineY);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, x + 24, lineY, { maxWidth: isRight && hasPhoto ? 38 : 65 });
  });
  y += 30;

  if (text(personal.summary)) {
    y = addSection(pdf, "PROFESSIONAL SUMMARY", y);
    pdf.setTextColor(35, 35, 35);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(personal.summary, 178);
    pdf.text(lines, 14, y);
    y += lines.length * 5 + 5;
  }

  if (sea.some((s: any) => text(s.vesselName, s.vessel_name))) {
    y = ensurePage(pdf, addSection(pdf, "SEA SERVICE", y));
    pdf.setFontSize(8);
    sea.filter((s: any) => text(s.vesselName, s.vessel_name)).forEach((s: any, index: number) => {
      y = ensurePage(pdf, y);
      pdf.setTextColor(13, 27, 42);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${index + 1}. ${text(s.vesselName, s.vessel_name)}`, 14, y);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(45, 45, 45);
      pdf.text([
        text(s.rankOnBoard, s.rank, rank),
        text(s.vesselType, s.vessel_type),
        text(s.company),
        `${text(s.fromDate, s.sign_on)} - ${text(s.toDate, s.sign_off)}`,
      ].filter(Boolean).join(" | "), 18, y + 5, { maxWidth: 176 });
      y += 12;
    });
  } else if (/cadet|trainee/i.test(rank)) {
    y = ensurePage(pdf, addSection(pdf, "SEA SERVICE", y));
    pdf.setTextColor(70, 70, 70);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.text("New joiner / cadet profile — sea service not required yet.", 14, y);
    y += 10;
  }

  if (certs.some((c: any) => text(c.name))) {
    y = ensurePage(pdf, addSection(pdf, "CERTIFICATES", y));
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
    y = ensurePage(pdf, addSection(pdf, "EDUCATION & TRAINING", y));
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
    y = ensurePage(pdf, addSection(pdf, "SKILLS", y));
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
  pdf.text(input.footer || `SeaMinds CV • ${new Date().toLocaleString()}`, 14, 290);
  pdf.save(`SeaMinds-CV-${cvUid.replace(/[^A-Za-z0-9-]/g, "")}-${name.replace(/\s+/g, "-")}.pdf`);
}
