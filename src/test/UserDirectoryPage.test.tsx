import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardUsersPage from "../app/dashboard/users/page";
import { authenticatedFetch } from "../lib/api";

const authState = {
  user: { uid: "admin-uid" },
  authorizedUser: { role: "admin" },
};

vi.mock("../context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../lib/api", () => ({ authenticatedFetch: vi.fn() }));

vi.mock("../app/dashboard/users/components/UserRosterTable", () => ({
  default: ({ filteredUsers, isLoading, onCreateZulip }: {
    filteredUsers: Array<{ id: string; name: string }>;
    isLoading: boolean;
    onCreateZulip: (userId: string) => void;
  }) => (
    <div aria-label="User roster">
      {isLoading ? "Loading roster" : filteredUsers.map(user => (
        <div key={user.id}>
          <p>{user.name}</p>
          <button type="button" onClick={() => onCreateZulip(user.id)}>Provision {user.name}</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../app/dashboard/users/components/UserInviteForm", () => ({
  default: () => <div>Invite form</div>,
}));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function directoryResponse(
  users: Array<{ id: string; name: string; email: string }>,
  nextCursor: string | null,
) {
  return response({
    users: users.map(user => ({
      ...user,
      role: "member",
      isRegistered: true,
      avatar: "",
      subteams: [],
      memberType: "student",
      profileExists: true,
      zulipLinked: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      isDeleted: false,
    })),
    nextCursor,
    integrations: { zulip: { available: true, diagnostic: null } },
  });
}

describe("DashboardUsersPage paginated directory", () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
  });

  it("loads another cursor page and keeps the confirmed first page visible", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ success: true, provisionedCount: 0 }))
      .mockResolvedValueOnce(directoryResponse([
        { id: "user-1", name: "Member One", email: "one@example.org" },
      ], "next-page"))
      .mockResolvedValueOnce(directoryResponse([
        { id: "user-2", name: "Member Two", email: "two@example.org" },
      ], null));

    render(<DashboardUsersPage />);

    expect(await screen.findByText("Member One")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more users" }));

    expect(await screen.findByText("Member Two")).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      3,
      "/api/profiles/admin/users/list?limit=50&cursor=next-page",
    );
  });

  it("retains confirmed users and exposes HTTP diagnostics when refresh fails", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ success: true, provisionedCount: 0 }))
      .mockResolvedValueOnce(directoryResponse([
        { id: "user-1", name: "Confirmed Member", email: "member@example.org" },
      ], null))
      .mockResolvedValueOnce(response({ success: true, provisionedCount: 0 }))
      .mockResolvedValueOnce(response({ error: "Directory unavailable" }, 503, "Service Unavailable"));

    render(<DashboardUsersPage />);

    expect(await screen.findByText("Confirmed Member")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh List" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503: Directory unavailable");
    expect(screen.getByText("Confirmed Member")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh List" })).not.toBeDisabled());
  });

  it("continues with the server directory when Auth synchronization fails", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ error: "Identity provider unavailable" }, 502, "Bad Gateway"))
      .mockResolvedValueOnce(directoryResponse([
        { id: "user-1", name: "Last Confirmed Member", email: "member@example.org" },
      ], null));

    render(<DashboardUsersPage />);

    expect(await screen.findByText("Last Confirmed Member")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 502: Identity provider unavailable");
  });

});
