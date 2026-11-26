import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryDocument } from '../../src/db/schema';
import { OwnerSettingsContext } from '../../src/hooks/calendarDiaryContext';
import { OwnerDiaryContext } from '../../src/hooks/ownerDiaryContext';
import { DiaryDayPreview } from '../../src/components/home/views/DiaryDayPreview';
import { diaryEntryOrderModeKey } from '../../src/lib/diaryDayOrder';
import { DIARY_DAY_VIEW_HEIGHT_SETTING_KEY } from '../../src/lib/preferences';

const calls = vi.hoisted(() => ({ subscriptions: [] as boolean[] }));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner_1' } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: ({ enabled }: { enabled?: boolean }) => {
    calls.subscriptions.push(enabled ?? true);
    return { data: {}, isLoading: false };
  },
}));
vi.mock('../../src/hooks/useDiary', () => ({
  sortDiaryEntries: <T extends { id: string; createdAt: string }>(entries: readonly T[]) =>
    [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  useDiary: () => ({
    getEntriesByDate: () => [],
    createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntryById: vi.fn(),
  }),
}));

const entry = (id: string, date: string, hour: string): DiaryDocument => ({
  id, userId: 'owner_1', date,
  content: id + ' title\nFull ' + id + ' body stays visible on first frame',
  visibility: 'private', emoji: '', photos: '[]',
  isDeleted: false, createdAt: date + 'T' + hour + ':00:00Z',
  updatedAt: date + 'T' + hour + ':00:00Z',
});
const yesterday = '2026-11-25', today = '2026-11-26', tomorrow = '2026-11-27';
const entries: DiaryDocument[] = [
  entry('prev_a', yesterday, '09'), entry('prev_b', yesterday, '10'),
  entry('today_a', today, '09'), entry('today_b', today, '10'),
  entry('next_a', tomorrow, '09'), entry('next_b', tomorrow, '10'),
];
const settings = {
  [DIARY_DAY_VIEW_HEIGHT_SETTING_KEY]: 'expanded',
  [diaryEntryOrderModeKey(yesterday)]: 'newest',
  [diaryEntryOrderModeKey(today)]: 'newest',
  [diaryEntryOrderModeKey(tomorrow)]: 'newest',
};
function view(date: string) {
  return <OwnerSettingsContext.Provider value={{
    ownerId: 'owner_1', settings, isLoading: false,
  }}>
    <OwnerDiaryContext.Provider value={{
      ownerId: 'owner_1', entries, isLoading: false,
    }}>
      <DiaryDayPreview date={date} />
    </OwnerDiaryContext.Provider>
  </OwnerSettingsContext.Provider>;
}

describe('Diary group first-paint settings and data hydration', () => {
  beforeEach(() => { calls.subscriptions.length = 0; });

  it('opens current, prior and next date with expanded grouped notes already present', () => {
    const { rerender } = render(view(today));
    for (const [date, a, b] of [
      [today, 'today_a', 'today_b'],
      [yesterday, 'prev_a', 'prev_b'],
      [tomorrow, 'next_a', 'next_b'],
    ]) {
      rerender(view(date));
      expect(screen.getByRole('button', { name: 'Diary group, 2 entries' })).toBeTruthy();
      expect(screen.getByText('Full ' + a + ' body stays visible on first frame',
        { exact: false })).toBeTruthy();
      expect(screen.getByText('Full ' + b + ' body stays visible on first frame',
        { exact: false })).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Collapse entry' })).toHaveLength(2);
    }
    // No late per-group RxDB settings subscription may replace the full
    // expanded container with a default compact one after a slide mounts.
    expect(calls.subscriptions.length).toBeGreaterThan(0);
    expect(calls.subscriptions.every(enabled => enabled === false)).toBe(true);
  });

  it('can intentionally change the expansion preference from the parent', () => {
    const { rerender } = render(view(today));
    expect(screen.getAllByRole('button', { name: 'Collapse entry' })).toHaveLength(2);
    rerender(<OwnerSettingsContext.Provider value={{
      ownerId: 'owner_1', settings: { ...settings, [DIARY_DAY_VIEW_HEIGHT_SETTING_KEY]: 'compact' },
      isLoading: false,
    }}><OwnerDiaryContext.Provider value={{
      ownerId: 'owner_1', entries, isLoading: false,
    }}><DiaryDayPreview date={today} /></OwnerDiaryContext.Provider></OwnerSettingsContext.Provider>);
    expect(screen.getAllByRole('button', { name: 'Expand entry' })).toHaveLength(2);
    expect(calls.subscriptions.every(enabled => enabled === false)).toBe(true);
  });
});
