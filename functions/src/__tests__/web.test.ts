import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocument = vi.fn();
vi.mock("../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: getDocument })) })),
  },
}));
vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { handleWebRequest } from "../web";

const runWeb = handleWebRequest as unknown as (req: unknown, res: unknown) => Promise<void>;

function responseDouble() {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    set: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.set.mockReturnValue(response);
  response.type.mockReturnValue(response);
  return response;
}

describe("dynamic web function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an injected shell for a published record", async () => {
    getDocument.mockResolvedValue({
      exists: true,
      data: () => ({ status: "published", isDeleted: 0, title: "Build Update", snippet: "Latest progress" }),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Old</title><meta name="description" content="old"><meta property="og:title" content="old"><meta property="og:description" content="old"><meta property="og:type" content="website"></head><body><div id="root"></div></body></html>',
    }));
    const response = responseDouble();

    await runWeb(
      { method: "GET", path: "/blog/build-update" },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining("Build Update | ARES 23247"));
  });

  it("returns a genuine 404 for an invalid or missing public record", async () => {
    const invalidResponse = responseDouble();
    await runWeb(
      { method: "GET", path: "/unknown/path" },
      invalidResponse,
    );
    expect(invalidResponse.status).toHaveBeenCalledWith(404);

    getDocument.mockResolvedValue({ exists: false, data: () => undefined });
    const missingResponse = responseDouble();
    await runWeb(
      { method: "GET", path: "/robots/missing" },
      missingResponse,
    );
    expect(missingResponse.status).toHaveBeenCalledWith(404);
    expect(missingResponse.send).toHaveBeenCalledWith(expect.stringContaining("Page not found"));
  });

  it("rejects unsupported methods", async () => {
    const response = responseDouble();
    await runWeb(
      { method: "POST", path: "/blog/build-update" },
      response,
    );
    expect(response.setHeader).toHaveBeenCalledWith("Allow", "GET, HEAD");
    expect(response.status).toHaveBeenCalledWith(405);
  });

  it("returns 503 rather than a false 404 when Firestore fails", async () => {
    getDocument.mockRejectedValue(new Error("database unavailable"));
    const response = responseDouble();
    await runWeb(
      { method: "GET", path: "/events/outreach" },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
