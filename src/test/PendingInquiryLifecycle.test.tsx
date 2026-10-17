import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InquiriesPage from "@/app/dashboard/inquiries/page";
import { usePendingInquiries } from "@/lib/usePendingInquiries";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
const auth = { user: { uid: "admin-1" }, authorizedUser: { role: "admin" } };
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/lib/api", () => ({ authenticatedFetch: mocks.fetch }));

function Badge() {
  const { hasPendingInquiries, inquiriesState } = usePendingInquiries();
  return <output aria-label="Queue badge">{inquiriesState}:{String(hasPendingInquiries)}</output>;
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function setup() {
  return render(<QueryClientProvider client={new QueryClient()}>
    <Badge /><Badge /><InquiriesPage />
  </QueryClientProvider>);
}
const badges = (state: string) => waitFor(() => {
  screen.getAllByLabelText("Queue badge").forEach((badge) => expect(badge).toHaveTextContent(state));
});

describe("inquiry mutations refresh all queue badges", () => {
  beforeEach(() => {
    let hasPending = true;
    mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("pending-exists")) return response({ hasPending });
      if (!init?.method) return response({ inquiries: [{
        id: "inq-1", type: "student", name: "Test Applicant", email: "applicant@example.test",
        status: "pending", metadata: {}, createdAt: "2026-10-16T12:00:00Z", isDeleted: false,
      }] });
      hasPending = url.endsWith("/restore") || !!init.body?.toString().includes('"pending"');
      return response({ success: true });
    });
  });

  it.each(["Resolve", "Reject", "Create Account"])("refreshes after %s and reopening", async (action) => {
    setup();
    await badges("connected:true");
    fireEvent.click(await screen.findByRole("button", { name: action }));
    if (action === "Create Account") {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create account" }));
    }
    await badges("connected:false");
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await badges("connected:true");
  });

  it("refreshes after archive and restore", async () => {
    setup();
    await badges("connected:true");
    fireEvent.click(await screen.findByRole("button", { name: "Archive inquiry from Test Applicant" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archive inquiry" }));
    await badges("connected:false");
    fireEvent.change(screen.getByLabelText(/filter inquiries by status/i), { target: { value: "archived" } });
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await badges("connected:true");
  });

  it("keeps the badge when a mutation fails and displays the action error", async () => {
    setup();
    await badges("connected:true");
    mocks.fetch.mockResolvedValueOnce(response({ error: "Queue update unavailable" }, 503));
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    expect(await screen.findByText(/Queue update unavailable/)).toBeInTheDocument();
    await badges("connected:true");
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith("pending-exists"))).toHaveLength(1);
  });
});
