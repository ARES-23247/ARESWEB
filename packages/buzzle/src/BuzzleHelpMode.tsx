import { useEffect, useMemo, useState } from "react";
import type { BuzzleBoard, BuzzlePlacement, BuzzleTile } from "./rules";
import type { BuzzleHint } from "./wordHelp";

interface Props {
  board: BuzzleBoard; rack: BuzzleTile[]; draft: BuzzlePlacement[]; words: ReadonlySet<string> | null;
  player: number; onPreview: (hint: BuzzleHint | null) => void; onDefine: (word: string, trigger: HTMLElement) => void;
  initialPreview?: BuzzleHint | null;
}
export function BuzzleHelpMode({ board, rack, draft, words, player, onPreview, onDefine, initialPreview = null }: Props) {
  const [state, setState] = useState<{ hints: BuzzleHint[]; error: string | null; ready: boolean }>({ hints: [], error: null, ready: false });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<BuzzleHint | null>(initialPreview);
  const grouped = useMemo(() => {
    const map = new Map<string, BuzzleHint[]>();
    for (const hint of state.hints) map.set(hint.word, [...(map.get(hint.word) ?? []), hint]);
    return [...map];
  }, [state.hints]);
  useEffect(() => {
    if (!words) return;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./buzzle-help.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{ hints: BuzzleHint[]; error: string | null }>) => setState({ ...event.data, ready: true });
      worker.onerror = () => setState({ hints: [], error: "Could not search this position. Turn Help Mode off and on to retry.", ready: true });
      worker.postMessage({ board, rack, draft, words, player });
    } catch { setState({ hints: [], error: "Help Mode could not start. Try a browser that supports workers.", ready: true }); }
    return () => { if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); } };
  }, [board, rack, draft, words, player]);
  function preview(hint: BuzzleHint) { setSelected(hint); onPreview(hint); }
  return <section className="buzzle-help-suggestions" aria-label="Possible two-letter plays">
    <p className="text-sm" role="status">{!words ? "Load the accepted word list to use Help Mode." : !state.ready ? "Finding legal two-letter placements…" : state.error ?? `${grouped.length} possible two-letter words.`}</p>
    {state.ready && !state.error && !grouped.length && <p className="mt-2 text-sm">{draft.length ? "No two-letter placement fits this draft. Recall tiles to explore another play." : "No legal two-letter placements with this rack and board."}</p>}
    <div className="mt-3 flex flex-wrap gap-2">{grouped.slice(page * 8, page * 8 + 8).map(([word, hints]) =>
      <div className="buzzle-hint-word" key={word}>
        <button type="button" aria-label={`Preview ${word.toUpperCase()}`} onClick={() => preview(hints[0])}>{word.toUpperCase()} <small>({hints.length})</small></button>
        <button type="button" className="text-xs underline" aria-label={`Define ${word.toUpperCase()}`} onClick={(event) => onDefine(word, event.currentTarget)}>Meaning</button>
      </div>)}
    </div>
    {grouped.length > 8 && <div className="mt-3 flex items-center gap-3 text-sm">
      <button type="button" className="buzzle-secondary-action" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous words</button>
      <span>{page + 1}/{Math.ceil(grouped.length / 8)}</span>
      <button type="button" className="buzzle-secondary-action" disabled={(page + 1) * 8 >= grouped.length} onClick={() => setPage(page + 1)}>Next words</button>
    </div>}
    {selected && <div className="buzzle-hint-preview mt-3" aria-label="Placement preview">
      <p className="font-bold">{selected.word.toUpperCase()} · {selected.score} points</p>
      <ol className="buzzle-placement-steps mt-2">{selected.placements.map(({ index, tile, assignedLetter }, offset) => {
        const letter = assignedLetter ?? tile.letter;
        const placed = draft.some((item) => item.index === index);
        return <li key={index}>
          <span className="buzzle-step-marker" aria-hidden="true">{offset + 1}</span>
          <span>{placed ? `${letter} already placed` : `Place ${tile.blank ? 'a blank as ' : ''}${letter} on ${offset + 1}`}</span>
        </li>;
      })}</ol>
      <p className="mt-2 text-sm">Preview only. Match the numbered markers on the board, then submit your play.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="buzzle-secondary-action" disabled={!state.ready || !grouped.some(([word]) => word === selected.word)} onClick={() => {
          const hints = grouped.find(([word]) => word === selected.word)![1];
          const currentIndex = hints.findIndex((hint) => JSON.stringify(hint.placements) === JSON.stringify(selected.placements));
          preview(hints[(currentIndex + 1) % hints.length]);
        }}>Next placement</button>
        <button type="button" className="buzzle-secondary-action" onClick={() => { setSelected(null); onPreview(null); }}>Clear preview</button>
      </div>
    </div>}
  </section>;
}
