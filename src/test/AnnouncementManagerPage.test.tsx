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
  evergreen: false,
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
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2030-11-16T23:00" } });
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
        evergreen: false,
        endsAt: new Date("2030-11-16T23:00").toISOString(),
      }),
    );
  });

  it("requires an expiry unless ongoing publication is selected explicitly", async () => {
    render(<AnnouncementManagerPage />);
    await screen.findByDisplayValue(managedAnnouncement.message);
    const save = screen.getByRole("button", { name: "Save announcement" });
    fireEvent.click(save);
    expect(await screen.findByRole("alert")).toHaveTextContent(/set an end time/i);
    expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("checkbox", { name: "Keep published until removed" }));
    expect(screen.getByLabelText("Ends")).toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mocks.authenticatedFetch.mock.calls[1][1].body)).toMatchObject({
      isActive: true,
      evergreen: true,
      endsAt: null,
    });
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

  it("shows explicit Scheduled/Expired lifecycle states, Zulip delivery state, @all re-ping warning, and keeps Remove enabled", async () => {
    const sentAnnouncement = {
      ...managedAnnouncement,
      startsAt: "2035-01-10T14:00:00.000Z",
      endsAt: "2035-01-11T14:00:00.000Z",
      zulipDelivery: "sent" as const,
      zulipDeliveredAt: "2026-08-14T12:05:00.000Z",
      zulipAttempts: 1,
    };
    mocks.authenticatedFetch
      .mockResolvedValueOnce(response({ success: true, announcement: sentAnnouncement }))
      .mockResolvedValueOnce(response({ success: true, announcement: sentAnnouncement }))
      .mockResolvedValueOnce(
        response({
          success: true,
          announcement: {
            ...sentAnnouncement,
            startsAt: "2020-01-01T10:00:00.000Z",
            endsAt: "2020-01-02T10:00:00.000Z",
          },
        }),
      );

    render(<AnnouncementManagerPage />);
    await screen.findByDisplayValue(sentAnnouncement.message);

    // Scheduled badge + Zulip delivery status
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText(/Zulip #announcements: Sent/i)).toBeInTheDocument();

    // Schedule-only edit does NOT trigger @all re-ping warning
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2035-01-12T14:00" } });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    // Save scheduled banner shows scheduled toast (not published)
    fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));
    await screen.findByText(/announcement scheduled/i);

    // Content edit on already-sent active banner displays @all re-ping warning
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Practice starts at 6:30 tonight." },
    });
    expect(screen.getByRole("note")).toHaveTextContent(/post a new @all broadcast/i);

    // Unchecking "Show on the public site" keeps "Remove from site" enabled because server is still active
    fireEvent.click(screen.getByRole("checkbox", { name: "Show on the public site" }));
    expect(screen.getByText("Draft / Hidden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from site" })).toBeEnabled();

    // Re-check and set past window -> Expired badge & past-end toast
    fireEvent.click(screen.getByRole("checkbox", { name: "Show on the public site" }));
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2020-01-01T10:00" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2020-01-02T10:00" } });
    expect(screen.getByText("Expired")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));
    await screen.findByText(/end time is in the past/i);
  });

  it("displays failed Zulip delivery status banner", async () => {
    mocks.authenticatedFetch.mockResolvedValueOnce(
      response({
        success: true,
        announcement: {
          ...managedAnnouncement,
          evergreen: true,
          zulipDelivery: "failed",
          zulipAttempts: 5,
        },
      }),
    );

    render(<AnnouncementManagerPage />);
    await screen.findByDisplayValue(managedAnnouncement.message);
    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByText(/Delivery failed after retries/i)).toBeInTheDocument();
  });
});
