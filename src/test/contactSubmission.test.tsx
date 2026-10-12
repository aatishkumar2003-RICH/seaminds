import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { from, toastSuccess, toastError } = vi.hoisted(() => ({ from: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));
import Contact from "@/pages/Contact";

describe("Contact page (email-only)", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  it("links each official address with its prefilled subject", () => {
    render(<Contact />);
    expect(screen.getByText("support@seaminds.life").closest("a")?.getAttribute("href"))
      .toBe("mailto:support@seaminds.life?subject=SeaMinds%20support%20request");
    expect(screen.getByText("admin@seaminds.life").closest("a")?.getAttribute("href"))
      .toBe("mailto:admin@seaminds.life?subject=SeaMinds%20commercial%20enquiry");
  });

  it("copies the support address and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Contact />);
    fireEvent.click(screen.getByRole("button", { name: "Copy support@seaminds.life" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("support@seaminds.life"));
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
  });

  it("tells the user to copy manually when clipboard fails", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<Contact />);
    fireEvent.click(screen.getByRole("button", { name: "Copy admin@seaminds.life" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
  });

  it("has no form and never writes to the database", () => {
    const { container } = render(<Contact />);
    expect(container.querySelector("form")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("shows back navigation to the homepage", () => {
    render(<Contact />);
    expect(screen.getByRole("button", { name: /Back to Homepage/ })).toBeTruthy();
  });
});
