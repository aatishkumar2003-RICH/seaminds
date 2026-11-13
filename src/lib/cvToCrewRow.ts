import { supabase } from "@/integrations/supabase/client";
import { readXlsxCv, isSpreadsheet } from "@/lib/xlsxCv";
import { readDocumentText, imageToJpeg, isImage } from "@/lib/brainAttachments";
import type { CrewImportRow } from "@/lib/companyCrewImport";

export const CV_ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.heic";
const b64 = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(f); });

/** Any CV file (PDF, Word, Excel, CSV, text, photo) → AI-extracted crew row. Throws a friendly message on failure. */
export async function cvToCrewRow(f: File): Promise<CrewImportRow> {
  if (f.size > 20 * 1024 * 1024) throw new Error("File is larger than 20 MB");
  const n = f.name.toLowerCase();
  let body: Record<string, string>;
  if (isSpreadsheet(f)) body = { mime_type: "text/spreadsheet", text_content: (await readXlsxCv(f)).text };
  else if (/\.(docx|txt|csv|md)$/.test(n)) body = { mime_type: "text/spreadsheet", text_content: (await readDocumentText(f)).text };
  else if (n.endsWith(".doc")) throw new Error("Old .doc files are not supported — save as .docx or PDF");
  else if (f.type === "application/pdf" || n.endsWith(".pdf")) body = { mime_type: "application/pdf", file_base64: await b64(f) };
  else if (isImage(f)) body = { mime_type: "image/jpeg", file_base64: (await imageToJpeg(f)).split(",").pop() || "" };
  else throw new Error("Unsupported file type");
  const { data, error } = await supabase.functions.invoke("parse-cv-documents", { body });
  const d = (data as any)?.data;
  if (error || !d) throw new Error((data as any)?.error || "Could not read this CV");
  const certs = [...(Array.isArray(d.certificates) ? d.certificates : []),
    ...(Array.isArray(d.medical) ? d.medical.map((m: any) => ({ name: m.cert_type || "Medical", expiry_date: m.expiry_date, issue_date: m.issue_date, issuing_authority: m.issuing_authority })) : [])].filter((c: any) => c?.name);
  const sea = Array.isArray(d.sea_service) ? d.sea_service : [];
  return {
    first_name: d.first_name || "", last_name: d.last_name || "", rank: d.rank || "", nationality: d.nationality || "",
    email: d.email ? String(d.email).toLowerCase() : "", whatsapp: d.phone || "",
    date_of_birth: /^\d{4}-\d{2}-\d{2}$/.test(d.date_of_birth || "") ? d.date_of_birth : undefined,
    vessel: sea[0]?.vessel_name || "", cdc_no: d.cdc_no || "", passport_no: d.passport_no || "",
    sea_service: sea, certificates: certs,
  } as any;
}

/** Keep the original CV in the manager's private company folder for this record. */
export async function archiveCv(recordId: string, f: File) {
  const { data: u } = await supabase.auth.getUser(); if (!u.user) return false;
  const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const { error } = await supabase.storage.from("company-crew-docs").upload(`${u.user.id}/${recordId}/${Date.now()}_CV_${safe}`, f, { upsert: false });
  return !error;
}
