import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuzzleWordHelp } from '@/components/games/BuzzleWordHelp';
import { createBuzzleGame, getBuzzleCellIndex } from '@/lib/buzzle';

const data = (word: string) => ({ en: [{ language: 'English', partOfSpeech: 'noun', definitions: [{ definition: `Fixture meaning of ${word}.` }] }] });

describe('BUZZLE Word Help interactions', () => {
  afterEach(() => vi.restoreAllMocks());
  it('checks physical-play words and browses the full reference without a definition request', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(data('at'))));
    render(<BuzzleWordHelp standalone request={{ tab: 'check' }} words={new Set(['at', 'aa', 'bee'])} loading={false} onRetry={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Words on board' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Word to check'), { target: { value: ' AT ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check word' }));
    expect(screen.getByText('AT — accepted in BUZZLE.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Word to check'), { target: { value: 'zzzz' } });
    expect(screen.queryByText('AT — accepted in BUZZLE.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check word' }));
    expect(screen.getByText('ZZZZ — not accepted in BUZZLE.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show definition' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Two-letter words' }));
    expect(screen.getAllByRole('button', { name: /^Define / })).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Check a word' }));
    fireEvent.change(screen.getByLabelText('Word to check'), { target: { value: 'at' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check word' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show definition' }));
    expect(await screen.findByText('Fixture meaning of at.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('filters accepted reference words, looks up definitions, blocks illegal queries, and preserves board words', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(data('at'))));
    const board = [...createBuzzleGame().board];
    board[getBuzzleCellIndex(0, 0)!] = { id: 'a', letter: 'A', points: 1, blank: false, playedBy: 0 };
    board[getBuzzleCellIndex(1, 0)!] = { id: 't', letter: 'T', points: 1, blank: false, playedBy: 0 };
    const close = vi.fn();
    render(<BuzzleWordHelp request={{ tab: 'two' }} words={new Set(['at', 'aa', 'bee'])} board={board} loading={false} onRetry={vi.fn()} onClose={close} returnFocusRef={{ current: null }} />);
    expect(screen.getByText(/2 accepted two-letter words/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by letter'), { target: { value: 't' } });
    expect(screen.queryByRole('button', { name: 'Define AA' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Define AT' }));
    expect(await screen.findByText('Fixture meaning of at.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Look up a legal word'), { target: { value: 'zzzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText('Not accepted in BUZZLE.')).toBeInTheDocument();
    expect(screen.queryByText('Fixture meaning of at.')).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Words on board' }));
    fireEvent.click(screen.getByRole('button', { name: 'AT' }));
    expect(await screen.findByText('Fixture meaning of at.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(close).toHaveBeenCalled();
  });

  it('gates lookups while the accepted list is unavailable and exposes retry', () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const retry = vi.fn();
    render(<BuzzleWordHelp request={{ tab: 'dictionary', word: 'at' }} words={null} board={createBuzzleGame().board} loading={false} onRetry={retry} onClose={vi.fn()} returnFocusRef={{ current: null }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry word list' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('ignores a stale response when the query changes, and distinguishes missing definitions', async () => {
    let finish!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<BuzzleWordHelp request={{ tab: 'dictionary', word: 'at' }} words={new Set(['at'])} board={createBuzzleGame().board} loading={false} onRetry={vi.fn()} onClose={vi.fn()} returnFocusRef={{ current: null }} />);
    fireEvent.change(screen.getByLabelText('Look up a legal word'), { target: { value: 'zzzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await screen.findByText('Not accepted in BUZZLE.');
    finish(new Response('{}', { status: 404 }));
    await waitFor(() => expect(screen.getByText('Not accepted in BUZZLE.')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Look up a legal word'), { target: { value: 'at' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText('Accepted in BUZZLE; definition unavailable.')).toBeInTheDocument();
  });
});
