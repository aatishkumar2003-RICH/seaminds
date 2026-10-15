import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/lib/managerVacancies", async (original) => ({
  ...await original<typeof import("@/lib/managerVacancies")>(),
  loadManagerIdentity: vi.fn().mockResolvedValue({ userId: "manager", approved: true, companyName: "Agency" }),
  loadUncertainMarker: vi.fn().mockReturnValue(null),
}));
import PostVacancy from "@/components/opportunities/PostVacancy";

const parsed = (rank: string, vessel: string) => ({ data: { ok: true, vacancies: [{ rank_required: rank, vessel_type: vessel, contact_email: "jobs@example.com" }] }, error: null });
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

async function intake() {
  render(<PostVacancy />);
  await waitFor(() => expect(screen.getByText("Agency")).toBeTruthy());
  fireEvent.change(screen.getByLabelText(/Paste one or many adverts/), { target: { value: "Chief Officer for Bulk Carrier / Oil Tanker\nEmail: jobs@example.com\n---\nChief Engineer for Container Ship / LNG\nEmail: jobs@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Read 2 adverts" }));
}

it("expands every multi-vessel vacancy once, preserving each source and selection", async () => {
  invoke.mockResolvedValueOnce(parsed("Chief Officer", "Bulk Carrier / Oil Tanker"))
    .mockResolvedValueOnce(parsed("Chief Engineer", "Container Ship / LNG"));
  await intake();
  const expand = screen.getByRole("button", { name: "Expand by vessel", exact: true });
  await waitFor(() => expect(expand).not.toBeDisabled());
  fireEvent.click(expand);
  await waitFor(() => expect(screen.getAllByRole("checkbox", { name: /Select Chief/ })).toHaveLength(4));
  expect(screen.getAllByRole("checkbox", { name: /Select Chief/ }).every((el) => (el as HTMLInputElement).checked)).toBe(true);
  expect(expand).toBeDisabled();
  expect(invoke).toHaveBeenCalledTimes(2);
});

it("retries only failed empty readings and leaves successful readings untouched", async () => {
  invoke.mockResolvedValueOnce(parsed("Chief Officer", "Bulk Carrier"))
    .mockResolvedValueOnce({ data: { ok: true, vacancies: [] }, error: null })
    .mockResolvedValueOnce(parsed("Chief Engineer", "LNG"));
  await intake();
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry failed readings (1)" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Retry failed readings (1)" }));
  await waitFor(() => expect(screen.getAllByRole("checkbox", { name: /Select Chief/ })).toHaveLength(2));
  expect(invoke).toHaveBeenCalledTimes(3);
  expect(invoke.mock.calls[2][1].body.text).toContain("Chief Engineer");
  expect(screen.getByRole("button", { name: "Retry failed readings", exact: true })).toBeDisabled();
});