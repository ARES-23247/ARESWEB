import { describe, expect, it, vi } from "vitest";
import { createBuzzleDefinitionLookup, parseBuzzleDefinition } from "@ares/buzzle/definitions";

const entry = () => ({ en: [{ language: 'English', partOfSpeech: 'preposition', definitions: [{ definition: 'Test definition.', examples: ['Test example.'] }] }] });
const response = () => new Response(JSON.stringify(entry()), { status: 200 });

describe('BUZZLE definition boundary', () => {
  it('rejects illegal queries before network AND cached results; normalizes legal queries and deduplicates', async () => {
    const fetcher = vi.fn(async () => response());
    const lookup = createBuzzleDefinitionLookup(fetcher);
    const words = new Set(['at']);
    expect(await lookup('zzzz', words)).toEqual({ status: 'rejected' });
    expect(await lookup('../at', words)).toEqual({ status: 'rejected' });
    expect(fetcher).not.toHaveBeenCalled();
    const [a, b] = await Promise.all([lookup(' AT ', words), lookup('at', words)]);
    expect(a).toEqual(b); expect(a.status).toBe('ready');
    expect(await lookup('at', words)).toEqual(a);
    expect(await lookup('at', new Set())).toEqual({ status: 'rejected' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('https://en.wiktionary.org/api/rest_v1/page/definition/at', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error' }));
  });

  it('uses English senses only, strips active markup, bounds content and constructs trusted attribution', () => {
    const data = entry();
    data.en.push({ language: 'English', partOfSpeech: 'noun', definitions: [{ definition: 'd'.repeat(1800), examples: ['e'.repeat(800)] }] });
    data.en[0].definitions[0].definition = '<script>alert(1)</script><img src=x onerror=alert(1)><b>Safe</b> &amp; sound.';
    const result = parseBuzzleDefinition(data, 'at')!;
    expect(result.sources).toEqual(['https://en.wiktionary.org/wiki/at#English']);
    expect(result.meanings[0].definition).toBe('Safe & sound.');
    expect(result.meanings[1].definition).toHaveLength(1500);
    expect(result.meanings[1].example).toHaveLength(500);
    expect(parseBuzzleDefinition({ fr: data.en }, 'at')).toBeNull();
    expect(parseBuzzleDefinition({ en: [null, {}, { language: 'French', definitions: [] }, { language: 'English', definitions: [null, {}] }] }, 'at')).toBeNull();
    expect(() => parseBuzzleDefinition([], 'at')).toThrow();
    expect(() => parseBuzzleDefinition({ en: {} }, 'at')).toThrow();
  });

  it('distinguishes missing meanings from network, malformed and oversized failures and permits retry', async () => {
    let time = 0;
    const fetcher = vi.fn<typeof fetch>();
    const lookup = createBuzzleDefinitionLookup(fetcher, () => time += 1000);
    const words = new Set(['at', 'an', 'aa', 'ad', 'ae', 'ag', 'ah']);
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await lookup('at', words)).toEqual({ status: 'missing' });
    fetcher.mockResolvedValueOnce(new Response('{}'));
    expect(await lookup('an', words)).toEqual({ status: 'missing' });
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(lookup('aa', words)).rejects.toThrow('unavailable');
    fetcher.mockResolvedValueOnce(new Response('broken'));
    await expect(lookup('aa', words)).rejects.toThrow();
    fetcher.mockResolvedValueOnce(new Response('x'.repeat(262_145)));
    await expect(lookup('ad', words)).rejects.toThrow('too large');
    fetcher.mockResolvedValueOnce(new Response(null));
    await expect(lookup('ae', words)).rejects.toThrow('Empty');
    fetcher.mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'));
    await expect(lookup('ag', words)).rejects.toThrow('Timeout');
    fetcher.mockResolvedValueOnce(response());
    expect((await lookup('aa', words)).status).toBe('ready');
  });

  it('expires and bounds the memory cache, and throttles new lookups', async () => {
    let time = 0;
    const fetcher = vi.fn(async () => new Response('{}'));
    const lookup = createBuzzleDefinitionLookup(fetcher, () => time);
    const words = new Set(Array.from({ length: 101 }, (_, index) => `a${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`));
    const list = [...words];
    await lookup(list[0], words);
    await expect(lookup(list[1], words)).rejects.toThrow('wait');
    for (const word of list.slice(1)) { time += 1000; await lookup(word, words); }
    time += 1000; await lookup(list[0], words);
    expect(fetcher).toHaveBeenCalledTimes(102);
    time += 16 * 60_000; await lookup(list[0], words);
    expect(fetcher).toHaveBeenCalledTimes(103);
  });
});
