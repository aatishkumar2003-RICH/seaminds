import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { insert, trackEvent } = vi.hoisted(() => ({ insert: vi.fn(), trackEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert }) } }));
vi.mock("@/lib/analytics", () => ({ trackEvent }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: React.ReactNode }) => <div onClick={() => onValueChange("Technical Support")}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
import Contact from "@/pages/Contact";

async function submitContact() {
  render(<Contact />);
  fireEvent.change(screen.getByPlaceholderText("Your full name"), { target: { value: "Test Seafarer" } });
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "crew@example.test" } });
  fireEvent.click(screen.getByText("Technical Support"));
  fireEvent.change(screen.getByPlaceholderText("How can we help?"), { target: { value: "Cannot open my assessment" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Message" }));
  await waitFor(() => expect(insert).toHaveBeenCalledOnce());
}

describe("Contact database receipt", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);
  it("records receipt only after a successful database submission", async () => {
    insert.mockResolvedValue({ error: null });
    await submitContact();
    expect(insert).toHaveBeenCalledWith([{ name: "Test Seafarer", email: "crew@example.test", subject: "Technical Support", message: "Cannot open my assessment" }]);
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith("contact_form_submit", { subject: "Technical Support" }));
  });
  it("does not record successful receipt when database submission fails", async () => {
    insert.mockResolvedValue({ error: { message: "unavailable" } });
    await submitContact();
    expect(trackEvent).not.toHaveBeenCalled();
    insert.mockResolvedValue({ error: null });
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledOnce());
  });
});