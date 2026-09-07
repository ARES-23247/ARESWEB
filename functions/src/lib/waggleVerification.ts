import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "./logger";
import {
  WAGGLE_SUBMISSION_BYTES,
  WAGGLE_PROOF_MESSAGES,
  WaggleVerificationSchema,
  type WaggleProofCode,
  type WaggleVerification,
} from "./waggleProof";

export const WAGGLE_VERIFICATION_TIMEOUT_MS = 5_000;
let activeWorker: symbol | null = null;

/** Call after current-member authentication, App Check and distributed quotas. No persistence or public attestation is implied. */
export async function verifyWaggleSubmission(
  payload: string,
): Promise<WaggleVerification> {
  if (typeof payload !== "string")
    throw new ApiError(
      400,
      WAGGLE_PROOF_MESSAGES.payload,
      "WAGGLE_PROOF_INVALID",
    );
  if (Buffer.byteLength(payload, "utf8") > WAGGLE_SUBMISSION_BYTES)
    throw new ApiError(
      413,
      WAGGLE_PROOF_MESSAGES.size,
      "WAGGLE_PROOF_TOO_LARGE",
    );
  if (activeWorker)
    throw new ApiError(
      503,
      "Garden verification is busy. Try again shortly.",
      "WAGGLE_VERIFIER_BUSY",
    );
  const lease = Symbol("waggle-verification");
  activeWorker = lease;
  const release = () => {
    if (activeWorker === lease) activeWorker = null;
  };
  const deadline = performance.now() + WAGGLE_VERIFICATION_TIMEOUT_MS;
  let worker: Worker;
  try {
    worker = new Worker(join(__dirname, "waggleVerification.worker.js"), {
      workerData: payload,
      resourceLimits: {
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 4,
      },
    });
  } catch {
    release();
    throw new ApiError(
      503,
      "Garden verification is temporarily unavailable.",
      "WAGGLE_VERIFIER_UNAVAILABLE",
    );
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let exited = false;
    const finish = async (
      result: WaggleVerification | null,
      error?: ApiError,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        await worker.terminate();
        exited = true;
      } catch {
        logger.warn(
          "waggle-verification",
          "Verification worker termination failed",
        );
      } finally {
        if (exited) release();
      }
      if (error) reject(error);
      else if (!exited)
        reject(
          new ApiError(
            503,
            "Garden verification is temporarily unavailable.",
            "WAGGLE_VERIFIER_UNAVAILABLE",
          ),
        );
      else resolve(result!);
    };
    const unavailable = () => {
      void finish(
        null,
        new ApiError(
          503,
          "Garden verification is temporarily unavailable.",
          "WAGGLE_VERIFIER_UNAVAILABLE",
        ),
      );
    };
    const timeout = () => {
      void finish(
        null,
        new ApiError(
          422,
          "This recording exceeds the verification time limit. Shorten the attempt or simplify the garden and try again.",
          "WAGGLE_VERIFICATION_TIMEOUT",
        ),
      );
    };
    const timer = setTimeout(
      timeout,
      Math.max(0, deadline - performance.now()),
    );
    worker.once("message", (message: unknown) => {
      if (performance.now() >= deadline) {
        timeout();
        return;
      }
      if (message && typeof message === "object") {
        const packet = message as Record<string, unknown>;
        if (packet.type === "verified") {
          const result = WaggleVerificationSchema.safeParse(packet.result);
          if (result.success) {
            void finish(result.data);
            return;
          }
        }
        if (
          packet.type === "rejected" &&
          typeof packet.code === "string" &&
          Object.hasOwn(WAGGLE_PROOF_MESSAGES, packet.code)
        ) {
          void finish(
            null,
            new ApiError(
              422,
              WAGGLE_PROOF_MESSAGES[packet.code as WaggleProofCode],
              "WAGGLE_PROOF_REJECTED",
            ),
          );
          return;
        }
      }
      unavailable();
    });
    worker.once("error", unavailable);
    worker.once("exit", () => {
      exited = true;
      if (settled) release();
      else unavailable();
    });
  });
}
