import { describe, expect, it } from "vitest";
import {
  MASTER_ITEMS,
  MASTER_SECTIONS,
  SPARE_ITEMS,
  SAFETY_ITEMS,
  CERT_ITEMS,
  TOTAL_ITEMS,
  GRADE_LABELS,
  isFormula,
} from "@/lib/takeover/template";
import {
  answerKey,
  computeSafetyShortfall,
  computeShortfall,
  computeStats,
  contradictsAssessment,
  hasAssessment,
  isAnswered,
  isDeficiency,
  isNotApplicable,
  isVerified,
  naReasonMissing,
  validateQuantities,
  type AnswerMap,
} from "@/lib/takeover/answers";
import { buildCsv, buildJson } from "@/lib/takeover/exports";
import { buildFindings, totalCost } from "@/lib/takeover/findings";
import { isPhotoEvidence, SOURCE_LABELS } from "@/lib/takeover/photos";

const row = (group: any, ref: string, data: any, version = 1) => ({
  group_key: group,
  item_ref: ref,
  data,
  version,
});

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

  it("uses the exact source grade meanings", () => {
    expect(GRADE_LABELS[1]).toBe("Very good");
    expect(GRADE_LABELS[2]).toBe("Good / satisfactory");
    expect(GRADE_LABELS[3]).toBe("Serviceable");
    expect(GRADE_LABELS[4]).toBe("Unsatisfactory");
    // source grade 5 is "not verified" and never a condition grade
    expect((GRADE_LABELS as any)[5]).toBeUndefined();
    expect(isVerified("master", { result: "not_verified" })).toBe(false);
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

describe("recorded versus verified", () => {
  it("a partial quantity is recorded but never verified", () => {
    const d = { actual_qty: 3 };
    expect(isAnswered("spares", d)).toBe(true);
    expect(hasAssessment("spares", d)).toBe(false);
    expect(isVerified("spares", d)).toBe(false);
  });

  it("invalid quantities block verification even with an assessment", () => {
    const d = { result: "ok", actual_qty: 1, serviceable_qty: 4 } as any;
    expect(hasAssessment("spares", d)).toBe(true);
    expect(isVerified("spares", d)).toBe(false);
  });

  it("not applicable stays visible and needs a reason", () => {
    expect(isNotApplicable("master", { result: "na" })).toBe(true);
    expect(naReasonMissing("master", { result: "na" })).toBe(true);
    expect(naReasonMissing("master", { result: "na", na_reason: "No such equipment fitted" })).toBe(false);
  });
});

describe("measured shortfalls are findings", () => {
  it("raises a spares finding without a shortfall button press", () => {
    const min = SPARE_ITEMS[0].recommendedMinimum;
    const d = { actual_qty: 0, serviceable_qty: 0 };
    expect(isDeficiency("spares", d, min)).toBe(true);
  });

  it("does not silently accept 'meets requirement' against a measured shortfall", () => {
    const d: any = { result: "ok", actual_qty: 1, serviceable_qty: 1 };
    expect(contradictsAssessment("spares", d, "4")).toBe(true);
    expect(isDeficiency("spares", d, "4")).toBe(true);
  });

  it("raises a safety finding from required versus serviceable", () => {
    const d = { required_qty: 6, onboard_qty: 6, serviceable_qty: 4 };
    expect(isDeficiency("safety", d)).toBe(true);
    expect(contradictsAssessment("safety", { ...d, status: "satisfactory" } as any)).toBe(true);
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

  it("separates verified from recorded-but-not-verified, and findings from completion", () => {
    const answers: AnswerMap = {
      [answerKey("master", "1")]: row("master", "1", { result: "pass" }),
      [answerKey("master", "2")]: row("master", "2", { result: "not_verified" }),
      [answerKey("master", "3")]: row("master", "3", { result: "deficiency" }),
      [answerKey("spares", "1")]: row("spares", "1", { actual_qty: 2 }),
    };
    const s = computeStats(answers);
    expect(s.answered).toBe(4);
    expect(s.verified).toBe(2); // pass + deficiency are explicit assessments
    expect(s.notVerified).toBe(2); // not_verified + quantity-only spare
    expect(s.deficiencies).toBe(1);
    expect(s.unanswered).toBe(278);
    expect(isAnswered("master", {})).toBe(false);
  });

  it("counts invalid quantity rows", () => {
    const answers: AnswerMap = {
      [answerKey("safety", "1")]: row("safety", "1", { onboard_qty: 1, serviceable_qty: 5 }),
    };
    expect(computeStats(answers).invalidQuantities).toBe(1);
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

describe("evidence", () => {
  it("only images qualify as photographic evidence", () => {
    expect(isPhotoEvidence("image/jpeg")).toBe(true);
    expect(isPhotoEvidence("application/pdf")).toBe(false);
    expect(isPhotoEvidence(null)).toBe(false);
  });

  it("camera selection is recorded honestly", () => {
    expect(SOURCE_LABELS.camera_requested).toMatch(/request/i);
    expect(SOURCE_LABELS.gallery).toBeTruthy();
    expect(SOURCE_LABELS.document).toBeTruthy();
  });
});

describe("findings view", () => {
  it("derives findings from the same answer ids with action data", () => {
    const answers: AnswerMap = {
      [answerKey("master", "3")]: row("master", "3", {
        result: "deficiency",
        remarks: "Gasket blowing",
        action: "Renew gasket",
        responsible: "C/E",
        due_date: "2026-01-31",
        cost_usd: 400,
        bucket: "30d",
      }),
      [answerKey("spares", "1")]: row("spares", "1", { actual_qty: 0, serviceable_qty: 0 }),
    };
    const f = buildFindings(answers);
    expect(f.length).toBe(2);
    expect(f.some((x) => x.group === "master" && x.ref === "3" && x.action === "Renew gasket")).toBe(true);
    expect(totalCost(f)).toBe(400);
  });
});

describe("export", () => {
  it("writes one row per template item and never shows recommendations as actuals", () => {
    const csv = buildCsv({ id: "x", vessel_name: "MV Test" }, {});
    const lines = csv.trim().split("\n");
    expect(lines.filter((l) => l.startsWith("Master,") || l.startsWith("Spares,") || l.startsWith("Safety,") || l.startsWith("Certificates,")).length).toBe(282);
    const spareLine = lines.find((l) => l.startsWith("Spares,1,"))!;
    expect(spareLine).toContain("template recommendation: min");
    expect(spareLine).toContain("unknown");
  });

  it("sanitises spreadsheet formula injection in free text", () => {
    const answers: AnswerMap = {
      [answerKey("master", "1")]: row("master", "1", { result: "pass", remarks: "=cmd|'/c calc'!A1" }),
    };
    const csv = buildCsv({ id: "x", vessel_name: "MV Test" }, answers);
    expect(csv).toContain("'=cmd");
    expect(csv).not.toMatch(/,=cmd/);
  });

  it("includes evidence metadata and the frozen snapshot in JSON", () => {
    const evidence = [
      {
        id: "e1",
        storage_path: "x/y.jpg",
        mime_type: "image/jpeg",
        caption: "Boiler",
        photo_no: 1,
        group_key: "master",
        item_ref: "1",
        source_type: "camera_requested",
        created_at: "2026-01-01T00:00:00Z",
        size_bytes: 100,
      },
    ] as any;
    const json = buildJson({ id: "x", vessel_name: "MV Test" }, {}, evidence, { frozen: true });
    expect(json.evidence_manifest.length).toBe(1);
    expect((json as any).submitted_snapshot).toEqual({ frozen: true });
  });
});
