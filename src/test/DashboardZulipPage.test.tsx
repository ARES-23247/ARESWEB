import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardZulipPage from "../app/dashboard/zulip/page";
import { authenticatedFetch } from "../lib/api";

const authState = {
  authorizedUser: { role: "admin" },
};

vi.mock("../context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../lib/api", () => ({ authenticatedFetch: vi.fn() }));

const clipboardWrite = vi.fn();

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function statusResponse(overrides: Record<string, unknown> = {}) {
  return response({
    linked: true,
    integration: { available: true, diagnostic: null },
    workspace: {
      url: "https://aresfirst.zulipchat.com",
      inviteUrl: "https://aresfirst.zulipchat.com/join/abcdefghijklmnop/",
    },
    ...overrides,
  });
}

describe("DashboardZulipPage", () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
    clipboardWrite.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite.mockResolvedValue(undefined) },
    });
  });

  it("shows a subject-only linked state and copies the approved link", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(statusResponse());

    render(<DashboardZulipPage />);

    expect(await screen.findByText("Your account is linked.")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(
      "https://aresfirst.zulipchat.com/join/abcdefghijklmnop/",
    ));
    expect(await screen.findByText("The approved invitation link was copied.")).toBeInTheDocument();
  });

  it("keeps an administrator's draft when status is refreshed", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(statusResponse())
      .mockResolvedValueOnce(statusResponse({ linked: false }));

    render(<DashboardZulipPage />);
    expect(await screen.findByText("Your account is linked.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change link" }));
    const input = screen.getByLabelText("Invitation URL");
    fireEvent.change(input, {
      target: { value: "https://aresfirst.zulipchat.com/join/draftdraftdraft123/" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh Zulip status" }));

    expect(await screen.findByText("Your account is not linked yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Invitation URL")).toHaveValue(
      "https://aresfirst.zulipchat.com/join/draftdraftdraft123/",
    );
  });

  it("preserves confirmed status and exposes HTTP details when refresh fails", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(statusResponse())
      .mockResolvedValueOnce(response({ error: "Status service offline" }, 503, "Service Unavailable"));

    render(<DashboardZulipPage />);
    expect(await screen.findByText("Your account is linked.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Zulip status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "HTTP 503: Service Unavailable. Status service offline",
    );
    expect(screen.getByText("Your account is linked.")).toBeInTheDocument();
  });

  it("saves configuration through the audited API and does not lose the draft on failure", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(statusResponse())
      .mockResolvedValueOnce(response({ error: "Host rejected" }, 400, "Bad Request"));

    render(<DashboardZulipPage />);
    expect(await screen.findByText("Your account is linked.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change link" }));
    const input = screen.getByLabelText("Invitation URL");
    fireEvent.change(input, {
      target: { value: "https://aresfirst.zulipchat.com/join/newdrafttoken1234/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save approved link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 400: Bad Request. Host rejected");
    expect(screen.getByLabelText("Invitation URL")).toHaveValue(
      "https://aresfirst.zulipchat.com/join/newdrafttoken1234/",
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, "/api/zulip/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteUrl: "https://aresfirst.zulipchat.com/join/newdrafttoken1234/",
      }),
    });
  });

  it("does not invent a join link when the server has no configuration", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(statusResponse({
      linked: false,
      workspace: { url: "https://aresfirst.zulipchat.com", inviteUrl: null },
    }));

    render(<DashboardZulipPage />);

    expect(await screen.findByText("A coach has not added an approved join link yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Join Zulip" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("ba4zj4e6ykjazruzn3is6lvr");
  });
});
