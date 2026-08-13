import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string } | null },
  currentUser: null as null | {
    uid: string;
    email: string;
    displayName: string;
    photoURL: null;
  },
  onAuthStateChanged: vi.fn(),
  authenticatedFetch: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/firebaseAuth", () => ({ auth: mocks.auth }));
vi.mock("../lib/api", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("../utils/logger", () => ({ logger: mocks.logger }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

import { AuthProvider, useAuth } from "../context/AuthContext";

function SessionProbe() {
  const { user, authorizedUser, loading } = useAuth();
  return (
    <output aria-label="session state">
      {loading
        ? "loading"
        : `${user?.uid || "signed-out"}:${authorizedUser?.role || "no-role"}`}
    </output>
  );
}

describe("AuthProvider backend session linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.currentUser = {
      uid: "firebase-user-1",
      email: "member@example.com",
      displayName: "Private Provider Name",
      photoURL: null,
    };
    mocks.onAuthStateChanged.mockImplementation(
      (_auth, callback: (user: typeof mocks.currentUser) => void) => {
        queueMicrotask(() => callback(mocks.currentUser));
        return vi.fn();
      },
    );
  });

  it("links an authenticated Firebase user through the verified session API", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          authorizedUser: {
            email: "member@example.com",
            role: "admin",
            name: "ARES Member",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("firebase-user-1:admin"),
    ).toBeInTheDocument();
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/profiles/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("keeps the user signed in but grants no role when session linking fails", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      new Response(null, {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("firebase-user-1:no-role"),
    ).toBeInTheDocument();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      "Session linking endpoint rejected the request.",
      { status: 503 },
    );
    expect(JSON.stringify(mocks.logger.warn.mock.calls)).not.toContain(
      "member@example.com",
    );
  });

  it("does not log the provider email when the account lacks authorization", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify({ authorizedUser: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("firebase-user-1:no-role"),
    ).toBeInTheDocument();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      "Authenticated Firebase user has no active authorization record.",
    );
    expect(JSON.stringify(mocks.logger.warn.mock.calls)).not.toContain(
      "member@example.com",
    );
  });
});
