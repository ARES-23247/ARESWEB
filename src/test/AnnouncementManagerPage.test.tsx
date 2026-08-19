import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("@/context/AuthContext", () => ({ useAuth: mocks.useAuth, useOptionalAuth: () => undefined,
}));
vi.mock("@/utils/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import AnnouncementManagerPage from "@/app/dashboard/announcements/page";

function response(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => payload,
  };
}

const managedAnnouncement = {
  message: "Practice starts at 7 tonight.",
  severity: "urgent",
  link: "/calendar",
  linkLabel: "View calendar",
  revision: "revision-1",
  startsAt: null,
  endsAt: null,
  isActive: true,
  updatedAt: "2026-08-14T12:00:00.000Z",
};

describe("AnnouncementManagerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ authorizedUser: { role: "admin" } });
    mocks.authenticatedFetch.mockResolvedValue(
      response({ success: true, announcement: managedAnnouncement }),
    );
  });

  it("loads existing state and publishes a validated public-safe payload", async () => {
    mocks.authenticatedFetch
      .mockResolvedValueOnce(response({ success: true, announcement: managedAnnouncement }))
      .mockResolvedValueOnce(response({ success: true, revision: "revision-2" }));
    render(<AnnouncementManagerPage />);

    const message = await screen.findByDisplayValue(managedAnnouncement.message);
    fireEvent.change(message, { target: { value: "Practice moved indoors." } });
    fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));

    await screen.findByText(/announcement published/i);
    expect(mocks.authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/announcements/admin",
      expect.objectContaining({ method: "PUT" }),
    );
    const request = mocks.authenticatedFetch.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        message: "Practice moved indoors.",
        severity: "urgent",
        link: "/calendar",
        linkLabel: "View calendar",
        isActive: true,
      }),
    );
  });

  it("requires both optional link fields before sending a request", async () => {
    render(<AnnouncementManagerPage />);
    await screen.findByDisplayValue(managedAnnouncement.message);
    fireEvent.change(screen.getByLabelText("Link label"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/provide both/i);
    expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it("removes the current announcement from the public site", async () => {
    mocks.authenticatedFetch
      .mockResolvedValueOnce(response({ success: true, announcement: managedAnnouncement }))
      .mockResolvedValueOnce(response({ success: true, revision: "revision-2" }));
    render(<AnnouncementManagerPage />);
    await screen.findByDisplayValue(managedAnnouncement.message);

    fireEvent.click(screen.getByRole("button", { name: "Remove from site" }));

    await screen.findByText(/removed from the public site/i);
    expect(mocks.authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/announcements/admin",
      { method: "DELETE" },
    );
  });

  it("does not request management data for non-privileged members", async () => {
    mocks.useAuth.mockReturnValue({ authorizedUser: { role: "member" } });
    render(<AnnouncementManagerPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/only an administrator or coach/i);
    await waitFor(() => expect(mocks.authenticatedFetch).not.toHaveBeenCalled());
  });
});
