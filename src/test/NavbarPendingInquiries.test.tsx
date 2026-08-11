import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "../components/Navbar";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  authState: {
    user: { uid: "member-1", displayName: "ARES Member", email: "member@example.com", photoURL: null },
    authorizedUser: { email: "member@example.com", role: "admin", name: "ARES Member" },
    loading: false,
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    loginWithMockUser: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => mocks.authState }));
vi.mock("@/lib/api", () => ({ authenticatedFetch: mocks.authenticatedFetch }));

function renderNavbar() {
  return render(<MemoryRouter><Navbar /></MemoryRouter>);
}

describe("Navbar pending inquiry status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.authorizedUser.role = "admin";
  });

  it("loads a boolean-only bounded API for admin navigation", async () => {
    mocks.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ success: true, hasPending: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    renderNavbar();

    await waitFor(() => expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/inquiries/pending-exists",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(await screen.findByLabelText("Pending inquiries")).toBeInTheDocument();
  });

  it("does not request administrative inquiry status for mentors", async () => {
    mocks.authState.authorizedUser.role = "mentor";
    renderNavbar();

    await waitFor(() => expect(mocks.authenticatedFetch).not.toHaveBeenCalled());
    expect(screen.queryByLabelText("Pending inquiries")).not.toBeInTheDocument();
  });

  it("shows an honest unavailable state instead of treating a failure as zero", async () => {
    mocks.authenticatedFetch.mockResolvedValue(new Response(null, {
      status: 503,
      statusText: "Service Unavailable",
    }));

    renderNavbar();

    expect(await screen.findByLabelText(
      "Pending inquiry status unavailable: HTTP 503: Service Unavailable",
    )).toBeInTheDocument();
    expect(screen.queryByLabelText("Pending inquiries")).not.toBeInTheDocument();
  });
});
