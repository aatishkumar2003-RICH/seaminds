import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import type { MasterRecord } from "./principalCvPdf";

export type TemplateMapping = { part: string; target: string; label: string; field: string };
export type TemplateInspection = { type: "docx" | "xlsx"; targets: TemplateMapping[]; photos: string[] };
export const TEMPLATE_MAX_BYTES = 10 * 1024 * 1024;
const parse = (text: string) => {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("The template contains unreadable XML.");
  return doc;
};
const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);
const children = (el: Document | Element, name: string) => Array.from(el.getElementsByTagNameNS("*", name));
function unpack(bytes: Uint8Array) {
  if (bytes.length > TEMPLATE_MAX_BYTES) throw new Error("Maximum template size is 10 MB.");
  let total = 0;
  const files = unzipSync(bytes, { filter: entry => {
    total += entry.originalSize;
    if (total > 60 * 1024 * 1024) throw new Error("The expanded template is too large.");
    return true;
  } });
  if (Object.keys(files).some(p => /vbaProject|embeddings\//i.test(p))) throw new Error("Remove macros and embedded objects before uploading.");
  for (const [path, data] of Object.entries(files)) if (path.endsWith(".rels")) {
    const rels = parse(strFromU8(data));
    if (children(rels, "Relationship").some(r => r.getAttribute("TargetMode") === "External" && !r.getAttribute("Type")?.endsWith("/hyperlink"))) throw new Error("Remove external data or linked images before uploading.");
  }
  return files;
}
export const FIELD_OPTIONS = [
  ["name", "Full name"], ["rank", "Rank"], ["crewId", "Crew ID"], ["dob", "Date of birth"],
  ["nationality", "Nationality"], ["email", "Contact email"], ["whatsapp", "WhatsApp"],
  ["passportNo", "Passport number"], ["cdcNo", "Seaman book / CDC"], ["address", "Address"],
  ["availableFrom", "Available from"], ["boilerSuitSize", "Boiler suit size"], ["shoeSize", "Shoe size"],
  ["sea", "Sea service — all entries"], ["certs", "Certificates — all entries"], ["edu", "Education — all entries"],
  ["declaration", "Crew declaration"],
  ...Array.from({ length: 30 }, (_, i) => ["vesselName", "rankOnBoard", "fromDate", "toDate", "engineType", "grtDwt", "company"].map(k => [`sea.${i}.${k}`, `Sea service ${i + 1}: ${k}`])).flat(),
  ...Array.from({ length: 30 }, (_, i) => ["name", "number", "issueDate", "expiryDate", "issuingAuthority"].map(k => [`certs.${i}.${k}`, `Certificate ${i + 1}: ${k}`])).flat(),
] as string[][];
const guesses: Record<string, string> = { name: "name", fullname: "name", rank: "rank", dateofbirth: "dob", dob: "dob", nationality: "nationality", email: "email", whatsapp: "whatsapp", passportnumber: "passportNo", passportno: "passportNo", cdcno: "cdcNo", seamanbook: "cdcNo", seaservice: "sea" };
const suggest = (label: string) => guesses[label.toLowerCase().replace(/[^a-z]/g, "")] || "";
export function inspectTemplate(bytes: Uint8Array, filename: string): TemplateInspection {
  const type = filename.toLowerCase().endsWith(".docx") ? "docx" : filename.toLowerCase().endsWith(".xlsx") ? "xlsx" : null;
  if (!type) throw new Error("Use a Word .docx or Excel .xlsx template. Convert old .xls files first.");
  const files = unpack(bytes);
  if (!files[type === "docx" ? "word/document.xml" : "xl/workbook.xml"]) throw new Error("The file is not a valid Word or Excel template.");
  const targets: TemplateMapping[] = [];
  if (type === "docx") {
    const part = "word/document.xml";
    const doc = parse(strFromU8(files[part]));
    children(doc, "p").forEach((p, i) => {
      const text = children(p, "t").map(t => t.textContent || "").join("").trim();
      const label = text || `Empty paragraph ${i + 1}`;
      targets.push({ part, target: String(i), label: label.slice(0, 140), field: suggest(text.replace(/[{}]/g, "")) });
    });
  } else {
    const shared = files["xl/sharedStrings.xml"] ? children(parse(strFromU8(files["xl/sharedStrings.xml"])), "si").map(si => children(si, "t").map(t => t.textContent || "").join("")) : [];
    for (const part of Object.keys(files).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))) {
      const doc = parse(strFromU8(files[part]));
      const cells = children(doc, "c");
      cells.forEach(c => {
        const ref = c.getAttribute("r") || "";
        if (!ref || children(c, "f").length) return;
        const v = children(c, "v")[0]?.textContent || "";
        const text = c.getAttribute("t") === "s" ? shared[Number(v)] || "" : c.getAttribute("t") === "inlineStr" ? children(c, "t").map(t => t.textContent || "").join("") : v;
        targets.push({ part, target: ref, label: `${part.split("/").pop()} · ${ref}: ${text || "Empty cell"}`.slice(0, 140), field: text.startsWith("{{") ? suggest(text.replace(/[{}]/g, "")) : "" });
      });
    }
  }
  if (targets.length > 12000) throw new Error("Too many fields. Upload only the blank CV form, not a crew database.");
  return { type, targets, photos: Object.keys(files).filter(p => /^(word|xl)\/media\/.*\.(png|jpe?g)$/i.test(p)) };
}
const formatDate = (s: unknown) => String(s ?? "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
export function templateValues(record: MasterRecord): Record<string, string> {
  const p = record.personal || {}, profile = record.profile || {};
  const values: Record<string, string> = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => [k, formatDate(v)]));
  values.name = [p.firstName || profile.first_name, p.lastName || profile.last_name].filter(Boolean).join(" ");
  values.rank = p.rank || profile.rank || ""; values.nationality = p.nationality || profile.nationality || "";
  values.crewId = record.cv_uid || profile.crew_unique_id || "";
  values.whatsapp = p.whatsapp || p.whatsappNumber || p.phone || "";
  for (const section of ["sea", "certs", "edu"] as const) {
    const rows = Array.isArray(record[section]) ? record[section] : [];
    rows.forEach((r, i) => Object.entries(r).forEach(([k, v]) => { if (typeof v === "string" || typeof v === "number") values[`${section}.${i}.${k}`] = formatDate(v); }));
    const keys = section === "sea" ? ["vesselName", "rankOnBoard", "fromDate", "toDate", "engineType", "grtDwt", "company"] : section === "certs" ? ["name", "number", "issuingAuthority", "issueDate", "expiryDate"] : ["institution", "qualification", "year"];
    values[section] = rows.map(r => keys.map(k => formatDate(r[k])).filter(Boolean).join(" | ")).join("\n");
  }
  values.declaration = record.declaration?.acceptedAt ? `I confirm that my CV, sea service and certificates are true and authentic. ${values.name} — confirmed ${formatDate(String(record.declaration.acceptedAt).slice(0, 10))}. Employer must verify originals.` : "";
  return values;
}
export async function fillTemplate(bytes: Uint8Array, type: "docx" | "xlsx", mappings: TemplateMapping[], record: MasterRecord, photoPath?: string | null): Promise<Uint8Array> {
  if (!record.declaration?.acceptedAt) throw new Error("Ask the crew to confirm their CV accuracy declaration before exporting.");
  if (!mappings.length) throw new Error("Map at least one field before saving the template.");
  const files = unpack(bytes), values = templateValues(record);
  for (const part of new Set(mappings.map(m => m.part))) {
    if (!files[part] || !(type === "docx" ? part === "word/document.xml" : /^xl\/worksheets\/sheet\d+\.xml$/.test(part))) throw new Error("Invalid template field location.");
    const doc = parse(strFromU8(files[part]));
    for (const m of mappings.filter(m => m.part === part)) {
      if (!FIELD_OPTIONS.some(([key]) => key === m.field)) throw new Error("Unknown crew field.");
      const value = values[m.field] || "";
      if (type === "docx") {
        const p = children(doc, "p")[Number(m.target)];
        if (!p) throw new Error("Template changed; review its mappings again.");
        const texts = children(p, "t");
        if (texts.length) { texts[0].textContent = value; texts[0].setAttribute("xml:space", "preserve"); texts.slice(1).forEach(t => { t.textContent = ""; }); }
        else { const r = doc.createElementNS(p.namespaceURI, "w:r"), t = doc.createElementNS(p.namespaceURI, "w:t"); t.textContent = value; r.appendChild(t); p.appendChild(r); }
      } else {
        const c = children(doc, "c").find(c => c.getAttribute("r") === m.target);
        if (!c || children(c, "f").length) throw new Error("Mapped Excel cell is missing or contains a formula.");
        children(c, "v").concat(children(c, "is")).forEach(n => n.parentNode?.removeChild(n));
        c.setAttribute("t", "inlineStr");
        const is = doc.createElementNS(c.namespaceURI, "is"), t = doc.createElementNS(c.namespaceURI, "t"); t.setAttribute("xml:space", "preserve"); t.textContent = value; is.appendChild(t); c.appendChild(is);
      }
    }
    files[part] = strToU8(serialize(doc));
  }
  if (photoPath) {
    if (!files[photoPath] || !/^(word|xl)\/media\/.*\.(png|jpe?g)$/i.test(photoPath)) throw new Error("Invalid photo slot.");
    if (!record.photo) throw new Error("The crew photo is missing. Ask the crew to add it before export.");
    const image = new Image(); image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Crew photo could not be loaded.")); image.src = record.photo || ""; });
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Photo processing is unavailable."); context.drawImage(image, 0, 0);
    const mime = /\.png$/i.test(photoPath) ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.9);
    files[photoPath] = Uint8Array.from(atob(dataUrl.split(",")[1]), c => c.charCodeAt(0));
  }
  return zipSync(files);
}
