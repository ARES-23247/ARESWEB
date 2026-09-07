import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { createBlankLevel } from "../../generated/games/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
} from "../../generated/games/waggle-way/engine";
import { captureReplay } from "../../generated/games/waggle-way/replay";

it("runs the compiled deployment worker against real canonical rules", () => {
  // A separate process exercises the deployment runtime without merging compiled
  // source maps into the independently instrumented TypeScript unit coverage.
  // CI builds Functions first; a missing deployment worker is a failure.
  const level = createBlankLevel();
  let run = applyCommand(level, createRun(level), { type: "start" });
  while (run.phase !== "finished" && run.tick < 1800) run = stepRun(level, run);
  const script = `
    const { readFileSync } = require("node:fs");
    const { verifyWaggleSubmission } = require(process.argv[1]);
    (async () => {
      const verified = await verifyWaggleSubmission(readFileSync(0, "utf8"));
      let rejected;
      try { await verifyWaggleSubmission("{}"); }
      catch (error) { rejected = error.code; }
      process.stdout.write(JSON.stringify({ verified, rejected }));
    })().catch(() => { process.exitCode = 1; });
  `;
  const output = execFileSync(
    process.execPath,
    ["-e", script, resolve("lib/lib/waggleVerification.js")],
    {
      input: JSON.stringify({ level, replays: [captureReplay(level, run)] }),
      encoding: "utf8",
      timeout: 8000,
      windowsHide: true,
    },
  );
  const { verified, rejected } = JSON.parse(output);
  expect(verified.bestRescued).toBe(level.population);
  expect(verified.contentHash).toMatch(/^[a-f0-9]{64}$/u);
  expect(rejected).toBe("WAGGLE_PROOF_REJECTED");
}, 10000);
