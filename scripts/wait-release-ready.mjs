import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGcloud } from "./verify-production-deployment.mjs";
import { validateHealthResponse } from "./check-production-health.mjs";

export function indexKey(index) {
  const collection =
    index.collectionGroup ??
    index.name?.split("/collectionGroups/")[1]?.split("/")[0];
  if (!collection || !Array.isArray(index.fields))
    throw new Error("Malformed Firestore index");
  // Firestore appends its implicit document-name tie breaker. Explicit name
  // ordering in the source contract must still match exactly.
  return {
    collection,
    scope: index.queryScope,
    fields: index.fields.map(
      ({ fieldPath, order, arrayConfig, vectorConfig }) => ({
        fieldPath,
        order,
        arrayConfig,
        vectorConfig,
      }),
    ),
  };
}

export function pendingIndexes(declared, live) {
  if (
    !Array.isArray(declared.indexes) ||
    !declared.indexes.length ||
    !Array.isArray(live)
  )
    throw new Error("Invalid index inventory");
  return declared.indexes.flatMap((index) => {
    const expected = indexKey(index);
    const actual = live.find((candidate) => {
      const value = indexKey(candidate);
      const fields = expected.fields.some(
        (field) => field.fieldPath === "__name__",
      )
        ? value.fields
        : value.fields.filter((field) => field.fieldPath !== "__name__");
      return (
        value.collection === expected.collection &&
        value.scope === expected.scope &&
        JSON.stringify(fields) === JSON.stringify(expected.fields)
      );
    });
    if (actual?.state === "NEEDS_REPAIR")
      throw new Error(`Index needs repair: ${expected.collection}`);
    return actual?.state === "READY"
      ? []
      : [`${expected.collection}: ${actual?.state ?? "MISSING"}`];
  });
}

export async function waitReady(
  check,
  {
    timeoutMs = 600_000,
    intervalMs = 15_000,
    now = Date.now,
    sleep = (milliseconds) =>
      new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
    log = console.log,
  } = {},
) {
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0
  )
    throw new Error("Invalid readiness deadline");
  const deadline = now() + timeoutMs;
  let last;
  do {
    const result = await check();
    if (result.length === 0) return;
    last = result.join("; ");
    log(`Waiting for release readiness: ${last}`);
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMs, remaining));
  } while (now() < deadline);
  throw new Error(`Release readiness deadline exceeded: ${last}`);
}

export async function gameReady(origin, fetchImpl = fetch) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    (!url.hostname.endsWith(".a.run.app") &&
      url.origin !== "https://aresfirst-portal.web.app") ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      "Expected a direct HTTPS Cloud Run or production Hosting origin",
    );
  for (const path of ["/api/buzzello/health", "/api/waggle-way/gardens"]) {
    try {
      const response = await fetchImpl(new URL(path, url), {
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      validateHealthResponse(
        {
          status: 200,
          contentType: "application/json",
          validJson: true,
          bodyIncludes: path.endsWith("/health")
            ? ["healthy", "game-api"]
            : ["gardens"],
          headerIncludes: { "cache-control": ["no-store"] },
        },
        response,
        body,
      );
    } catch {
      return [`game service ${path} has not passed its public health contract`];
    }
  }
  return [];
}

export async function main(
  argv = process.argv.slice(2),
  {
    read = readFileSync,
    gcloud = runGcloud,
    wait = waitReady,
    fetchImpl = fetch,
  } = {},
) {
  if (argv.length === 1 && argv[0] === "--indexes") {
    const declared = JSON.parse(read("firestore.indexes.json", "utf8"));
    await wait(async () =>
      pendingIndexes(
        declared,
        JSON.parse(
          gcloud(
            "gcloud",
            [
              "firestore",
              "indexes",
              "composite",
              "list",
              "--project=aresfirst-portal",
              "--format=json",
            ],
            { encoding: "utf8", timeout: 45_000 },
          ),
        ),
      ),
    );
  } else if (argv.length === 2 && argv[0] === "--game-origin") {
    await wait(() => gameReady(argv[1], fetchImpl), { timeoutMs: 300_000 });
  } else if (argv.length === 1 && argv[0] === "--hosting") {
    await wait(() => gameReady("https://aresfirst-portal.web.app", fetchImpl), {
      timeoutMs: 300_000,
    });
  } else throw new Error("Use --indexes, --hosting or --game-origin URL");
  console.log("Release readiness passed");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
