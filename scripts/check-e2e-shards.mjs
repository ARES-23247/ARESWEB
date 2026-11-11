import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function testIds(report) {
  const ids = [];
  function visit(suite, parents = []) {
    const nextParents = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs ?? []) {
      const specKey = spec.file
        ? `${spec.file}:${spec.line}:${spec.column}:${[...nextParents, spec.title].join(" > ")}`
        : spec.id;
      for (const test of spec.tests ?? [])
        ids.push(`${specKey}:${test.projectId}`);
    }
    for (const child of suite.suites ?? []) visit(child, nextParents);
  }
  visit(report);
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error("Empty or duplicate browser test inventory");
  return ids.sort();
}

export function verifyShards(inventory, reports) {
  const expected = testIds(inventory);
  if (reports.length !== 2) throw new Error("Both browser shards are required");
  const actual = [];
  for (let index = 0; index < 2; index++) {
    const report = reports[index];
    if (
      report.config?.shard?.current !== index + 1 ||
      report.config.shard.total !== 2
    )
      throw new Error("Wrong browser shard identity");
    if (
      report.errors?.length ||
      !report.stats ||
      report.stats.unexpected !== 0 ||
      report.stats.skipped !== 0 ||
      report.stats.expected + report.stats.flaky <= 0
    )
      throw new Error("Browser shard did not pass every selected test");
    actual.push(...testIds(report));
  }
  if (JSON.stringify(actual.sort()) !== JSON.stringify(expected))
    throw new Error(
      "Browser shards do not cover the complete test inventory exactly once",
    );
  return expected.length;
}

export function main(root = process.argv[2] ?? "ci-report") {
  const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
  const inventory = read("e2e-shard-1/inventory.json");
  if (
    JSON.stringify(testIds(inventory)) !==
    JSON.stringify(testIds(read("e2e-shard-2/inventory.json")))
  )
    throw new Error("Browser shards discovered different inventories");
  const count = verifyShards(inventory, [
    read("e2e-shard-1/results.json"),
    read("e2e-shard-2/results.json"),
  ]);
  console.log(`Both shards passed all ${count} browser tests exactly once`);
  return count;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
