import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import { DISABLED_HOLIDAY_CONFIG } from '../../src/lib/holidays';

vi.mock('../../src/components/home/views/dayViewSheetModule', () => ({
  LazyDayViewSheet: ({ tasks }: { tasks: TaskDocument[] }) =>
    'owner:' + tasks.map(task => task.title).join('|'),
}));
vi.mock('../../src/components/friend/friendDayViewSheetModule', () => ({
  LazyFriendDayViewSheet: ({ tasks }: { tasks: TaskDocument[] }) =>
    'friend:' + tasks.map(task => task.title).join('|'),
}));

import { CalendarDaySheetLayer } from '../../src/components/home/views/CalendarDaySheetLayer';

const tasks = [
  { id: 'matching', title: 'Report ready' },
  { id: 'hidden', title: 'Other task' },
] as TaskDocument[];

describe('Calendar Day View lazy layer', () => {
  const common = {
    isOpen: true,
    selectedDate: new Date(2026, 10, 23),
    onDateChange: vi.fn(),
    onClose: vi.fn(),
    tasks,
    categories: [],
    friendCategories: [],
    friendName: 'Friend',
    currentUserId: 'owner',
    holidayConfig: DISABLED_HOLIDAY_CONFIG,
  };

  it('preserves all original owner tasks, including those hidden in Calendar previews', () => {
    render(<CalendarDaySheetLayer {...common} isFriend={false} />);
    expect(screen.getByText('owner:Report ready|Other task')).toBeInTheDocument();
    expect(screen.queryByText(/friend:/)).not.toBeInTheDocument();
  });

  it('retains the existing friend-specific Day View sheet', () => {
    render(<CalendarDaySheetLayer {...common} isFriend />);
    expect(screen.getByText('friend:Report ready|Other task')).toBeInTheDocument();
  });
});
