import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserInviteForm from "../app/dashboard/users/components/UserInviteForm";
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

function renderForm(usersList: Array<Record<string, unknown>> = []) {
  const props = {
    usersList: usersList as never[],
    fetchUsersData: vi.fn().mockResolvedValue(undefined),
    setSuccess: vi.fn(),
    setError: vi.fn(),
  };
  render(<UserInviteForm {...props} />);
  return props;
}

describe("UserInviteForm audited invitation flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a normalized invitation to the audited server API", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    vi.mocked(authenticatedFetch).mockResolvedValue(response({ success: true }));
    const props = renderForm();
    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "Member@Example.org" } });
    fireEvent.change(screen.getByLabelText("Full Name / Nickname"), { target: { value: "Team Member" } });
    fireEvent.change(screen.getByLabelText("Portal Permissions / Role"), { target: { value: "mentor" } });
    fireEvent.change(screen.getByLabelText("Member Type / Designation"), { target: { value: "mentor" } });
    fireEvent.click(screen.getByRole("button", { name: "Authorize & Invite Member" }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/profiles/admin/users/invite",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "member@example.org", name: "Team Member", role: "mentor", memberType: "mentor" }),
      }),
    ));
    expect(props.fetchUsersData).toHaveBeenCalledOnce();
    expect(props.setSuccess).toHaveBeenCalledWith("Successfully authorized member@example.org.");
    const clearSuccess = timeoutSpy.mock.calls.find(([, delay]) => delay === 5000)?.[0];
    expect(clearSuccess).toBeTypeOf("function");
    if (typeof clearSuccess === "function") clearSuccess();
    expect(props.setSuccess).toHaveBeenLastCalledWith(null);
  });

  it("rejects duplicate authorization locally and preserves the draft", async () => {
    const props = renderForm([{ email: "member@example.org" }]);
    const email = screen.getByLabelText("Email Address");
    fireEvent.change(email, { target: { value: "MEMBER@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Authorize & Invite Member" }));

    await waitFor(() => expect(props.setError).toHaveBeenCalledWith("A user with this email address is already authorized."));
    expect(authenticatedFetch).not.toHaveBeenCalled();
    expect(email).toHaveValue("MEMBER@example.org");
  });

  it("exposes HTTP diagnostics and retains fields after a failed invite", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response({ error: "Invitation conflict" }, 409, "Conflict"));
    const props = renderForm();
    const email = screen.getByLabelText("Email Address");
    fireEvent.change(email, { target: { value: "member@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Authorize & Invite Member" }));

    await waitFor(() => expect(props.setError).toHaveBeenCalledWith("HTTP 409: Invitation conflict"));
    expect(email).toHaveValue("member@example.org");
    expect(props.fetchUsersData).not.toHaveBeenCalled();
  });

  it("falls back to HTTP status text when an error body is unreadable", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Unavailable",
      json: vi.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
    } as unknown as Response);
    const props = renderForm();
    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "member@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Authorize & Invite Member" }));
    await waitFor(() => expect(props.setError).toHaveBeenCalledWith("HTTP 503: Unavailable"));
  });

});
