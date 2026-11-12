import { describe, expect, it } from "vitest";
import { integrityStatus } from "./interviewIntegrity";

describe("interview integrity status", () => {
  it("is clean only with zero strikes", () => expect(integrityStatus(0)).toMatchObject({ state: "clean", label: "Clean" }));
  it("marks one strike as restarted", () => expect(integrityStatus(1)).toMatchObject({ state: "restarted", label: "Restarted" }));
  it("marks two strikes as restarted, not locked", () => expect(integrityStatus(2).state).toBe("restarted"));
  it("locks at the third strike", () => expect(integrityStatus(3)).toMatchObject({ state: "locked", label: "Locked" }));
  it("stays locked after further strikes", () => expect(integrityStatus(4).state).toBe("locked"));
});
