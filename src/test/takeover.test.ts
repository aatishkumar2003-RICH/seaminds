import { describe, expect, it } from "vitest";
import {
  MASTER_ITEMS,
  MASTER_SECTIONS,
  SPARE_ITEMS,
  SAFETY_ITEMS,
  CERT_ITEMS,
  TOTAL_ITEMS,
  isFormula,
} from "@/lib/takeover/template";
import {
  answerKey,
  computeSafetyShortfall,
  computeShortfall,
  computeStats,
  isAnswered,
  isVerified,
  validateQuantities,
  type AnswerMap,
} from "@/lib/takeover/answers";
import { buildCsv } from "@/lib/takeover/exports";

describe("template coverage", () => {
  it("carries every source row", () => {
    expect(MASTER_ITEMS.length).toBe(119);
    expect(SPARE_ITEMS.length).toBe(72);
    expect(SAFETY_ITEMS.length).toBe(31);
    expect(CERT_ITEMS.length).toBe(60);
    expect(TOTAL_ITEMS).toBe(282);
  });

  it("keeps the 13 master sections", () => {
    expect(MASTER_SECTIONS.length).toBe(13);
    expect(MASTER_SECTIONS[0]).toBe("A. Pre-boarding & Records");
  });

  it("preserves guidance wording and photo flags", () => {
    const first = MASTER_ITEMS[0];
    expect(first.detailedTest).toContain("Verify vessel name, IMO, flag");
    expect(first.acceptance).toContain("All identities consistent");
    expect(first.evidence).toBe("Registry, CSR, DOC/SMC, P&I entry");
    expect(first.photoRequired).toBe(false);
    expect(first.criticality).toBe("High");
    expect(MASTER_ITEMS.some((i) => i.photoRequired)).toBe(true);
  });

  it("treats source formulas as reference text only", () => {
    expect(isFormula(SPARE_ITEMS[0].shortfallFormula)).toBe(true);
  });
});

describe("blank vs zero", () => {
  it("shortfall stays unknown when quantities are missing", () => {
    expect(computeShortfall({}, "2")).toBeNull();
    expect(computeShortfall({ actual_qty: 1 }, "2")).toBeNull();
    expect(computeShortfall({ actual_qty: 0, serviceable_qty: 0 }, "2")).toBe(2);
    expect(computeShortfall({ actual_qty: 3, serviceable_qty: 2 }, "2")).toBe(0);
  });

  it("uses serviceable quantity, not the actual count", () => {
    expect(computeShortfall({ actual_qty: 5, serviceable_qty: 1 }, "4")).toBe(3);
  });

  it("unknown required safety quantity is not zero", () => {
    expect(computeSafetyShortfall({ serviceable_qty: 2 })).toBeNull();
    expect(computeSafetyShortfall({ required_qty: 4, serviceable_qty: 2 })).toBe(2);
  });

  it("rejects nonsensical quantities", () => {
    expect(validateQuantities({ actual_qty: -1 })).toHaveLength(1);
    expect(validateQuantities({ actual_qty: 2, serviceable_qty: 3 })).toHaveLength(1);
    expect(validateQuantities({ actual_qty: 0, serviceable_qty: 0 })).toHaveLength(0);
  });
});

describe("progress counting", () => {
  it("counts blanks as unanswered across every row", () => {
    const stats = computeStats({});
    expect(stats.total).toBe(282);
    expect(stats.answered).toBe(0);
    expect(stats.unanswered).toBe(282);
    expect(stats.deficiencies).toBe(0);
  });

  it("separates verified from answered-but-not-verified, and deficiencies from completion", () => {
    const answers: AnswerMap = {
      [answerKey("master", "1")]: { group_key: "master", item_ref: "1", data: { result: "pass" }, version: 1 },
      [answerKey("master", "2")]: { group_key: "master", item_ref: "2", data: { result: "not_verified" }, version: 1 },
      [answerKey("master", "3")]: { group_key: "master", item_ref: "3", data: { result: "deficiency" }, version: 1 },
    };
    const s = computeStats(answers);
    expect(s.answered).toBe(3);
    expect(s.verified).toBe(2);
    expect(s.notVerified).toBe(1);
    expect(s.deficiencies).toBe(1);
    expect(s.unanswered).toBe(279);
    expect(isVerified("master", { result: "not_verified" })).toBe(false);
    expect(isAnswered("master", {})).toBe(false);
  });

  it("counts required photos that are missing", () => {
    const withPhoto = new Set<string>();
    const s1 = computeStats({}, withPhoto);
    expect(s1.missingPhotos).toBe(MASTER_ITEMS.filter((i) => i.photoRequired).length);
    const firstPhotoItem = MASTER_ITEMS.find((i) => i.photoRequired)!;
    withPhoto.add(answerKey("master", firstPhotoItem.ref));
    expect(computeStats({}, withPhoto).missingPhotos).toBe(s1.missingPhotos - 1);
  });
});

describe("export", () => {
  it("writes one row per template item and never shows recommendations as actuals", () => {
    const csv = buildCsv({ id: "x", vessel_name: "MV Test" }, {});
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(1 + 1 + 282); // meta + header + rows
    const spareLine = lines.find((l) => l.startsWith("Spares,1,"))!;
    expect(spareLine).toContain("recommended min 2");
    expect(spareLine).toContain("unknown");
  });
});
