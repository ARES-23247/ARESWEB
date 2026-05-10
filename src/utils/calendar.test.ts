import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadICS } from './calendar';

describe('calendar utility', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.fn();
    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();
    clickSpy = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    });

    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement);

    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildSpy as unknown as typeof document.body.appendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildSpy as unknown as typeof document.body.removeChild);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates valid ICS data and triggers download', () => {
    downloadICS({
      title: 'Team Practice',
      dateStart: '2026-03-15T18:00:00Z',
      dateEnd: '2026-03-15T20:00:00Z',
      location: 'ARES Lab',
    });

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blob: Blob = createObjectURLSpy.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/calendar;charset=utf-8');

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(appendChildSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('defaults to 2-hour duration when dateEnd is null', () => {
    downloadICS({
      title: 'Quick Meeting',
      dateStart: '2026-06-01T10:00:00Z',
      dateEnd: null,
    });

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blob: Blob = createObjectURLSpy.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('sanitizes special characters from filename', () => {
    const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    downloadICS({
      title: 'FTC World Championship / Finals!',
      dateStart: '2026-04-20T09:00:00Z',
    });

    expect(anchor.download).toBe('ftc_world_championship___finals_.ics');
  });

  it('handles empty location gracefully', () => {
    downloadICS({
      title: 'No Location Event',
      dateStart: '2026-01-01T00:00:00Z',
      location: null,
    });

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('does nothing when event is falsy', () => {
    // @ts-expect-error testing null guard
    downloadICS(null);

    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

