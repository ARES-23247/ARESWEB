import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BuzzleWordToolsPage from '@/app/buzzle/word-tools/page';
import { loadBuzzleDictionary, BuzzleTrie } from '@ares/buzzle/dictionary';

vi.mock('@ares/buzzle/dictionary', async (original) => ({
  ...await original<typeof import('@ares/buzzle/dictionary')>(),
  loadBuzzleDictionary: vi.fn(),
}));

describe('BUZZLE physical-play page', () => {
  it('shows loading and failure, then retries the accepted list without requiring a game', async () => {
    vi.mocked(loadBuzzleDictionary).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ words: new Set(['at', 'aa']), trie: new BuzzleTrie() });
    render(<BuzzleWordToolsPage />);
    expect(screen.getByText('Loading accepted words…')).toBeInTheDocument();
    expect(await screen.findByText('Accepted words are unavailable. Reconnect and retry.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry word list' }));
    expect(await screen.findByLabelText('Word to check')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Two-letter words' }));
    expect(screen.getAllByRole('button', { name: /^Define / })).toHaveLength(2);
  });
});
