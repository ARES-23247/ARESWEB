import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);
// Resolve the transitive dependency from its actual consumer under pnpm's
// isolated linker, rather than relying on a root-level hoisted installation.
const firebaseRequire = createRequire(require.resolve("firebase-tools/package.json"));

describe("dependency security contracts", () => {
  it("preserves Pub/Sub trace propagation and bounds inbound baggage entries", () => {
    const pubsubRequire = createRequire(firebaseRequire.resolve("@google-cloud/pubsub/package.json"));
    const api = pubsubRequire("@opentelemetry/api") as {
      ROOT_CONTEXT: unknown;
      trace: { getSpanContext(context: unknown): { traceId: string } | undefined };
      propagation: { getBaggage(context: unknown): { getAllEntries(): unknown[] } | undefined };
    };
    type Getter = { get(carrier: Record<string, string>, key: string): string; keys(carrier: Record<string, string>): string[] };
    type Propagator = { extract(context: unknown, carrier: Record<string, string>, getter: Getter): unknown };
    const core = pubsubRequire("@opentelemetry/core") as {
      W3CTraceContextPropagator: new () => Propagator;
      W3CBaggagePropagator: new () => Propagator;
    };
    const getter: Getter = { get: (carrier, key) => carrier[key], keys: Object.keys };
    const traceContext = new core.W3CTraceContextPropagator().extract(api.ROOT_CONTEXT, {
      traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
    }, getter);
    expect(api.trace.getSpanContext(traceContext)?.traceId).toBe("0123456789abcdef0123456789abcdef");
    const baggageContext = new core.W3CBaggagePropagator().extract(api.ROOT_CONTEXT, {
      baggage: Array.from({ length: 200 }, (_, index) => `item${index}=value`).join(","),
    }, getter);
    const entries = api.propagation.getBaggage(baggageContext)?.getAllEntries();
    expect(entries).toBeDefined();
    expect(entries).toHaveLength(180);
  });

  it("preserves the CLI CSV callback API and treats duplicate prototype columns as data", async () => {
    const { parse } = firebaseRequire("csv-parse") as {
      parse(input: string, options: Record<string, unknown>, callback: (
        error: Error | undefined, records: Record<string, unknown>[],
      ) => void): unknown;
    };
    const records = await new Promise<Record<string, unknown>[]>((resolveRecords, reject) => {
      parse('__proto__,__proto__,label\nfirst,second,"piece, one"\n', {
        columns: true,
        group_columns_by_name: true,
      }, (error, values) => error ? reject(error) : resolveRecords(values));
    });
    expect(records).toHaveLength(1);
    expect(Object.getPrototypeOf(records[0])).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(records[0], "__proto__")?.value)
      .toEqual(["first", "second"]);
    expect(records[0].label).toBe("piece, one");
  });

  it("rejects excessive nesting through the CLI's real parser and public pick filter", async () => {
    const { parser } = firebaseRequire("stream-json") as { parser(): Transform };
    const { pick } = firebaseRequire("stream-json/filters/Pick") as {
      pick(options: { filter: string }): Transform;
    };
    const deepJson = '{"meta":'.repeat(1050) + '1' + '}'.repeat(1050);
    await expect(pipeline(
      Readable.from([deepJson]), parser(), pick({ filter: "data" }),
      new Writable({ objectMode: true, write(_chunk, _encoding, callback) { callback(); } }),
    )).rejects.toThrow("JSON nesting depth exceeds maxDepth (1024)");
  });

  it("keeps every qs resolution on the patched release line", () => {
    const workspace = readFileSync(resolve(workspaceRoot, "pnpm-workspace.yaml"), "utf8");
    const functionsPackage = JSON.parse(
      readFileSync(resolve(workspaceRoot, "functions/package.json"), "utf8"),
    ) as { overrides?: Record<string, string> };
    const functionsLock = JSON.parse(
      readFileSync(resolve(workspaceRoot, "functions/package-lock.json"), "utf8"),
    ) as { packages?: Record<string, { version?: string }> };

    expect(workspace).toMatch(/^\s+qs: \^6\.16\.0$/mu);
    expect(functionsPackage.overrides?.qs).toBe("^6.16.0");
    expect(functionsLock.packages?.["node_modules/qs"]?.version).toBe("6.16.0");
  });

  it("backports a bounded filter depth while firebase-tools requires stream-json 1.x", async () => {
    const workspace = readFileSync(resolve(workspaceRoot, "pnpm-workspace.yaml"), "utf8");
    const patch = readFileSync(
      resolve(workspaceRoot, "patches/stream-json@1.9.1.patch"),
      "utf8",
    );

    expect(workspace).toContain(
      "stream-json@1.9.1: patches/stream-json@1.9.1.patch",
    );
    expect(patch).toContain("DEFAULT_MAX_DEPTH = 1024");

    type FilterToken = { name: string; value?: string };
    type FilterStream = {
      once(event: "error", listener: (error: Error) => void): FilterStream;
      write(token: FilterToken): boolean;
    };
    const FilterBase = firebaseRequire("stream-json/filters/FilterBase") as new (
      options: { filter: string; maxDepth: number },
    ) => FilterStream;
    class TestFilter extends FilterBase {
      _checkChunk(): boolean {
        return false;
      }
    }

    expect(() => new TestFilter({ filter: "missing", maxDepth: -1 })).toThrow(RangeError);

    const stream = new TestFilter({ filter: "missing", maxDepth: 2 });
    const errorPromise = new Promise<Error>((resolveError) => {
      stream.once("error", resolveError);
    });
    for (const token of [
      { name: "startObject" },
      { name: "keyValue", value: "a" },
      { name: "startObject" },
      { name: "keyValue", value: "b" },
      { name: "startObject" },
      { name: "keyValue", value: "c" },
    ]) {
      stream.write(token);
    }

    const error = await errorPromise;
    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).toContain("maxDepth (2)");
  });

  it("ignores Codex attachment staging without deleting user files", () => {
    const gitignore = readFileSync(resolve(workspaceRoot, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.codex-remote-attachments\/$/mu);
  });
});
