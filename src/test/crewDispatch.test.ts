import { describe, it, expect } from "vitest";
import { normalizeYoutubeUrl } from "@/lib/crewDispatch";

describe("dispatch YouTube links", () => {
  it("accepts youtube and youtu.be https links", () => {
    expect(normalizeYoutubeUrl("https://youtu.be/abc")).toBe("https://youtu.be/abc");
    expect(normalizeYoutubeUrl(" https://www.youtube.com/shorts/x ")).toBe("https://www.youtube.com/shorts/x");
  });
  it("rejects other sites and plain http", () => {
    expect(normalizeYoutubeUrl("https://evil.com/youtube.com/")).toBeNull();
    expect(normalizeYoutubeUrl("http://youtube.com/watch")).toBeNull();
  });
});
