import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerSettingsContext } from '../../src/hooks/calendarDiaryContext';
import { useSettings } from '../../src/hooks/useSettings';

const mock = vi.hoisted(() => ({
  ownerId: 'owner_1',
  localSettings: { diaryDayViewHeight: 'compact' } as Record<string, unknown>,
  subscribed: [] as boolean[],
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: mock.ownerId } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: ({ enabled }: { enabled?: boolean }) => {
    mock.subscribed.push(enabled ?? true);
    return { data: mock.localSettings, isLoading: false };
  },
}));

function ReadGroupPreferences({ date }: { date: string }) {
  const { getSetting, isLoading } = useSettings();
  return <div>
    <output aria-label="Diary group height">{String(getSetting('diaryDayViewHeight', 'compact'))}</output>
    <output aria-label="Diary group order">{String(getSetting('diaryEntryOrderMode:' + date, 'oldest'))}</output>
    <output aria-label="Settings ready">{String(!isLoading)}</output>
  </div>;
}
const mounted = (date: string, settings: Record<string, unknown>, ownerId = 'owner_1', isLoading = false) => (
  <OwnerSettingsContext.Provider value={{ ownerId, settings, isLoading }}>
    <ReadGroupPreferences date={date} />
  </OwnerSettingsContext.Provider>
);

describe('owner settings inherited by virtual Day View slides', () => {
  beforeEach(() => {
    mock.ownerId = 'owner_1';
    mock.subscribed.length = 0;
  });

  it('uses hydrated expansion and order on the first render of every virtual date', () => {
    const settings = {
      diaryDayViewHeight: 'expanded',
      'diaryEntryOrderMode:2026-11-25': 'newest',
      'diaryEntryOrderMode:2026-11-26': 'manual',
      'diaryEntryOrderMode:2026-11-27': 'newest',
    };
    const { rerender } = render(mounted('2026-11-26', settings));
    expect(screen.getByLabelText('Diary group height').textContent).toBe('expanded');
    expect(screen.getByLabelText('Diary group order').textContent).toBe('manual');
    rerender(mounted('2026-11-25', settings));
    expect(screen.getByLabelText('Diary group order').textContent).toBe('newest');
    rerender(mounted('2026-11-27', settings));
    expect(screen.getByLabelText('Diary group order').textContent).toBe('newest');
    expect(mock.subscribed.every(enabled => enabled === false)).toBe(true);
    expect(mock.subscribed.length).toBeGreaterThan(0);
  });

  it('propagates live owner setting changes without a second subscription', () => {
    const { rerender } = render(mounted('2026-11-26',
      { diaryDayViewHeight: 'compact' }));
    rerender(mounted('2026-11-26',
      { diaryDayViewHeight: 'expanded' }));
    expect(screen.getByLabelText('Diary group height').textContent).toBe('expanded');
    expect(mock.subscribed.every(enabled => enabled === false)).toBe(true);
  });

  it('preserves the cold owner settings readiness boundary', () => {
    render(mounted('2026-11-26', {}, 'owner_1', true));
    expect(screen.getByLabelText('Settings ready').textContent).toBe('false');
    expect(mock.subscribed).toEqual([false]);
  });

  it('rejects a previous account snapshot and subscribes to current account', () => {
    mock.ownerId = 'owner_2';
    render(mounted('2026-11-26', { diaryDayViewHeight: 'expanded' }));
    expect(screen.getByLabelText('Diary group height').textContent).toBe('compact');
    expect(mock.subscribed).toEqual([true]);
  });

  it('keeps isolated views working without a parent snapshot', () => {
    render(<ReadGroupPreferences date="2026-11-26" />);
    expect(screen.getByLabelText('Diary group height').textContent).toBe('compact');
    expect(mock.subscribed).toEqual([true]);
  });
});
