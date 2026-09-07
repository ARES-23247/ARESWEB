import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ postMessage: vi.fn(), evaluate: vi.fn() }));
vi.mock("node:worker_threads", () => ({
  workerData: "bounded payload",
  parentPort: { postMessage: state.postMessage },
}));
vi.mock("../waggleProof", async (importOriginal) => {
  const original = await importOriginal<typeof import("../waggleProof")>();
  return { ...original, evaluateWaggleProof: state.evaluate };
});
beforeEach(() => {
  vi.resetModules();
  state.postMessage.mockClear();
});
it("posts canonical verification results", async () => {
  state.evaluate.mockReturnValue({ bindingHash: "proof" });
  await import("../waggleVerification.worker");
  expect(state.evaluate).toHaveBeenCalledWith("bounded payload");
  expect(state.postMessage).toHaveBeenCalledWith({
    type: "verified",
    result: { bindingHash: "proof" },
  });
});
it("exposes only known rejection codes or a generic internal code", async () => {
  const { WaggleProofError } = await import("../waggleProof");
  state.evaluate.mockImplementationOnce(() => {
    throw new WaggleProofError("replay");
  });
  await import("../waggleVerification.worker");
  expect(state.postMessage).toHaveBeenCalledWith({
    type: "rejected",
    code: "replay",
  });
  vi.resetModules();
  state.evaluate.mockImplementationOnce(() => {
    throw new Error("private detail");
  });
  await import("../waggleVerification.worker");
  expect(state.postMessage).toHaveBeenLastCalledWith({
    type: "rejected",
    code: "internal",
  });
});
