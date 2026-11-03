import { describe, it, expect } from "vitest";
import { splitAdverts } from "@/lib/advertSplitter";
import { withCountryCode } from "@/lib/whatsappCc";

const PASTE = `🚨 URGENT CREW VACANCIES 🚢🇮🇩

🔹 CS DUNHUANG | BULK | 5,400 TONS

Need: AB (Indonesian)

📅 12 Nov

🔹 JORYA | CHEMICAL TANKER

Need: 3/E (Indonesian)

🔹 GLOBAL SAGE | BULK | GRT 34,896

Need: 2/O, 3/E (Indonesian)

📢 QUALIFIED & EXPERIENCED SEAFARERS, APPLY NOW!

📩 Send updated CV for immediate screening.

PT YUPAR SUNA INDO

📱 Chita: +62 813-8597-8097`;

describe("vessel list with contact footer", () => {
  it("keeps every vessel in the same advert as the WhatsApp footer", () => {
    const r = splitAdverts(PASTE);
    expect(r).toHaveLength(1);
    expect(r[0].text).toContain("CS DUNHUANG");
    expect(r[0].text).toContain("+62 813-8597-8097");
  });
});

describe("WhatsApp with or without country code", () => {
  it.each([
    ["0813 8597 8097", "+6281385978097"],
    ["813-8597-8097", "+6281385978097"],
    ["62 813 8597 8097", "+6281385978097"],
    ["+62 813 8597 8097", "+6281385978097"],
    ["0062 813 8597 8097", "+6281385978097"],
  ])("%s → %s", (input, out) => expect(withCountryCode(input, "+62")).toBe(out));
});
