import { beforeEach, describe, expect, it, vi } from "vitest";

const { getIdToken, getAppCheckHeader } = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  getAppCheckHeader: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  auth: { currentUser: { getIdToken } },
  getAppCheckHeader,
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
});
