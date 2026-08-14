import { beforeEach, describe, expect, it, vi } from "vitest";

const { getIdToken, getAppCheckHeader } = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  getAppCheckHeader: vi.fn(),
}));

vi.mock("@/lib/firebaseAuth", () => ({
  auth: { currentUser: { getIdToken } },
}));

vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader,
  getOrInitializeAppCheck: vi.fn().mockResolvedValue(undefined),
}));

import { authenticatedFetch } from "@/lib/api";

describe("simulation authenticated requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIdToken.mockResolvedValue("firebase-id-token");
    getAppCheckHeader.mockResolvedValue({ "X-Firebase-AppCheck": "app-check-token" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  it("attaches Firebase ID and App Check tokens to protected requests", async () => {
    await authenticatedFetch("/api/simulations/gist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer firebase-id-token");
    expect(headers.get("X-Firebase-AppCheck")).toBe("app-check-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("still sends the request when valid token providers return no tokens", async () => {
    getIdToken.mockResolvedValueOnce(undefined);
    getAppCheckHeader.mockResolvedValueOnce({});

    await authenticatedFetch("/api/simulations/gist", { method: "GET" });

    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("X-Firebase-AppCheck")).toBe(false);
  });

  it("does not fake a network request when App Check retrieval rejects", async () => {
    getAppCheckHeader.mockRejectedValueOnce(new Error("App Check unavailable"));

    await expect(authenticatedFetch("/api/simulations/gist")).rejects.toThrow("App Check unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });
});
