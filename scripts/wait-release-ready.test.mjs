import { describe, it, expect, vi } from "vitest";
import {
  gameReady,
  indexKey,
  main,
  pendingIndexes,
  waitReady,
} from "./wait-release-ready.mjs";

const declared = {
  indexes: [
    {
      collectionGroup: "gardens",
      queryScope: "COLLECTION",
      fields: [{ fieldPath: "publishedAt", order: "DESCENDING" }],
    },
  ],
};
const live = (state) => [
  {
    name: "projects/p/databases/(default)/collectionGroups/gardens/indexes/i",
    queryScope: "COLLECTION",
    state,
    fields: [
      ...declared.indexes[0].fields,
      { fieldPath: "__name__", order: "DESCENDING" },
    ],
  },
];
const response = () =>
  new Response(
    JSON.stringify({ status: "healthy", service: "game-api", gardens: [] }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    },
  );

describe("release readiness", () => {
  it("requires every declared index and compares explicit ordering", () => {
    expect(pendingIndexes(declared, live("READY"))).toEqual([]);
    expect(pendingIndexes(declared, [])).toEqual(["gardens: MISSING"]);
    expect(pendingIndexes(declared, live("CREATING"))).toEqual([
      "gardens: CREATING",
    ]);
    expect(() => pendingIndexes(declared, live("NEEDS_REPAIR"))).toThrow(
      "repair",
    );
    expect(() => pendingIndexes({}, [])).toThrow("inventory");
    expect(() => indexKey({})).toThrow("Malformed");
    const explicit = {
      indexes: [{ ...declared.indexes[0], fields: live("READY")[0].fields }],
    };
    expect(pendingIndexes(explicit, live("READY"))).toEqual([]);
    const wrong = live("READY");
    wrong[0].fields[1].order = "ASCENDING";
    expect(pendingIndexes(explicit, wrong)).toEqual(["gardens: MISSING"]);
    expect(
      pendingIndexes(declared, [
        { ...live("READY")[0], queryScope: "COLLECTION_GROUP" },
      ]),
    ).toEqual(["gardens: MISSING"]);
  });
  it("waits through creation, fails on deadline and never suppresses inventory errors", async () => {
    let time = 0;
    const options = {
      timeoutMs: 10,
      intervalMs: 5,
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      log: vi.fn(),
    };
    const check = vi
      .fn()
      .mockResolvedValueOnce(["CREATING"])
      .mockResolvedValue([]);
    await waitReady(check, options);
    expect(check).toHaveBeenCalledTimes(2);
    await expect(waitReady(async () => ["MISSING"], options)).rejects.toThrow(
      "deadline",
    );
    await expect(
      waitReady(async () => {
        throw new Error("permission denied");
      }, options),
    ).rejects.toThrow("permission denied");
    await expect(waitReady(check, { timeoutMs: 0 })).rejects.toThrow(
      "deadline",
    );
    await waitReady(
      vi.fn().mockResolvedValueOnce(["cold"]).mockResolvedValue([]),
      { intervalMs: 1 },
    );
    let slowTime = 0;
    await expect(
      waitReady(
        async () => {
          slowTime += 20;
          return ["slow"];
        },
        { ...options, now: () => slowTime },
      ),
    ).rejects.toThrow("deadline");
  });
  it("requires valid uncached JSON from both direct game endpoints", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response());
    expect(await gameReady("https://game.a.run.app", fetcher)).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      await gameReady(
        "https://game.a.run.app",
        async () => new Response("<h1>500</h1>", { status: 500 }),
      ),
    ).toHaveLength(1);
    expect(
      await gameReady(
        "https://game.a.run.app",
        vi
          .fn()
          .mockResolvedValueOnce(response())
          .mockRejectedValueOnce(new Error("timeout")),
      ),
    ).toHaveLength(1);
    for (const origin of [
      "http://game.a.run.app",
      "https://evil.test",
      "https://game.a.run.app/path",
      "https://u:p@game.a.run.app",
      "https://game.a.run.app/?q=x",
    ])
      await expect(gameReady(origin, fetcher)).rejects.toThrow("origin");
    vi.stubGlobal("fetch", async () => response());
    expect(await gameReady("https://game.a.run.app")).toEqual([]);
    vi.unstubAllGlobals();
  });
  it("wires index and game checks without production mutations", async () => {
    const gcloud = vi.fn(() => JSON.stringify(live("READY")));
    await main(["--indexes"], {
      read: () => JSON.stringify(declared),
      gcloud,
      wait: async (check) => expect(await check()).toEqual([]),
    });
    expect(gcloud.mock.calls[0][1].slice(0, 4)).toEqual([
      "firestore",
      "indexes",
      "composite",
      "list",
    ]);
    await main(["--game-origin", "https://game.a.run.app"], {
      fetchImpl: async () => response(),
    });
    await main(["--hosting"], { fetchImpl: async () => response() });
    await expect(main(["--invalid"])).rejects.toThrow("Use --indexes");
  });
});
