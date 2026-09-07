import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  verifyWaggleSubmission,
  WAGGLE_VERIFICATION_TIMEOUT_MS,
} from "../waggleVerification";
import { WAGGLE_SUBMISSION_BYTES } from "../waggleProof";

type FakeWorker = EventEmitter & {
  terminate: ReturnType<typeof vi.fn<() => Promise<number>>>;
};
const state = vi.hoisted(() => ({ workers: [] as FakeWorker[], fail: false }));
vi.mock("node:worker_threads", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    Worker: class extends EventEmitter {
      terminate = vi.fn(async () => 0);
      constructor() {
        super();
        if (state.fail) throw new Error("unavailable");
        state.workers.push(this);
      }
    },
  };
});
vi.mock("../logger", () => ({ logger: { warn: vi.fn() } }));
const result = {
  version: 1,
  verifierVersion: "waggle-rules-1-5@1",
  rulesVersion: 5,
  contentHash: "a".repeat(64),
  bindingHash: "b".repeat(64),
  bestRescued: 6,
  bestPollen: 0,
  fewestTools: 0,
  allBeesProven: true,
  witnesses: [
    {
      replayHash: "c".repeat(64),
      endTick: 30,
      rescued: 6,
      pollenDelivered: 0,
      peakTools: 0,
    },
  ],
};
const current = () => state.workers.at(-1)!;
afterEach(() => {
  state.fail = false;
  vi.useRealTimers();
});
describe("bounded Waggle verification worker", () => {
  it("rejects non-text and UTF-8 payload overflow before starting a worker", async () => {
    await expect(
      verifyWaggleSubmission(null as unknown as string),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      verifyWaggleSubmission("é".repeat(WAGGLE_SUBMISSION_BYTES)),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("releases a failed startup and accepts only a validated result while busy", async () => {
    state.fail = true;
    await expect(verifyWaggleSubmission("{}")).rejects.toMatchObject({
      status: 503,
    });
    state.fail = false;
    const pending = verifyWaggleSubmission("{}");
    await expect(verifyWaggleSubmission("{}")).rejects.toMatchObject({
      code: "WAGGLE_VERIFIER_BUSY",
    });
    current().emit("message", { type: "verified", result });
    current().emit("error", new Error("late event"));
    current().emit("exit", 0);
    await expect(pending).resolves.toEqual(result);
  });
  it.each([
    null,
    { type: "verified", result: {} },
    { type: "rejected", code: "internal" },
  ])("rejects an invalid worker packet %j", async (packet) => {
    const pending = verifyWaggleSubmission("{}");
    current().emit("message", packet);
    await expect(pending).rejects.toMatchObject({ status: 503 });
  });
  it("returns a safe proof rejection", async () => {
    const pending = verifyWaggleSubmission("{}");
    current().emit("message", { type: "rejected", code: "replay" });
    await expect(pending).rejects.toMatchObject({
      code: "WAGGLE_PROOF_REJECTED",
    });
  });
  it.each(["error", "exit"])("fails closed on early %s", async (event) => {
    const pending = verifyWaggleSubmission("{}");
    current().emit(event, event === "error" ? new Error("worker failed") : 1);
    await expect(pending).rejects.toMatchObject({ status: 503 });
  });
  it("terminates work at the deadline", async () => {
    vi.useFakeTimers();
    const pending = expect(verifyWaggleSubmission("{}")).rejects.toMatchObject({
      code: "WAGGLE_VERIFICATION_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(WAGGLE_VERIFICATION_TIMEOUT_MS);
    await pending;
    expect(current().terminate).toHaveBeenCalledOnce();
  });
  it("rejects even a valid packet arriving after the monotonic deadline", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const pending = verifyWaggleSubmission("{}");
    clock.mockReturnValue(WAGGLE_VERIFICATION_TIMEOUT_MS);
    current().emit("message", { type: "verified", result });
    await expect(pending).rejects.toMatchObject({
      code: "WAGGLE_VERIFICATION_TIMEOUT",
    });
  });
  it("holds the capacity slot until a worker actually exits after termination failure", async () => {
    const pending = verifyWaggleSubmission("{}");
    const worker = current();
    worker.terminate.mockRejectedValueOnce(new Error("termination failed"));
    worker.emit("message", { type: "verified", result });
    await expect(pending).rejects.toMatchObject({ status: 503 });
    await expect(verifyWaggleSubmission("{}")).rejects.toMatchObject({
      code: "WAGGLE_VERIFIER_BUSY",
    });
    worker.emit("exit", 0);
    const next = verifyWaggleSubmission("{}");
    current().emit("message", { type: "verified", result });
    await expect(next).resolves.toEqual(result);
  });
});
