// Reads a modern .xlsx CV (zip of XML) in the browser: all sheets → text tables,
// plus the most portrait-like embedded image as the passport photo.
import { unzipSync, strFromU8 } from "fflate";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const isSpreadsheet = (f: File) => /\.xlsx?$/i.test(f.name) || f.type === XLSX_MIME || f.type === "application/vnd.ms-excel";

const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function imageSize(bytes: Uint8Array, ext: string): { w: number; h: number } | null {
  if (ext === "png" && bytes.length > 24) {
    const v = new DataView(bytes.buffer, bytes.byteOffset);
    return { w: v.getUint32(16), h: v.getUint32(20) };
  }
  if (ext === "jpeg" || ext === "jpg") {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
  }
  return null;
}

/** Pick a portrait photo: taller than wide (logos are usually wide), reasonably sized. */
export function pickPortrait(images: { name: string; bytes: Uint8Array }[]) {
  let best: { name: string; bytes: Uint8Array; score: number } | null = null;
  for (const img of images) {
    const ext = img.name.split(".").pop()!.toLowerCase();
    const size = imageSize(img.bytes, ext);
    if (!size || size.w < 80 || size.h < 80) continue;
    const ratio = size.h / size.w;
    if (ratio < 1.05 || ratio > 2) continue;
    const score = size.w * size.h;
    if (!best || score > best.score) best = { ...img, score };
  }
  return best;
}

const toDataUrl = (bytes: Uint8Array, ext: string) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/${ext === "png" ? "png" : "jpeg"};base64,${btoa(bin)}`;
};

export async function readXlsxCv(file: File): Promise<{ text: string; photo: string | null }> {
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files are not supported. Please open it in Excel and “Save As” .xlsx, then upload again.");
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const get = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  if (!files["xl/workbook.xml"]) throw new Error("This file is not a valid Excel workbook.");

  const shared = Array.from(xml(get("xl/sharedStrings.xml")).getElementsByTagName("si")).map(si =>
    Array.from(si.getElementsByTagName("t")).map(t => t.textContent || "").join(""));

  const rels = xml(get("xl/_rels/workbook.xml.rels"));
  const relMap: Record<string, string> = {};
  Array.from(rels.getElementsByTagName("Relationship")).forEach(r => { relMap[r.getAttribute("Id")!] = r.getAttribute("Target")!; });

  const parts: string[] = [];
  for (const sh of Array.from(xml(get("xl/workbook.xml")).getElementsByTagName("sheet"))) {
    const rid = sh.getAttribute("r:id") || sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || "";
    const target = (relMap[rid] || "").replace(/^\/?(xl\/)?/, "");
    const doc = xml(get(`xl/${target}`));
    const lines: string[] = [];
    for (const row of Array.from(doc.getElementsByTagName("row"))) {
      const cells: string[] = [];
      for (const c of Array.from(row.getElementsByTagName("c"))) {
        const t = c.getAttribute("t");
        const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
        let val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? (c.getElementsByTagName("t")[0]?.textContent ?? "") : v;
        val = val.replace(/\s+/g, " ").trim();
        if (val) cells[colIndex(c.getAttribute("r") || "A")] = val;
      }
      const line = cells.filter(Boolean).join(" | ");
      if (line) lines.push(line);
    }
    if (lines.length) parts.push(`## Sheet: ${sh.getAttribute("name")}\n${lines.join("\n")}`);
  }

  const images = Object.keys(files).filter(p => /^xl\/media\/.+\.(png|jpe?g)$/i.test(p)).map(name => ({ name, bytes: files[name] }));
  const portrait = pickPortrait(images);
  const text = parts.join("\n\n").slice(0, 60000);
  if (!text) throw new Error("No readable text was found in this spreadsheet.");
  return { text, photo: portrait ? toDataUrl(portrait.bytes, portrait.name.split(".").pop()!.toLowerCase()) : null };
}
