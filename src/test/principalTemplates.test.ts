// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import { inspectTemplate, fillTemplate, templateValues, TEMPLATE_MAX_BYTES } from "@/lib/principalTemplates";
const docx = () => zipSync({ "word/document.xml": strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{na</w:t></w:r><w:r><w:t>me}}</w:t></w:r></w:p><w:p><w:r><w:t>Company logo and title</w:t></w:r></w:p></w:body></w:document>') });
const xlsx = () => zipSync({ "xl/workbook.xml": strToU8('<workbook/>'), "xl/worksheets/sheet1.xml": strToU8('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" s="4"/><c r="C1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>') });
const record = { personal: { firstName: "Nguyen", lastName: "An & B", dob: "1990-02-03" }, profile: { rank: "Chief Engineer" }, sea: [{ vesselName: "Ship One", fromDate: "2025-01-01" }, { vesselName: "Ship Two" }], certs: [{ name: "COC", number: "123" }], edu: [], skills: {}, declaration: { acceptedAt: "2026-10-24T00:00:00Z" } };
describe("private principal template mapping", () => {
  it("accepts arbitrary company forms without principal-name presets", () => {
    expect(inspectTemplate(docx(), "Any Company's Form.docx").targets[0].field).toBe("name");
  });
  it("fills split Word runs with escaped crew data while preserving unmapped text", async () => {
    const inspected = inspectTemplate(docx(), "blank.docx");
    const output = await fillTemplate(docx(), "docx", inspected.targets.filter(t => t.field), record);
    const text = strFromU8(unzipSync(output)["word/document.xml"]);
    expect(text).toContain("Nguyen An &amp; B"); expect(text).toContain("Company logo and title"); expect(text).not.toContain("{{na");
  });
  it("writes to the reviewed Excel answer cell without changing its label, style or formula", async () => {
    const inspected = inspectTemplate(xlsx(), "blank.xlsx");
    expect(inspected.targets.some(t => t.target === "C1")).toBe(false);
    const target = inspected.targets.find(t => t.target === "B1");
    if (!target) throw new Error("Missing answer target");
    const output = await fillTemplate(xlsx(), "xlsx", [{ ...target, field: "name" }], record);
    const text = strFromU8(unzipSync(output)["xl/worksheets/sheet1.xml"]);
    expect(text).toContain('s="4"'); expect(text).toContain("<f>1+1</f>"); expect(text).toContain("<t>Name</t>"); expect(text).toContain("Nguyen An &amp; B");
  });
  it("exports all sea-service entries and uses saved profile rank", () => {
    const values = templateValues(record); expect(values.rank).toBe("Chief Engineer"); expect(values.sea).toContain("Ship One"); expect(values.sea).toContain("Ship Two"); expect(values.dob).toBe("03/02/1990"); expect(values["certs.0.number"]).toBe("123");
  });
  it("blocks exports without crew accuracy confirmation", async () => {
    await expect(fillTemplate(docx(), "docx", inspectTemplate(docx(), "form.docx").targets.filter(t => t.field), { ...record, declaration: null })).rejects.toThrow("confirm their CV accuracy");
  });
  it("requires valid Word or Excel and caps uploaded forms at 10 MB", () => {
    expect(TEMPLATE_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(() => inspectTemplate(new Uint8Array(TEMPLATE_MAX_BYTES + 1), "huge.docx")).toThrow("10 MB");
    expect(() => inspectTemplate(docx(), "old.xls")).toThrow("Convert old .xls");
    expect(() => inspectTemplate(docx(), "wrong.xlsx")).toThrow("not a valid");
  });
  it("blocks external linked data and embedded active objects", () => {
    const files = unzipSync(docx()); files["word/_rels/document.xml.rels"] = strToU8('<Relationships><Relationship TargetMode="External" Type="image" Target="https://example.com/private"/></Relationships>');
    expect(() => inspectTemplate(zipSync(files), "linked.docx")).toThrow("external data");
  });
});
