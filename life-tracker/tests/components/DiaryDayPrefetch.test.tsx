import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiaryDocument } from '../../src/db/schema';
import { OwnerDiaryContext } from '../../src/hooks/ownerDiaryContext';
import { DiaryDayPreview } from '../../src/components/home/views/DiaryDayPreview';

const calls = vi.hoisted(() => ({ enabled: [] as boolean[] }));
vi.mock('../../src/hooks/useDiary', () => ({
  sortDiaryEntries: <T,>(entries: readonly T[]) => [...entries],
  useDiary: (enabled: boolean) => {
    calls.enabled.push(enabled);
    return {
      getEntriesByDate: () => [],
      createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntryById: vi.fn(),
    };
  },
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (_key: string, fallback: unknown) => fallback,
    setSetting: vi.fn(async () => undefined),
  }),
}));

const note = (id: string, date: string): DiaryDocument => ({
  id, userId: 'owner_1', date, content: id + ' ready before first paint',
  visibility: 'private', emoji: '', photos: '[]',
  isDeleted: false, createdAt: date + 'T09:00:00Z',
  updatedAt: date + 'T09:00:00Z',
});

describe('Day View owner Diary snapshot', () => {
  it('renders current/previous/next days immediately from one live parent snapshot', () => {
    calls.enabled.length = 0;
    const entries = [
      note('yesterday_note', '2026-11-25'),
      note('today_note', '2026-11-26'),
      note('tomorrow_note', '2026-11-27'),
    ];
    const view = (date: string) => (
      <OwnerDiaryContext.Provider value={{ ownerId: 'owner_1', entries, isLoading: false }}>
        <DiaryDayPreview date={date} />
      </OwnerDiaryContext.Provider>
    );
    const { rerender } = render(view('2026-11-26'));
    expect(screen.getByText(/today_note ready before first paint/)).toBeTruthy();
    rerender(view('2026-11-25'));
    expect(screen.getByText(/yesterday_note ready before first paint/)).toBeTruthy();
    rerender(view('2026-11-27'));
    expect(screen.getByText(/tomorrow_note ready before first paint/)).toBeTruthy();
    // One parent subscription is authoritative; slide mounts do no queries.
    expect(calls.enabled.length).toBeGreaterThan(0);
    expect(calls.enabled.every(enabled => enabled === false)).toBe(true);
  });

  it('falls back to its own subscription for standalone Diary views', () => {
    calls.enabled.length = 0;
    render(<DiaryDayPreview date="2026-11-26" />);
    expect(calls.enabled).toContain(true);
  });

  it('reacts to a parent local-first update without remounting a subscription', () => {
    calls.enabled.length = 0;
    const first = note('first_note', '2026-11-26');
    const next = note('next_note', '2026-11-26');
    const frame = (entries: DiaryDocument[]) => (
      <OwnerDiaryContext.Provider value={{ ownerId: 'owner_1', entries, isLoading: false }}>
        <DiaryDayPreview date="2026-11-26" />
      </OwnerDiaryContext.Provider>
    );
    const { rerender } = render(frame([first]));
    expect(screen.getByText(/first_note ready before first paint/)).toBeTruthy();
    rerender(frame([next]));
    expect(screen.queryByText(/first_note ready before first paint/)).toBeNull();
    expect(screen.getByText(/next_note ready before first paint/)).toBeTruthy();
    expect(calls.enabled.every(enabled => enabled === false)).toBe(true);
  });
});
