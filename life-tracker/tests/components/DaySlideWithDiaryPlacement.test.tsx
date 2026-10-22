import { describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { DaySlideWithDiaryPlacement } from '../../src/components/home/views/DaySlideWithDiaryPlacement';

const daySlideRender = vi.hoisted(() => vi.fn());
vi.mock('../../src/components/home/views/DaySlide', () => ({
  DaySlide: (props: unknown) => {
    daySlideRender(props);
    return null;
  },
}));

describe('DaySlideWithDiaryPlacement', () => {
  it('avoids redundant renders but forwards changed placement, date and writer', async () => {
    daySlideRender.mockClear();
    const setDiaryPlacement = vi.fn(async () => {});
    const onToggleTask = vi.fn();
    const onAddTask = vi.fn();
    const onOpenActions = vi.fn();
    const onOpenMemo = vi.fn();
    const onEditTask = vi.fn();
    const onViewImage = vi.fn();
    const onEditChange = vi.fn();
    const onEditSave = vi.fn();
    const onEditCancel = vi.fn();
    const props = {
      date: new Date(2026, 8, 15),
      dateStr: '2026-09-15',
      tasks: [],
      categories: [],
      currentUserId: 'user_1',
      editingTaskId: null,
      editValue: '',
      onToggleTask,
      onAddTask,
      onOpenActions,
      onOpenMemo,
      onEditTask,
      onViewImage,
      onEditChange,
      onEditSave,
      onEditCancel,
      savedDiaryPlacement: null,
      diaryPosition: 'top' as const,
      setDiaryPlacement,
    };
    const view = render(<DaySlideWithDiaryPlacement {...props} />);
    expect(daySlideRender).toHaveBeenCalledTimes(1);
    const first = daySlideRender.mock.lastCall?.[0] as {
      diaryPlacement: { kind: string };
      onMoveDiary: (placement: { kind: 'bottom' }) => Promise<void>;
    };
    expect(first.diaryPlacement).toEqual({ kind: 'top' });

    view.rerender(<DaySlideWithDiaryPlacement {...props} />);
    expect(daySlideRender).toHaveBeenCalledTimes(1);

    const savedDiaryPlacement = { kind: 'slot', categoryId: 'cat_1', index: 2 };
    view.rerender(<DaySlideWithDiaryPlacement {...props} savedDiaryPlacement={savedDiaryPlacement} />);
    expect(daySlideRender).toHaveBeenCalledTimes(2);
    const withPlacement = daySlideRender.mock.lastCall?.[0] as typeof first;
    expect(withPlacement.diaryPlacement).toEqual(savedDiaryPlacement);
    expect(withPlacement.onMoveDiary).toBe(first.onMoveDiary);

    // Changing only the account-scoped writer must not retain a stale setter.
    const nextWriter = vi.fn(async () => {});
    view.rerender(
      <DaySlideWithDiaryPlacement
        {...props}
        savedDiaryPlacement={savedDiaryPlacement}
        setDiaryPlacement={nextWriter}
      />,
    );
    const newWriterSameDate = daySlideRender.mock.lastCall?.[0] as typeof first;
    await newWriterSameDate.onMoveDiary({ kind: 'bottom' });
    expect(nextWriter).toHaveBeenCalledWith('diaryPlacement:2026-09-15', { kind: 'bottom' });
    expect(setDiaryPlacement).not.toHaveBeenCalled();

    // Changing only the selected day must write to the new date, not the old key.
    view.rerender(
      <DaySlideWithDiaryPlacement
        {...props}
        savedDiaryPlacement={savedDiaryPlacement}
        dateStr="2026-09-16"
        setDiaryPlacement={nextWriter}
      />,
    );
    const nextDay = daySlideRender.mock.lastCall?.[0] as typeof first;
    await nextDay.onMoveDiary({ kind: 'bottom' });
    expect(nextWriter).toHaveBeenCalledWith('diaryPlacement:2026-09-16', { kind: 'bottom' });
    cleanup();
  });
});
