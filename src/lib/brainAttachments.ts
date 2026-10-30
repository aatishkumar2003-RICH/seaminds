// Reads files attached to the Maritime Brain in the browser (no upload, no storage).
// Photos -> compressed JPEG data URL for photo diagnosis; documents -> plain text for the Brain.
import { unzipSync, strFromU8 } from "fflate";
import { readXlsxCv } from "@/lib/xlsxCv";

export const MAX_DOC_CHARS = 12000;
export const ACCEPT = "image/*,.pdf,.docx,.xlsx,.txt,.csv,.md";

export const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

export async function imageToJpeg(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("This photo could not be opened. Try a JPG or PNG.")); i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

async function pdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let out = "";
  for (let p = 1; p <= Math.min(pdf.numPages, 30) && out.length < MAX_DOC_CHARS; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    out += tc.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
  }
  return out;
}

function docxText(buf: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(buf));
  const x = files["word/document.xml"];
  if (!x) throw new Error("This is not a valid Word (.docx) file.");
  return strFromU8(x).replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** Returns trimmed text and whether it was cut to MAX_DOC_CHARS. */
export async function readDocumentText(file: File): Promise<{ text: string; truncated: boolean }> {
  const n = file.name.toLowerCase();
  let text: string;
  if (n.endsWith(".pdf")) text = await pdfText(file);
  else if (n.endsWith(".docx")) text = docxText(await file.arrayBuffer());
  else if (n.endsWith(".doc")) throw new Error("Old .doc files are not supported. Save it as .docx or PDF.");
  else if (/\.xlsx?$/.test(n)) text = (await readXlsxCv(file)).text;
  else text = await file.text();
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("No readable text found. If it is a scanned page, send it as a photo instead.");
  return { text: text.slice(0, MAX_DOC_CHARS), truncated: text.length > MAX_DOC_CHARS };
}
