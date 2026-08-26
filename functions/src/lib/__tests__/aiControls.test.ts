import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
}));
mocks.doc.mockReturnValue({ get: mocks.get });
mocks.collection.mockReturnValue({ doc: mocks.doc });

vi.mock("../firebase-admin", () => ({
  adminDb: { collection: mocks.collection },
}));

import {
  isAiGenerationEnabled,
  requireAiGenerationEnabled,
  resetAiControlCache,
} from "../aiControls";

describe("aiControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_GENERATION_DISABLED;
    resetAiControlCache();
    mocks.get.mockResolvedValue({ exists: false, data: () => undefined });
  });

  it("defaults to enabled and caches the server-only control briefly", async () => {
    expect(await isAiGenerationEnabled()).toBe(true);
    expect(await isAiGenerationEnabled()).toBe(true);
    expect(mocks.collection).toHaveBeenCalledWith("system_settings");
    expect(mocks.doc).toHaveBeenCalledWith("ai_generation");
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("honors Firestore and emergency environment disable switches", async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ enabled: false }) });
    expect(await isAiGenerationEnabled()).toBe(false);
    await expect(requireAiGenerationEnabled()).rejects.toEqual(expect.objectContaining({
      status: 503,
      code: "AI_GENERATION_DISABLED",
    }));

    resetAiControlCache();
    process.env.AI_GENERATION_DISABLED = "true";
    expect(await isAiGenerationEnabled()).toBe(false);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("fails the AI control plane closed without affecting other route groups", async () => {
    mocks.get.mockRejectedValue(new Error("firestore unavailable"));

    await expect(isAiGenerationEnabled()).rejects.toEqual(expect.objectContaining({
      status: 503,
      code: "AI_CONTROL_UNAVAILABLE",
    }));
  });
});

