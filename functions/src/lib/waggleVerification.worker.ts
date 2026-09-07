import { parentPort, workerData } from "node:worker_threads";
import { evaluateWaggleProof, WaggleProofError } from "./waggleProof";

try {
  const result = evaluateWaggleProof(workerData as string);
  parentPort!.postMessage({ type: "verified", result });
} catch (error) {
  parentPort!.postMessage({
    type: "rejected",
    code: error instanceof WaggleProofError ? error.code : "internal",
  });
}
