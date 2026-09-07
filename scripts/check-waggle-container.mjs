import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Executes the deployed worker; no credentials, database or network access.
const require = createRequire(import.meta.url);
const compiledRoot = resolve(process.argv[2] ?? "functions/lib");
const { createBlankLevel } = require(resolve(compiledRoot, "generated/games/waggle-way/level.js"));
const { createRun, applyCommand, stepRun } = require(resolve(compiledRoot, "generated/games/waggle-way/engine.js"));
const { captureReplay } = require(resolve(compiledRoot, "generated/games/waggle-way/replay.js"));
const { verifyWaggleSubmission } = require(resolve(compiledRoot, "lib/waggleVerification.js"));

const level = createBlankLevel(5);
let run = applyCommand(level, createRun(level), { type: "start" });
while (run.phase !== "finished" && run.tick < 1800) run = stepRun(level, run);
assert.equal(run.won, true, "Container smoke fixture must reach its rescue goal");
const payload = JSON.stringify({ level, replays: [captureReplay(level, run)] });
const started = performance.now();
const result = await verifyWaggleSubmission(payload);
assert.equal(result.bestRescued, level.population);
assert.equal(result.allBeesProven, true);
assert.equal(result.rulesVersion, 5);
await assert.rejects(verifyWaggleSubmission("{"), { code: "WAGGLE_PROOF_REJECTED" });
// Rejection must terminate the worker and release its single verification slot.
assert.deepEqual(await verifyWaggleSubmission(payload), result);
console.log(JSON.stringify({
  check: "waggle-container-worker",
  rescued: result.bestRescued,
  elapsedMs: Math.round(performance.now() - started),
  rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
}));
