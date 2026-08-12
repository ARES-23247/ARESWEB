import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserEmailRosterPanel from "../app/dashboard/users/components/UserEmailRosterPanel";
import { authenticatedFetch } from "../lib/api";

vi.mock("../lib/api", () => ({ authenticatedFetch: vi.fn() }));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const rosterPayload = {
  recipients: [
    { name: "CircuitFox", email: "student@example.org", role: "member", memberType: "student", subteams: ["Programming"] },
    { name: "GearGuide", email: "mentor@example.org", role: "mentor", memberType: "mentor", subteams: ["Programming"] },
  ],
  recipientCount: 2,
  generatedAt: "2026-08-12T00:00:00.000Z",
};

describe("UserEmailRosterPanel", () => {
  const writeText = vi.fn();
  const createObjectUrl = vi.fn(() => "blob:email-roster");
  const revokeObjectUrl = vi.fn();
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
    writeText.mockReset().mockResolvedValue(undefined);
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    anchorClick.mockReset().mockImplementation(() => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(URL, "createObjectURL", { value: createObjectUrl, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectUrl, configurable: true });
  });

  it("requires a privacy acknowledgement, requests server filters, and copies a private Gmail BCC list", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response(rosterPayload));
    render(<UserEmailRosterPanel />);

    const prepare = screen.getByRole("button", { name: "Prepare email list" });
    expect(prepare).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "students" } });
    fireEvent.change(screen.getByLabelText("Subteam"), { target: { value: "Programming" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(prepare);

    expect(await screen.findByText("Prepared 2 active roster email addresses.")).toBeInTheDocument();
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/profiles/admin/users/email-roster",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: "students", subteam: "Programming" }),
      },
    );
    expect(screen.queryByText("student@example.org")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy BCC list" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("student@example.org, mentor@example.org"));
    expect(screen.getByRole("status")).toHaveTextContent("Paste them into the BCC field in Gmail");
  });

  it("formats Outlook addresses, downloads a CSV, and clears prepared contact data", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response(rosterPayload));
    render(<UserEmailRosterPanel />);
    fireEvent.change(screen.getByLabelText("Email app"), { target: { value: "outlook" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Prepare email list" }));
    await screen.findByRole("button", { name: "Copy BCC list" });

    fireEvent.click(screen.getByRole("button", { name: "Copy BCC list" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("student@example.org; mentor@example.org"));
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:email-roster");
    expect(screen.getByRole("status")).toHaveTextContent("Downloaded a CSV containing 2 active roster addresses");

    fireEvent.click(screen.getByRole("button", { name: "Clear prepared list" }));
    expect(screen.queryByRole("button", { name: "Copy BCC list" })).not.toBeInTheDocument();
  });

  it("surfaces API and clipboard diagnostics without exposing a fake success", async () => {
    const unreadableErrorResponse = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: vi.fn().mockRejectedValue(new Error("unreadable response")),
    } as unknown as Response;
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(unreadableErrorResponse)
      .mockResolvedValueOnce(response(rosterPayload));
    render(<UserEmailRosterPanel />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Prepare email list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503: Service Unavailable");

    fireEvent.click(screen.getByRole("button", { name: "Prepare email list" }));
    await screen.findByRole("button", { name: "Copy BCC list" });
    writeText.mockRejectedValueOnce(new Error("permission denied"));
    fireEvent.click(screen.getByRole("button", { name: "Copy BCC list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("permission denied");

    createObjectUrl.mockImplementationOnce(() => { throw new Error("download blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("download blocked");
  });
});
