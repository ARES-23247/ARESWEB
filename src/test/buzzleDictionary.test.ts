import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BuzzleTrie,
  fetchBuzzleDictionary,
  loadBuzzleDictionary,
  resetBuzzleDictionaryForTests,
} from "@ares/buzzle/dictionary";

function largeCorpus(): string {
  return Array.from({ length: 100_000 }, (_, index) => {
    let value = index;
    let suffix = "";
    for (let place = 0; place < 5; place += 1) {
      suffix += String.fromCharCode(97 + (value % 26));
      value = Math.floor(value / 26);
    }
    return `a${suffix}`;
  }).join("\n");
}

describe("BUZZLE dictionary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetBuzzleDictionaryForTests();
  });

  it("stores and checks words in a compact trie", () => {
    const trie = new BuzzleTrie();
    trie.insert("bee");
    trie.insert("bees");
    trie.insert("bee");
    expect(trie.size).toBe(2);
    expect(trie.has("BEE")).toBe(true);
    expect(trie.has("be")).toBe(false);
  });

  it("rejects failed and incomplete dictionary responses", async () => {
    await expect(
      fetchBuzzleDictionary(async () => new Response("no", { status: 503 })),
    ).rejects.toThrow(/unavailable/u);
    await expect(
      fetchBuzzleDictionary(async () => new Response("bee\nbees\n")),
    ).rejects.toThrow(/incomplete/u);
  });

  it("clears a failed singleton load so a later request can retry", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("no", { status: 503 }))
      .mockResolvedValueOnce(new Response(largeCorpus())));
    await expect(loadBuzzleDictionary()).rejects.toThrow(/unavailable/u);
    await expect(loadBuzzleDictionary()).resolves.toMatchObject({ words: expect.any(Set) });
  });

  it("loads, normalizes, and caches the complete static dictionary", async () => {
    const fetcher = vi.fn(async () => new Response(`${largeCorpus()}\nBEE\n1bad\n`));
    vi.stubGlobal("fetch", fetcher);
    const first = await loadBuzzleDictionary();
    const second = await loadBuzzleDictionary();
    expect(first).toBe(second);
    expect(first.words.has("bee")).toBe(true);
    expect(first.trie.has("BEE")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
