import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { DialogShell } from "@ares/ui/dialog";
import { createBuzzleDefinitionLookup, type DefinitionResult } from "./definitions";
import { twoLetterWords, wordsOnBuzzleBoard } from "./wordHelp";
import type { BuzzleBoard } from "./rules";

export interface WordHelpRequest { tab: "two" | "dictionary" | "board" | "check"; word?: string; cell?: number }
interface Props {
  request: WordHelpRequest;
  words: ReadonlySet<string> | null;
  board?: BuzzleBoard;
  loading: boolean;
  onRetry: () => void;
  onClose?: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  standalone?: boolean;
}

export function BuzzleWordHelp({ request, words, board, loading, onRetry, onClose, returnFocusRef, standalone = false }: Props) {
  const [tab, setTab] = useState(request.tab);
  const [query, setQuery] = useState(request.word ?? "");
  const [search, setSearch] = useState({ word: request.word ?? "", attempt: 0 });
  const [filter, setFilter] = useState("");
  const [checkQuery, setCheckQuery] = useState("");
  const [checkedWord, setCheckedWord] = useState("");
  const [result, setResult] = useState<DefinitionResult | { status: "loading" | "error" } | null>(request.word ? { status: "loading" } : null);
  const lookup = useRef<ReturnType<typeof createBuzzleDefinitionLookup> | null>(null);
  lookup.current ??= createBuzzleDefinitionLookup();
  const reference = useMemo(() => words ? twoLetterWords(words) : [], [words]);
  const boardWords = useMemo(() => words && board ? wordsOnBuzzleBoard(board, words) : [], [board, words]);
  const visibleBoardWords = request.cell === undefined ? boardWords : boardWords.filter(({ indices }) => indices.includes(request.cell!));
  const filtered = reference.filter((word) => word.includes(filter.trim().toLowerCase()));

  useEffect(() => {
    if (!words || !search.word) return;
    let active = true;
    void lookup.current!(search.word, words).then(
      (next) => { if (active) setResult(next); },
      () => { if (active) setResult({ status: "error" }); },
    );
    return () => { active = false; };
  }, [search, words]);

  function define(word: string) {
    setQuery(word);
    setTab("dictionary");
    setResult({ status: "loading" });
    setSearch((previous) => ({ word: word.trim().toLowerCase(), attempt: previous.attempt + 1 }));
  }

  const sections: ReadonlyArray<readonly [WordHelpRequest['tab'], string]> = standalone
    ? [['check', 'Check a word'], ['two', 'Two-letter words'], ['dictionary', 'Dictionary']]
    : [['two', 'Two-letter words'], ['dictionary', 'Dictionary'], ['board', 'Words on board']];
  const content = <>
    <nav className="buzzle-help-tabs" aria-label="Word Help sections">
      {sections.map(([id, label]) =>
        <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
    </nav>
    {!words ? <div role="status" className="mt-5">
      <p>{loading ? "Loading accepted words…" : "Accepted words are unavailable. Reconnect and retry."}</p>
      {!loading && <button type="button" className="buzzle-secondary-action mt-3" onClick={onRetry}>Retry word list</button>}
    </div> : <>
      {tab === "check" && <section className="mt-5" aria-label="Legal word checker">
        <p className="mb-4 text-sm text-marble/80">Check against the same accepted word list used by BUZZLE. Your physical board still determines whether a placement is valid.</p>
        <form onSubmit={(event) => { event.preventDefault(); setCheckedWord(checkQuery.trim().toLowerCase()); }}>
          <label className="block text-sm font-bold" htmlFor="buzzle-check">Word to check</label>
          <div className="flex flex-wrap items-end gap-2">
            <input id="buzzle-check" className="buzzle-help-input flex-1" value={checkQuery} maxLength={13} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(event) => { setCheckQuery(event.target.value); setCheckedWord(""); }} />
            <button type="submit" className="buzzle-primary-action" disabled={!checkQuery.trim()}>Check word</button>
          </div>
        </form>
        <div role="status" className="my-5 text-lg font-bold">
          {checkedWord && `${checkedWord.toUpperCase()} — ${words.has(checkedWord) ? 'accepted' : 'not accepted'} in BUZZLE.`}
        </div>
        {checkedWord && words.has(checkedWord) && <button type="button" className="buzzle-secondary-action" onClick={() => define(checkedWord)}>Show definition</button>}
        <p className="mt-4 text-xs text-marble/75">Checking a word does not send it anywhere or fetch a definition.</p>
      </section>}
      {tab === "two" && <section className="mt-5" aria-label="Two-letter reference">
        <p className="mb-3 text-sm">{reference.length} accepted two-letter words. Select a word for its meaning.</p>
        <label className="block text-sm font-bold" htmlFor="buzzle-letter-filter">Filter by letter</label>
        <input id="buzzle-letter-filter" className="buzzle-help-input" value={filter} maxLength={2} onChange={(event) => setFilter(event.target.value)} />
        <div className="buzzle-word-list mt-4">{filtered.map((word) => <button type="button" key={word} onClick={() => define(word)} aria-label={`Define ${word.toUpperCase()}`}>{word.toUpperCase()}</button>)}</div>
        {!filtered.length && <p role="status">No accepted two-letter words match this filter.</p>}
      </section>}
      {tab === "board" && <section className="mt-5" aria-label="Played words">
        <p className="mb-3 text-sm">{request.cell === undefined ? "Words currently on the board." : "Choose a word crossing the selected cell."} Select a word for its meaning.</p>
        <ul className="space-y-2">{visibleBoardWords.map(({ word, indices }) => <li key={indices.join(',')}>
          <button type="button" className="buzzle-secondary-action w-full" onClick={() => define(word)}>{word.toUpperCase()}</button>
        </li>)}</ul>
        {!visibleBoardWords.length && <p>No accepted words here yet.</p>}
      </section>}
      {tab === "dictionary" && <section className="mt-5" aria-label="Word dictionary">
        <form onSubmit={(event) => { event.preventDefault(); define(query); }}>
          <label className="block text-sm font-bold" htmlFor="buzzle-lookup">Look up a legal word</label>
          <div className="flex flex-wrap items-end gap-2">
            <input id="buzzle-lookup" className="buzzle-help-input flex-1" value={query} maxLength={13} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" className="buzzle-primary-action" disabled={!query.trim()}>Look up</button>
          </div>
        </form>
        <p className="mt-3 text-xs text-marble/75">Definitions use Wiktionary and need an internet connection for new lookups. Only the word is sent; your rack and match details stay here.</p>
        <div role="status" aria-live="polite" className="my-4 text-sm">
          {result?.status === "loading" && "Looking up definition…"}
          {result?.status === "rejected" && "Not accepted in BUZZLE."}
          {result?.status === "missing" && "Accepted in BUZZLE; definition unavailable."}
          {result?.status === "error" && "Definition service unavailable. Please wait a moment and retry."}
          {result?.status === "ready" && `${result.entry.word.toUpperCase()} — accepted in BUZZLE.`}
        </div>
        {result?.status === "error" && <button type="button" className="buzzle-secondary-action" onClick={() => define(search.word)}>Retry definition</button>}
        {result?.status === "ready" && <article className="buzzle-definition">
          <h3 className="text-3xl font-black uppercase text-ares-gold">{result.entry.word}</h3>
          {result.entry.phonetic && <p>{result.entry.phonetic}</p>}
          <ol className="mt-4 space-y-4">{result.entry.meanings.map((meaning, index) => <li key={index}>
            <p className="text-sm font-bold text-ares-gold">{meaning.partOfSpeech}</p>
            <p>{meaning.definition}</p>
            {meaning.example && <p className="mt-1 text-sm italic text-marble/75">{meaning.example}</p>}
          </li>)}</ol>
          <footer className="mt-5 border-t border-white/20 pt-3 text-xs leading-6">
            <p>Selected definitions from Wiktionary contributors, shared under CC BY-SA 4.0. Formatting and number of senses are limited.</p>
            {result.entry.sources.map((source, index) => <a key={source} href={source} target="_blank" rel="noopener noreferrer" className="mr-3">Source {index + 1}</a>)}
            {result.entry.licenses.map((license) => <a key={license} href={license} target="_blank" rel="noopener noreferrer" className="mr-3">{license.includes('4.0') ? 'CC BY-SA 4.0' : 'CC BY-SA 3.0'}</a>)}
          </footer>
        </article>}
      </section>}
    </>}
  </>;
  if (standalone) return <section className="buzzle-word-help buzzle-panel rounded-2xl p-4 sm:p-6" aria-label="BUZZLE Word Tools">{content}</section>;
  return <DialogShell open onOpenChange={(open) => { if (!open) onClose?.(); }} title="BUZZLE Word Help"
    description="Explore words accepted in BUZZLE." placement="right" size="md" returnFocusRef={returnFocusRef}
    className="buzzle-word-help">{content}</DialogShell>;
}
