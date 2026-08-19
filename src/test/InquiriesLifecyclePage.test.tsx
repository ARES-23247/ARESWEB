import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InquiriesPage from "../app/dashboard/inquiries/page";
import { authenticatedFetch } from "../lib/api";

const authState = {
  user: { uid: "admin-uid" },
  authorizedUser: { role: "admin" },
};

vi.mock("../context/AuthContext", () => ({ useAuth: () => authState, useOptionalAuth: () => undefined,
}));

vi.mock("../lib/api", () => ({ authenticatedFetch: vi.fn() }));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("InquiriesPage recoverable lifecycle", () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({
        inquiries: [{
          id: "inquiry-1",
          type: "student",
          name: "Applicant Nickname",
          email: "applicant@example.org",
          status: "pending",
          metadata: {},
          createdAt: "2026-08-01T12:00:00.000Z",
          isDeleted: false,
        }],
      }))
      .mockResolvedValueOnce(response({ success: true, archived: true }))
      .mockResolvedValueOnce(response({ success: true, restored: true }));
  });

  it("archives through an accessible confirmation and restores from the archive filter", async () => {
    render(<InquiriesPage />);

    expect(await screen.findByText("Applicant Nickname")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /archive inquiry from applicant nickname/i }));
    expect(screen.getByRole("dialog", { name: /archive this inquiry/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive inquiry" }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/inquiries/inquiry-1",
      { method: "DELETE" },
    ));
    expect(await screen.findByText(/inquiry archived/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter inquiries by status/i), { target: { value: "archived" } });
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(authenticatedFetch).toHaveBeenNthCalledWith(
      3,
      "/api/inquiries/inquiry-1/restore",
      { method: "PATCH" },
    ));
    expect(await screen.findByText("Inquiry restored.")).toBeInTheDocument();
  });

  it("appends a bounded next page without duplicating existing inquiries", async () => {
    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({
        inquiries: [{
          id: "inquiry-1", type: "student", name: "First Applicant", email: "first@example.org",
          status: "pending", metadata: {}, createdAt: "2026-08-01T12:00:00.000Z", isDeleted: false,
        }],
        hasMore: true,
        nextCursor: "cursor/one",
      }))
      .mockResolvedValueOnce(response({
        inquiries: [
          {
            id: "inquiry-1", type: "student", name: "First Applicant", email: "first@example.org",
            status: "pending", metadata: {}, createdAt: "2026-08-01T12:00:00.000Z", isDeleted: false,
          },
          {
            id: "inquiry-2", type: "mentor", name: "Second Applicant", email: "second@example.org",
            status: "pending", metadata: {}, createdAt: "2026-08-02T12:00:00.000Z", isDeleted: false,
          },
        ],
        hasMore: false,
        nextCursor: null,
      }));

    render(<InquiriesPage />);
    expect(await screen.findByText("First Applicant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more inquiries" }));
    expect(await screen.findByText("Second Applicant")).toBeInTheDocument();
    expect(screen.getAllByText("First Applicant")).toHaveLength(1);
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, "/api/inquiries?limit=50&cursor=cursor%2Fone");
  });

  it("shows HTTP diagnostics and recovers through retry", async () => {
    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ error: "Database unavailable" }, 503, "Unavailable"))
      .mockResolvedValueOnce(response({ inquiries: [], hasMore: false, nextCursor: null }));

    render(<InquiriesPage />);
    expect(await screen.findByText("HTTP 503: Database unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No Inquiries Found")).toBeInTheDocument();
  });
});
