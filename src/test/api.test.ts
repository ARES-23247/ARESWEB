import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  getAppCheckHeader: vi.fn(),
}));

vi.mock("../lib/firebaseAuth", () => ({
  auth: { currentUser: { getIdToken: firebaseMocks.getIdToken } },
}));

vi.mock("../lib/firebaseAppCheck", () => ({
  getAppCheckHeader: firebaseMocks.getAppCheckHeader,
  getOrInitializeAppCheck: vi.fn().mockResolvedValue(undefined),
}));

import { authenticatedFetch } from "../lib/api";

describe("authenticatedFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    firebaseMocks.getIdToken.mockResolvedValue("verified-id-token");
    firebaseMocks.getAppCheckHeader.mockResolvedValue({ "X-Firebase-AppCheck": "app-check-token" });
  });

  it("adds verified Firebase Auth and App Check headers", async () => {
    await authenticatedFetch("/api/profiles/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const init = vi.mocked(fetch).mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer verified-id-token");
    expect(headers.get("X-Firebase-AppCheck")).toBe("app-check-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not invent an Authorization header without a signed-in user token", async () => {
    firebaseMocks.getIdToken.mockResolvedValue(undefined);
    await authenticatedFetch("/api/public");

    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-Firebase-AppCheck")).toBe("app-check-token");
  });

  it("preserves a caller-provided App Check header during controlled tests", async () => {
    await authenticatedFetch("/api/test", { headers: { "X-Firebase-AppCheck": "fixture-token" } });
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("X-Firebase-AppCheck")).toBe("fixture-token");
  });

  it("continues without App Check when the client has no token", async () => {
    firebaseMocks.getAppCheckHeader.mockResolvedValue({});
    await authenticatedFetch("/api/public");
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.has("X-Firebase-AppCheck")).toBe(false);
  });
});
