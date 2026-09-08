import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string } | null },
  currentUser: null as null | {
    uid: string;
    email: string;
    displayName: string;
    photoURL: null;
  },
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  getOrInitializeAppCheck: vi.fn(),
  authenticatedFetch: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/firebaseAuth", () => ({ auth: mocks.auth }));
vi.mock("../lib/api", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("../lib/firebaseAppCheck", () => ({
  getOrInitializeAppCheck: mocks.getOrInitializeAppCheck,
}));
vi.mock("../utils/logger", () => ({ logger: mocks.logger }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: mocks.signInWithPopup,
  signOut: vi.fn(),
}));

import { AuthProvider, useAuth } from "../context/AuthContext";
import AuthErrorNotice from "../components/navigation/AuthErrorNotice";

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

function LoginProbe() {
  const { loginWithGoogle } = useAuth();
  return <button onClick={() => void loginWithGoogle()}>Sign in</button>;
}

describe("AuthProvider backend session linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.getOrInitializeAppCheck.mockResolvedValue(undefined);
    mocks.signInWithPopup.mockResolvedValue(undefined);
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

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("opens Google Sign-In without waiting for App Check initialization", async () => {
    mocks.currentUser = null;
    mocks.getOrInitializeAppCheck.mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.signInWithPopup).toHaveBeenCalledTimes(1));
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
        signal: expect.any(AbortSignal),
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("ends a stalled production Auth restore with a visible recovery action", async () => {
    vi.stubEnv("DEV", false);
    vi.useFakeTimers();
    mocks.onAuthStateChanged.mockImplementation(() => vi.fn());
    render(<AuthProvider><SessionProbe /><AuthErrorNotice /></AuthProvider>);

    await act(() => vi.advanceTimersByTimeAsync(20_000));

    expect(screen.getByLabelText("session state")).toHaveTextContent("signed-out:no-role");
    expect(screen.getByRole("alert")).toHaveTextContent("Session verification timed out");
    expect(screen.getByRole("button", { name: "Reload sign-in" })).toBeInTheDocument();
  });

  it("aborts stalled session verification and ignores its late authorization result", async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    mocks.authenticatedFetch.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    render(<AuthProvider><SessionProbe /><AuthErrorNotice /></AuthProvider>);
    await act(async () => {});
    const signal = mocks.authenticatedFetch.mock.calls[0][1].signal as AbortSignal;

    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(signal.aborted).toBe(true);
    expect(screen.getByLabelText("session state")).toHaveTextContent("firebase-user-1:no-role");
    expect(screen.getByRole("alert")).toHaveTextContent("Session verification timed out");

    await act(async () => { finish(new Response(JSON.stringify({ authorizedUser: { role: "admin" } }))); });
    expect(screen.getByLabelText("session state")).toHaveTextContent("firebase-user-1:no-role");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not restore a prior account's role after a signed-out auth event", async () => {
    let finish!: (response: Response) => void;
    mocks.authenticatedFetch.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    render(<AuthProvider><SessionProbe /></AuthProvider>);
    await waitFor(() => expect(mocks.authenticatedFetch).toHaveBeenCalled());
    const notifyAuth = mocks.onAuthStateChanged.mock.calls[0][1];
    await act(async () => { await notifyAuth(null); });
    await act(async () => { finish(new Response(JSON.stringify({ authorizedUser: { role: "admin" } }))); });
    expect(screen.getByLabelText("session state")).toHaveTextContent("signed-out:no-role");
  });

  it("bounds a stalled response body and permits a fresh verified session after recovery", async () => {
    vi.useFakeTimers();
    let finishBody!: (value: unknown) => void;
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: () => new Promise((resolve) => { finishBody = resolve; }) });
    render(<AuthProvider><SessionProbe /><AuthErrorNotice /></AuthProvider>);
    await act(async () => {});
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    await act(async () => { finishBody({ authorizedUser: { role: "admin" } }); });
    expect(screen.getByLabelText("session state")).toHaveTextContent("firebase-user-1:no-role");

    mocks.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ authorizedUser: { role: "member" } })));
    await act(async () => { await mocks.onAuthStateChanged.mock.calls[0][1](mocks.currentUser); });
    expect(screen.getByLabelText("session state")).toHaveTextContent("firebase-user-1:member");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
