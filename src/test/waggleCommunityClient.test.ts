import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommunityClient } from "@ares/waggle-way/community-client";
import { createBlankLevel } from "@ares/waggle-way/level";

const level = createBlankLevel();
const metadata = {
  nickname: "Clover",
  difficulty: "gentle" as const,
  estimatedLength: "short" as const,
};
const card = {
  ...metadata,
  id: "garden",
  revision: 1,
  title: level.title,
  theme: "sunny",
  mechanics: ["fan"],
  population: level.population,
  rescueTarget: level.rescueTarget,
  objectives: { pollen: 0, maxTools: 2 },
};
const garden = {
  ...card,
  level,
  parent: { id: "parent", title: "Parent", nickname: "Fern" },
};
const owned = {
  id: "garden",
  title: level.title,
  version: 2,
  publishedRevision: 1,
  candidateRevision: 2,
  status: "pending",
  reviewReason: null,
};
const review = {
  garden: owned,
  candidate: garden,
  reviewDigest: "a".repeat(64),
  allBeesProven: true,
  bestPollen: 0,
  fewestTools: 0,
};
const report = {
  id: "a".repeat(64),
  levelId: "garden",
  revision: 1,
  reason: "text",
  publication: { card, version: 2 },
};
afterEach(() => vi.useRealTimers());

describe("Waggle Way community transport", () => {
  it("releases a caller even if token acquisition ignores abort, and ignores a late response", async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const result = expect(
      createCommunityClient(fetcher).browse(),
    ).rejects.toThrow("Could not load");
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
    expect(fetcher.mock.lastCall?.[1]?.signal?.aborted).toBe(true);
    finish(Response.json({ gardens: [card], nextCursor: null }));
    await vi.advanceTimersByTimeAsync(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also bounds a response body that never completes", async () => {
    vi.useFakeTimers();
    const response = Response.json({ gardens: [], nextCursor: null });
    vi.spyOn(response, "json").mockImplementation(
      () => new Promise(() => undefined),
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    const result = expect(
      createCommunityClient(fetcher).browse(),
    ).rejects.toMatchObject({ status: 0 });
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses the exact versioned API contracts for every operation without caching or retrying", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createCommunityClient(fetcher);
    const reply = (value: unknown) =>
      fetcher.mockResolvedValueOnce(Response.json(value));
    reply({ gardens: [card], nextCursor: "next cursor" });
    expect(
      await client.browse({
        mechanic: "fan",
        difficulty: "gentle",
        estimatedLength: "short",
        cursor: "a+b",
      }),
    ).toEqual({ gardens: [card], nextCursor: "next cursor" });
    expect(fetcher.mock.lastCall?.[0]).toBe(
      "/api/waggle-way/gardens?mechanic=fan&difficulty=gentle&estimatedLength=short&cursor=a%2Bb",
    );
    reply({ gardens: [], nextCursor: null });
    await client.browse();
    expect(fetcher.mock.lastCall?.[0]).toBe("/api/waggle-way/gardens");
    reply(garden);
    expect(await client.get("a/b?")).toEqual(garden);
    expect(fetcher.mock.lastCall?.[0]).toBe("/api/waggle-way/gardens/a%2Fb%3F");
    reply([owned]);
    await client.mine();
    reply({ garden: owned, level, metadata });
    await client.getOwn("garden");
    const submission = {
      expectedVersion: 2,
      metadata,
      proof: { level, replays: [] },
    };
    reply(owned);
    await client.submit("garden", submission);
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify(submission),
    });
    reply({
      ...owned,
      publishedRevision: null,
      candidateRevision: null,
      status: "deleted",
    });
    await client.removeOwn("garden", 2);
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: "DELETE",
      body: '{"expectedVersion":2}',
    });
    reply({ gardens: [owned], nextCursor: null });
    await client.pending("cursor");
    expect(fetcher.mock.lastCall?.[0]).toBe(
      "/api/waggle-way/review?cursor=cursor",
    );
    reply({ gardens: [], nextCursor: null });
    await client.pending();
    reply(review);
    await client.review("garden");
    reply(owned);
    await client.decide("garden", 2, review.reviewDigest, "approve");
    expect(JSON.parse(fetcher.mock.lastCall![1]!.body as string)).toEqual({
      expectedVersion: 2,
      reviewDigest: review.reviewDigest,
      decision: "approve",
    });
    reply(owned);
    await client.decide("garden", 2, review.reviewDigest, "reject", "text");
    expect(JSON.parse(fetcher.mock.lastCall![1]!.body as string).reason).toBe(
      "text",
    );
    reply(owned);
    await client.removePublished("garden", 2, "identity");
    expect(fetcher.mock.lastCall?.[0]).toBe(
      "/api/waggle-way/gardens/garden/remove",
    );
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.report("garden", "unsafe");
    expect(JSON.parse(fetcher.mock.lastCall![1]!.body as string)).toEqual({
      reason: "unsafe",
    });
    reply({
      reports: [report, { ...report, publication: null }],
      nextCursor: null,
    });
    await client.reports("cursor");
    reply({ reports: [], nextCursor: null });
    await client.reports();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.resolveReport("report");
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      body: "{}",
      method: "POST",
    });
    expect(fetcher).toHaveBeenCalledTimes(17);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.cache).toBe("no-store");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      if (init?.body)
        expect(init.headers).toEqual({ "Content-Type": "application/json" });
    }
  });

  it.each([400, 401, 403, 404, 409, 413, 429, 500, 503])(
    "preserves HTTP %s as an explicit safe failure",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ message: "private diagnostic" }, { status }),
        );
      await expect(
        createCommunityClient(fetcher).browse(),
      ).rejects.toMatchObject({ status });
      await expect(createCommunityClient(fetcher).browse()).rejects.not.toThrow(
        "private diagnostic",
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    null,
    [],
    { gardens: "bad", nextCursor: null },
    { gardens: Array(13).fill(card), nextCursor: null },
    { gardens: [{ ...card, title: 5 }], nextCursor: null },
    { gardens: [{ ...card, revision: -1 }], nextCursor: null },
    { gardens: [{ ...card, theme: "unknown" }], nextCursor: null },
    { gardens: [card], nextCursor: 7 },
  ])(
    "rejects malformed success payloads instead of showing an empty collection",
    async (payload) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(payload));
      await expect(
        createCommunityClient(fetcher).browse(),
      ).rejects.toMatchObject({ status: 0 });
    },
  );

  it("validates playable levels and review proofs before exposing them", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ ...garden, level: { ...level, width: -1 } }),
      )
      .mockResolvedValueOnce(
        Response.json({ ...review, reviewDigest: "wrong" }),
      )
      .mockResolvedValueOnce(new Response("not-json"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const client = createCommunityClient(fetcher);
    await expect(client.get("garden")).rejects.toThrow("Could not load");
    await expect(client.review("garden")).rejects.toThrow("Could not load");
    await expect(client.mine()).rejects.toThrow("Could not load");
    await expect(client.report("garden", "text")).rejects.toThrow(
      "Could not confirm",
    );
  });

  it("distinguishes uncertain mutations and bounds hanging requests", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () =>
            reject(new Error("timeout")),
          );
        }),
    );
    const request = createCommunityClient(fetcher).removeOwn("garden", 2);
    const result = expect(request).rejects.toThrow(
      "Reload the garden before trying again",
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
    expect(fetcher).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
