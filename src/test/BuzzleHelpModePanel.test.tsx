import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuzzleHelpMode } from '@/components/games/BuzzleHelpMode';
import { createBuzzleGame, getBuzzleCellIndex } from '@/lib/buzzle';
import type { BuzzleHint } from '@/lib/buzzleWordHelp';

describe('BUZZLE hint worker lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('previews without playing, paginates, and cancels stale workers when the position unmounts', () => {
    const workers: FakeWorker[] = [];
    class FakeWorker {
      onmessage: ((event: { data: { hints: BuzzleHint[]; error: null } }) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() { workers.push(this); }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const game = createBuzzleGame();
    const preview = vi.fn(); const define = vi.fn();
    const hints: BuzzleHint[] = ['aa', 'ab', 'ad', 'ae', 'ag', 'ah', 'ai', 'al', 'am'].map(word => ({ word, score: 2, indices: [getBuzzleCellIndex(0, 0)!, getBuzzleCellIndex(1, 0)!], placements: [{ index: getBuzzleCellIndex(0, 0)!, tile: { id: '?', letter: '?', points: 0, blank: true }, assignedLetter: word[0].toUpperCase() }] }));
    const { unmount } = render(<BuzzleHelpMode board={game.board} rack={game.players[0].rack} draft={[]} words={new Set(['aa'])} player={0} onPreview={preview} onDefine={define} />);
    act(() => workers[0].onmessage!({ data: { hints, error: null } }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview AA' }));
    expect(preview).toHaveBeenLastCalledWith(hints[0]);
    expect(screen.getByText('Place a blank as A on 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Define AA' }));
    expect(define).toHaveBeenCalledWith('aa', screen.getByRole('button', { name: 'Define AA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next placement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear preview' }));
    expect(preview).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Next words' }));
    expect(screen.getByRole('button', { name: 'Preview AM' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous words' }));
    unmount();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers[0].onmessage).toBeNull();
  });

  it('shows an explicit error when workers are unavailable', () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('unsupported'); } });
    const game = createBuzzleGame();
    render(<BuzzleHelpMode board={game.board} rack={game.players[0].rack} draft={[]} words={new Set(['aa'])} player={0} onPreview={vi.fn()} onDefine={vi.fn()} />);
    expect(screen.getByText(/Help Mode could not start/)).toBeInTheDocument();
  });
});
