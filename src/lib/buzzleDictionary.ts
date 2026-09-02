export interface BuzzleTrieNode {
  terminal: boolean;
  children: Map<string, BuzzleTrieNode>;
}

export class BuzzleTrie {
  readonly root: BuzzleTrieNode = { terminal: false, children: new Map() };
  size = 0;

  insert(word: string): void {
    let node = this.root;
    for (const letter of word) {
      let child = node.children.get(letter);
      if (!child) {
        child = { terminal: false, children: new Map() };
        node.children.set(letter, child);
      }
      node = child;
    }
    if (!node.terminal) {
      node.terminal = true;
      this.size += 1;
    }
  }

  has(word: string): boolean {
    let node = this.root;
    for (const letter of word.toLowerCase()) {
      const child = node.children.get(letter);
      if (!child) return false;
      node = child;
    }
    return node.terminal;
  }
}

export interface BuzzleDictionary {
  words: ReadonlySet<string>;
  trie: BuzzleTrie;
}

let dictionaryPromise: Promise<BuzzleDictionary> | null = null;

export async function fetchBuzzleDictionary(
  fetcher: typeof fetch = fetch,
): Promise<BuzzleDictionary> {
  const response = await fetcher("/data/buzzle-words.txt", {
    headers: { Accept: "text/plain" },
  });
  if (!response.ok) throw new Error("BUZZLE dictionary is unavailable.");
  const words = new Set(
    (await response.text())
      .split(/\r?\n/gu)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => /^[a-z]{2,13}$/u.test(word)),
  );
  if (words.size < 100_000) throw new Error("BUZZLE dictionary is incomplete.");
  const trie = new BuzzleTrie();
  for (const word of words) trie.insert(word);
  return { words, trie };
}

export function loadBuzzleDictionary(): Promise<BuzzleDictionary> {
  dictionaryPromise ??= fetchBuzzleDictionary().catch((error) => {
    dictionaryPromise = null;
    throw error;
  });
  return dictionaryPromise;
}

export function resetBuzzleDictionaryForTests(): void {
  dictionaryPromise = null;
}
