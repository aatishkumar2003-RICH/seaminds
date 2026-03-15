import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Gold colour in RGB 0-1
const GOLD = rgb(212 / 255, 175 / 255, 55 / 255);
const DARK_BG = rgb(15 / 255, 23 / 255, 42 / 255);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.7, 0.7, 0.7);
const MID_GRAY = rgb(0.45, 0.45, 0.45);
const BAR_BG = rgb(0.2, 0.2, 0.25);

interface CertData {
  crewName: string;
  rank: string;
  vesselType: string;
  overallScore: number;
  subScores: { name: string; score: number }[];
  certificateId: string;
  assessmentDate: string;
  expiryDate: string;
  scoreBand: string;
}

function getScoreBand(score: number) {
  if (score >= 4.5) return { stars: "★★★★★", label: "ELITE" };
  if (score >= 4.0) return { stars: "★★★★", label: "EXPERT" };
  if (score >= 3.5) return { stars: "★★★", label: "COMPETENT+" };
  if (score >= 3.0) return { stars: "★★★", label: "COMPETENT" };
  if (score >= 2.0) return { stars: "★★", label: "DEVELOPING" };
  return { stars: "★", label: "FOUNDATION" };
}

function getBandInterpretation(label: string): string {
  const map: Record<string, string> = {
    ELITE: "Top 5% of assessed seafarers globally",
    EXPERT: "Top 20% of assessed seafarers globally",
    "COMPETENT+": "Above average competency",
    COMPETENT: "Meets industry standard",
    DEVELOPING: "Building competency",
    FOUNDATION: "Early career",
  };
  return map[label] || "";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CertData = await req.json();
    const band = getScoreBand(data.overallScore);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // --- Background ---
    page.drawRectangle({ x: 0, y: 0, width, height, color: DARK_BG });

    // --- Gold border ---
    const bw = 2;
    const m = 30;
    page.drawRectangle({ x: m, y: m, width: width - 2 * m, height: height - 2 * m, borderColor: GOLD, borderWidth: bw, color: DARK_BG });

    // --- Inner decorative border ---
    const m2 = 38;
    page.drawRectangle({ x: m2, y: m2, width: width - 2 * m2, height: height - 2 * m2, borderColor: rgb(212 / 255, 175 / 255, 55 / 255), borderWidth: 0.5 });

    let y = height - 80;

    // --- Shield icon (drawn as a simple shape) ---
    const shieldX = width / 2;
    const shieldY = y;
    // Draw a gold circle as shield placeholder
    page.drawCircle({ x: shieldX, y: shieldY, size: 22, color: GOLD });
    // Draw a smaller inner shape
    page.drawCircle({ x: shieldX, y: shieldY, size: 14, color: DARK_BG });
    page.drawCircle({ x: shieldX, y: shieldY, size: 10, color: GOLD });

    y -= 45;

    // --- "SEAMINDS CERTIFIED SCORE" ---
    const certTitle = "SEAMINDS CERTIFIED SCORE";
    const ctWidth = boldFont.widthOfTextAtSize(certTitle, 10);
    page.drawText(certTitle, {
      x: (width - ctWidth) / 2,
      y,
      size: 10,
      font: boldFont,
      color: GOLD,
    });

    y -= 80;

    // --- Large score number ---
    const scoreText = data.overallScore.toFixed(2);
    const scoreSize = 72;
    const scoreWidth = boldFont.widthOfTextAtSize(scoreText, scoreSize);
    page.drawText(scoreText, {
      x: (width - scoreWidth) / 2,
      y,
      size: scoreSize,
      font: boldFont,
      color: GOLD,
    });

    y -= 35;

    // --- Stars ---
    const starsWidth = regularFont.widthOfTextAtSize(band.stars, 20);
    page.drawText(band.stars, {
      x: (width - starsWidth) / 2,
      y,
      size: 20,
      font: regularFont,
      color: GOLD,
    });

    y -= 22;

    // --- Band label ---
    const bandWidth = boldFont.widthOfTextAtSize(band.label, 14);
    page.drawText(band.label, {
      x: (width - bandWidth) / 2,
      y,
      size: 14,
      font: boldFont,
      color: WHITE,
    });

    y -= 18;

    // --- Interpretation ---
    const interp = getBandInterpretation(band.label);
    const interpWidth = regularFont.widthOfTextAtSize(interp, 9);
    page.drawText(interp, {
      x: (width - interpWidth) / 2,
      y,
      size: 9,
      font: regularFont,
      color: LIGHT_GRAY,
    });

    y -= 40;

    // --- Sub-score bars ---
    const barX = 80;
    const barWidth = width - 160;
    const barHeight = 10;
    const subLabels = ["Technical Competence", "Experience Integrity", "Communication Ability", "Behavioural Profile", "Wellness Consistency"];

    for (let i = 0; i < data.subScores.length; i++) {
      const sub = data.subScores[i];
      const label = subLabels[i] || sub.name;

      // Label
      page.drawText(label, { x: barX, y, size: 9, font: regularFont, color: LIGHT_GRAY });
      // Score value
      const valText = sub.score.toFixed(2);
      const valWidth = boldFont.widthOfTextAtSize(valText, 9);
      page.drawText(valText, { x: barX + barWidth - valWidth, y, size: 9, font: boldFont, color: WHITE });

      y -= 14;

      // Background bar
      page.drawRectangle({ x: barX, y, width: barWidth, height: barHeight, color: BAR_BG });
      // Filled bar
      const fillWidth = (sub.score / 5) * barWidth;
      page.drawRectangle({ x: barX, y, width: fillWidth, height: barHeight, color: GOLD });

      y -= 28;
    }

    y -= 10;

    // --- Certificate details grid ---
    const detailsX = 80;
    const col2X = width / 2 + 20;
    const detailSize = 9;
    const labelSize = 8;

    const details = [
      ["Name", data.crewName, "Rank", data.rank],
      ["Vessel Type", data.vesselType, "Assessment Date", data.assessmentDate],
      ["Expiry Date", data.expiryDate, "Certificate ID", data.certificateId],
    ];

    for (const row of details) {
      // Left label
      page.drawText(row[0], { x: detailsX, y, size: labelSize, font: regularFont, color: MID_GRAY });
      y -= 14;
      page.drawText(row[1], { x: detailsX, y, size: detailSize, font: boldFont, color: WHITE });

      // Right label
      page.drawText(row[2], { x: col2X, y: y + 14, size: labelSize, font: regularFont, color: MID_GRAY });
      page.drawText(row[3], { x: col2X, y, size: detailSize, font: boldFont, color: WHITE });

      y -= 24;
    }

    // --- Separator ---
    y -= 5;
    page.drawLine({ start: { x: 80, y }, end: { x: width - 80, y }, thickness: 0.5, color: MID_GRAY });

    y -= 20;

    // --- Verification URL ---
    const verifyUrl = `seaminds.life/verify?id=${data.certificateId}`;
    const verifyLabel = "Verification: ";
    page.drawText(verifyLabel, { x: 80, y, size: 8, font: regularFont, color: MID_GRAY });
    const labelW = regularFont.widthOfTextAtSize(verifyLabel, 8);
    page.drawText(verifyUrl, { x: 80 + labelW, y, size: 8, font: boldFont, color: GOLD });

    y -= 15;

    // --- QR code placeholder text ---
    const qrText = "Scan to verify: " + verifyUrl;
    const qrW = regularFont.widthOfTextAtSize(qrText, 7);
    page.drawText(qrText, { x: (width - qrW) / 2, y, size: 7, font: regularFont, color: LIGHT_GRAY });

    // --- Footer ---
    const footerText = "This certificate was generated by SeaMinds — verified maritime competency assessment";
    const ftW = regularFont.widthOfTextAtSize(footerText, 7);
    page.drawText(footerText, { x: (width - ftW) / 2, y: 50, size: 7, font: regularFont, color: MID_GRAY });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="SMC-Certificate-${data.certificateId}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
