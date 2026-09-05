import DOMPurify from "dompurify";

export interface BuzzleMeaning {
  partOfSpeech: string;
  definition: string;
  example: string;
}
export interface BuzzleDefinition {
  word: string;
  phonetic: string;
  meanings: BuzzleMeaning[];
  sources: string[];
  licenses: string[];
}
export type DefinitionResult = { status: "rejected" | "missing" } | { status: "ready"; entry: BuzzleDefinition };

function text(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return (DOMPurify.sanitize(value.slice(0, 20_000), {
    ALLOWED_TAGS: [], ALLOWED_ATTR: [], RETURN_DOM_FRAGMENT: true,
  }).textContent ?? "").trim().slice(0, limit);
}

export function parseBuzzleDefinition(value: unknown, word: string): BuzzleDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid dictionary response.");
  const english = (value as Record<string, unknown>).en;
  if (english === undefined) return null;
  if (!Array.isArray(english)) throw new Error("Invalid dictionary response.");
  const entry: BuzzleDefinition = { word, phonetic: "", meanings: [],
    sources: [`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#English`],
    licenses: ['https://creativecommons.org/licenses/by-sa/4.0/'] };
  for (const meaning of english.slice(0, 8)) {
    if (!meaning || meaning.language !== "English" || !Array.isArray(meaning.definitions)) continue;
    for (const detail of meaning.definitions.slice(0, 3)) {
      const definition = text(detail?.definition, 1500);
      if (definition && entry.meanings.length < 12) entry.meanings.push({
        partOfSpeech: text(meaning.partOfSpeech, 50), definition,
        example: text(Array.isArray(detail.examples) ? detail.examples[0] : undefined, 500),
      });
    }
  }
  return entry.meanings.length ? entry : null;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty dictionary response.");
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 262_144) {
        await reader.cancel();
        throw new Error("Dictionary response is too large.");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { reader.releaseLock(); }
}

export function createBuzzleDefinitionLookup(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, { result: DefinitionResult; expires: number }>();
  const pending = new Map<string, Promise<DefinitionResult>>();
  let lastRequest = -Infinity;
  return async (query: string, words: ReadonlySet<string>): Promise<DefinitionResult> => {
    const word = query.trim().toLowerCase();
    // This check precedes BOTH the cache and network. Definitions never add legal words.
    if (!/^[a-z]{2,13}$/u.test(word) || !words.has(word)) return { status: "rejected" };
    const cached = cache.get(word);
    if (cached && cached.expires > now()) return cached.result;
    const inFlight = pending.get(word);
    if (inFlight) return inFlight;
    if (pending.size >= 3 || now() - lastRequest < 500) throw new Error("Please wait a moment before another lookup.");
    lastRequest = now();
    const request = (async (): Promise<DefinitionResult> => {
      const response = await fetcher(`https://en.wiktionary.org/api/rest_v1/page/definition/${word}`, {
        credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json", "Api-User-Agent": "ARESWEB-BUZZLE/1.0 (https://aresfirst.org/buzzle)" }, signal: AbortSignal.timeout(10_000),
      });
      let result: DefinitionResult;
      if (response.status === 404) result = { status: "missing" };
      else {
        if (!response.ok) throw new Error("Dictionary service unavailable. Please retry.");
        const entry = parseBuzzleDefinition(await readBoundedJson(response), word);
        result = entry ? { status: "ready", entry } : { status: "missing" };
      }
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(word, { result, expires: now() + 15 * 60_000 });
      return result;
    })();
    pending.set(word, request);
    try { return await request; } finally { pending.delete(word); }
  };
}
