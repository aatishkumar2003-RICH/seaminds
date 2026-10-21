// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { readXlsxCv } from "@/lib/xlsxCv";

const SAMPLE = "/mnt/user-uploads/CE_VU_VAN_TIEN.xlsx";

describe("readXlsxCv", () => {
  it.skipIf(!existsSync(SAMPLE))("extracts sheet text and the portrait photo, not the logo", async () => {
    const buf = readFileSync(SAMPLE);
    const file = new File([buf], "CE_VU_VAN_TIEN.xlsx");
    (file as any).arrayBuffer = async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const { text, photo } = await readXlsxCv(file);
    expect(text).toContain("NAME IN FULL | VU | TIEN | VAN");
    expect(text).toContain("BREMEN BELLE");
    expect(photo?.startsWith("data:image/jpeg")).toBe(true);
  });

  it("rejects legacy .xls files", async () => {
    await expect(readXlsxCv(new File(["x"], "old.xls"))).rejects.toThrow(/xlsx/);
  });
});
