import { describe, it, expect } from "vitest";
import { zaloChatUrl } from "@/lib/zaloShare";
describe("zaloChatUrl", () => {
  it("converts +84 to local 0 format", () => expect(zaloChatUrl("+84 912 345 678")).toBe("https://zalo.me/0912345678"));
  it("keeps local VN number", () => expect(zaloChatUrl("0912345678")).toBe("https://zalo.me/0912345678"));
  it("no number opens Zalo web", () => expect(zaloChatUrl("")).toBe("https://chat.zalo.me/"));
});
