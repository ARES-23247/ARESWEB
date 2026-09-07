import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { main, testIds, verifyShards } from "./check-e2e-shards.mjs";

const report = (id, current) => ({
  config: { shard: { current, total: 2 } },
  stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
  errors: [],
  suites: [{ specs: [{ id, tests: [{ projectId: "chromium" }] }] }],
});
const inventory = {
  suites: [...report("a", 1).suites, ...report("b", 2).suites],
};
it("requires both correct shards and exact complete test identity coverage", () => {
  expect(verifyShards(inventory, [report("a", 1), report("b", 2)])).toBe(2);
  expect(() => verifyShards(inventory, [report("a", 1)])).toThrow("Both");
  expect(() =>
    verifyShards(inventory, [report("a", 2), report("b", 2)]),
  ).toThrow("identity");
  expect(() =>
    verifyShards(inventory, [report("a", 1), report("a", 2)]),
  ).toThrow("exactly once");
  expect(() =>
    verifyShards(inventory, [
      report("a", 1),
      {
        ...report("b", 2),
        stats: { expected: 0, flaky: 0, unexpected: 0, skipped: 1 },
      },
    ]),
  ).toThrow("pass every");
  expect(() =>
    verifyShards(inventory, [
      report("a", 1),
      { ...report("b", 2), errors: ["crash"] },
    ]),
  ).toThrow("pass every");
  expect(() => testIds({})).toThrow("Empty");
  expect(() => testIds({ suites: [report("a", 1), report("a", 1)] })).toThrow(
    "duplicate",
  );
});
it("loads isolated artifact directories and rejects missing or differing inventories", () => {
  const root = mkdtempSync(join(tmpdir(), "ares-shards-"));
  try {
    expect(() => main(root)).toThrow();
    for (let shard = 1; shard <= 2; shard++) {
      mkdirSync(join(root, `e2e-shard-${shard}`));
      writeFileSync(
        join(root, `e2e-shard-${shard}`, "inventory.json"),
        JSON.stringify(inventory),
      );
      writeFileSync(
        join(root, `e2e-shard-${shard}`, "results.json"),
        JSON.stringify(report(shard === 1 ? "a" : "b", shard)),
      );
    }
    expect(main(root)).toBe(2);
    writeFileSync(
      join(root, "e2e-shard-2", "inventory.json"),
      JSON.stringify(report("x", 2)),
    );
    expect(() => main(root)).toThrow("different inventories");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
