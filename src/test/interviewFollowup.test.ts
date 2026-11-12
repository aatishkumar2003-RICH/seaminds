import { describe, it, expect } from "vitest";
import { followupEmail, type FollowupRow } from "../../supabase/functions/_shared/interviewFollowup";
const base: FollowupRow = { kind: "reminder", invite_id: "i", token: "tok", email: "a@b.co", crew_id: null, name: "Nam", company: "VN Ship", rank: "2nd Engineer", language: "en", prep_tracks: [], score: null, attempt: 1, modules: [] };
describe("interview follow-up emails", () => {
  it("reminder links to the candidate's own interview token", () => {
    expect(followupEmail(base).html).toContain("https://seaminds.life/interview/tok");
  });
  it("Vietnamese campaigns get a Vietnamese paragraph", () => {
    expect(followupEmail({ ...base, language: "vi" }).html).toContain("đang chờ");
    expect(followupEmail(base).html).not.toContain("đang chờ");
  });
  it("improvement email lists assigned modules and English track", () => {
    const m = followupEmail({ ...base, kind: "improvement", prep_tracks: ["english"], modules: [{ title: "Bunkering", token: "t1" }] });
    expect(m.text).toContain("https://seaminds.life/training/t1");
    expect(m.text).toContain("tab=english");
  });
  it("second improvement email is a reminder", () => {
    expect(followupEmail({ ...base, kind: "improvement", attempt: 2, modules: [{ title: "X", token: "t" }] }).subject).toMatch(/^Reminder/);
  });
});
