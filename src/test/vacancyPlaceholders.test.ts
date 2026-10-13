import { describe, it, expect } from "vitest";
import { toPreviewVacancy } from "@/lib/managerVacancies";
describe("AI placeholder contacts", () => {
  it('treats "null" email as empty so WhatsApp alone is enough', () => {
    const v = toPreviewVacancy({ contact_email: "null", contact_whatsapp: "+79994592707" });
    expect(v.contact_email).toBe("");
    expect(v.contact_whatsapp).toBe("+79994592707");
  });
});
