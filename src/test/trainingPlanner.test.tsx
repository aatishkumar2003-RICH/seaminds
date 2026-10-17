import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ assign: vi.fn(), ledger: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: vi.fn() } }));
vi.mock("@/lib/training", async (original) => ({
  ...await original<typeof import("@/lib/training")>(),
  recommendTraining: vi.fn().mockResolvedValue({ ok: true, items: [{ slug: "mooring", title: "Mooring", reasons: [], gap: true, score: 40 }] }),
  assignTraining: mocks.assign,
  trainingLedger: mocks.ledger,
}));
import TrainingPlanner from "@/components/manager/TrainingPlanner";
describe("manager training dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assign.mockResolvedValue({ ok: true, assigned: [{ title: "Mooring", token: "candidate-token" }] });
    mocks.ledger.mockResolvedValue({ ok: true, items: [] });
  });
  it("opens a window before assignment resolves and uses the returned crew link", async () => {
    const popup = { opener: {}, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    render(<TrainingPlanner inviteId="invite-1" name="Aris" whatsapp="+639190061411" company="Acme" />);
    fireEvent.click(await screen.findByRole("button", { name: /Assign & open WhatsApp/ }));
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() => expect(popup.location.href).toContain("https://wa.me/639190061411"));
    expect(new URL(popup.location.href).searchParams.get("text")).toContain("https://seaminds.life/training/candidate-token");
    expect(popup.opener).toBeNull();
    open.mockRestore();
  });
  it("keeps a retry sharing link when the browser blocks the popup", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<TrainingPlanner inviteId="invite-1" name="Aris" whatsapp="+639190061411" company="Acme" />);
    fireEvent.click(await screen.findByRole("button", { name: /Assign & open WhatsApp/ }));
    const link = await screen.findByRole("link", { name: "Open WhatsApp" });
    expect(link.getAttribute("href")).toContain("candidate-token");
    open.mockRestore();
  });
});describe("training for direct job applicants", () => {
  it("assigns against the job application, not an interview invite", async () => {
    mocks.assign.mockResolvedValue({ ok: true, assigned: [{ title: "Mooring", token: "app-token" }] });
    mocks.ledger.mockResolvedValue({ ok: true, items: [] });
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<TrainingPlanner applicationId="app-1" name="Aris" company="Acme" />);
    fireEvent.click(await screen.findByRole("button", { name: /Assign & open WhatsApp/ }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(null, ["mooring"], "", "app-1"));
    expect(mocks.ledger).toHaveBeenCalledWith(null, "app-1");
  });
});
