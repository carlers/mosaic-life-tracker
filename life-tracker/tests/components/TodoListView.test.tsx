import { format } from 'date-fns';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

const dayLayoutSettings = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  setSetting: vi.fn(async (key: string, value: unknown) => { dayLayoutSettings.values[key] = value; }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string, fallback: unknown) => dayLayoutSettings.values[key] ?? fallback,
    setSetting: dayLayoutSettings.setSetting,
  }),
}));
vi.mock('../../src/components/home/views/DayDetailPanel', () => ({
  DayDetailPanel: ({ side, initialHeightMode, selectedDate, showDiaryAlways, onClose }: {
    side: string; initialHeightMode: string; selectedDate: Date;
    showDiaryAlways?: boolean; onClose: () => void;
  }) => <div data-testid="todo-side-panel-mock" data-side={side}
    data-height={initialHeightMode} data-diary={String(Boolean(showDiaryAlways))}
    data-selected-date={format(selectedDate, 'yyyy-MM-dd')}>
    <button type="button" onClick={onClose}>Switch to Bottom</button>
  </div>,
}));

vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: ({
    selectedDate,
    onDateChange,
    renderMode,
    tasks,
    categories,
  }: {
    selectedDate: Date;
    onDateChange?: (date: Date) => void;
    renderMode?: 'sheet' | 'inline';
    tasks?: TaskDocument[];
    categories?: CategoryDocument[];
  }) => (
    <div
      data-testid="inline-day-view-mock"
      data-render-mode={renderMode}
      data-selected-date={`${selectedDate.getFullYear()}-${String(
        selectedDate.getMonth() + 1
      ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`}
    >
      <h3>{format(selectedDate, 'EEEE, MMMM d')}</h3>
      <span>{tasks?.[0]?.title ?? 'No passed task'}</span>
      <span>{categories?.[0]?.name ?? 'No passed category'}</span>
      <button
        type="button"
        onClick={() => onDateChange?.(new Date(2026, 9, 1))}
      >
        Swipe to October 1
      </button>
    </div>
  ),
}));

import { TodoListView } from '../../src/components/home/views/TodoListView';

const tasks: TaskDocument[] = [
  {
    id: 'task_1',
    title: 'Plan release',
    completed: false,
    categoryId: 'work',
    order: 0,
    date: '2026-09-15',
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: '',
    updatedAt: '2026-09-01T00:00:00.000Z',
    userId: 'user_1',
    isDeleted: false,
    visibility: 'private',
  },
];

const categories: CategoryDocument[] = [
  {
    id: 'work',
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    userId: 'user_1',
    isDeleted: false,
  },
];

const props = {
  focusDate: new Date(2026, 8, 15),
  tasks,
  categories,
  categoriesMap: { work: { color: '#3B82F6', name: 'Work' } },
  onFocusDateChange: vi.fn(),
};

describe('TodoListView', () => {
  // Regression: §2 (Todo List behavior).
  it('keeps the compact calendar color-only and passes the selected-day data into the inline Day View surface', () => {
    render(<TodoListView {...props} />);

    const grid = screen.getByRole('grid', {
      name: 'September 2026 todo calendar',
    });
    const selectedDay = within(grid).getByRole('gridcell', {
      name: 'Tuesday, September 15, 2026, 1 task',
    });
    expect(within(grid).getAllByRole('row')).toHaveLength(6);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(35);
    expect(within(selectedDay).queryByText('Plan release')).toBeNull();
    expect(selectedDay).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(selectedDay);

    expect(
      screen.getByRole('heading', { name: 'Tuesday, September 15' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('inline-day-view-mock')).toHaveAttribute(
      'data-render-mode',
      'inline'
    );
    expect(screen.getByTestId('inline-day-view-mock')).toHaveAttribute(
      'data-selected-date',
      '2026-09-15'
    );
    expect(screen.getByText('Plan release')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  // Regression: §2 (only six-week months render six calendar rows).
  it('keeps a required six-week month visible without forcing six weeks on shorter months', () => {
    render(<TodoListView {...props} focusDate={new Date(2026, 7, 15)} />);

    const grid = screen.getByRole('grid', { name: 'August 2026 todo calendar' });
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(42);
    expect(
      within(grid).getByRole('gridcell', {
        name: 'Monday, August 31, 2026, 0 tasks',
      })
    ).toBeInTheDocument();
  });

  // Regression: §2 (Todo grid supports arrow-key day/week selection).
  it('moves the selected Todo day with arrow keys', () => {
    render(<TodoListView {...props} />);
    const grid = screen.getByRole('grid', { name: 'September 2026 todo calendar' });
    const selectedDay = within(grid).getByRole('gridcell', {
      name: 'Tuesday, September 15, 2026, 1 task',
    });

    fireEvent.keyDown(selectedDay, { key: 'ArrowRight' });

    expect(
      screen.getByRole('heading', { name: 'Wednesday, September 16' })
    ).toBeInTheDocument();
  });

  // Regression: §16 (compact month swipes keep a bounded render window).
  it('mounts at most three compact month grids worth of day buttons', () => {
    render(<TodoListView {...props} />);

    const carousel = screen.getByTestId('todo-calendar-grid');
    expect(within(carousel).getAllByRole('button', { hidden: true }).length).toBeLessThanOrEqual(126);
  });

  // Regression: §2 (day taps select dates, including spillover days).
  it('selects a tapped spillover day and requests its month', () => {
    const onFocusDateChange = vi.fn();
    render(
      <TodoListView
        {...props}
        onFocusDateChange={onFocusDateChange}
      />
    );

    const grid = screen.getByRole('grid', {
      name: 'September 2026 todo calendar',
    });
    fireEvent.click(
      within(grid).getByRole('gridcell', {
        name: 'Thursday, October 1, 2026, 0 tasks',
      })
    );

    expect(onFocusDateChange).toHaveBeenCalledWith(new Date(2026, 9, 1));
    expect(
      screen.getByRole('heading', { name: 'Thursday, October 1' })
    ).toBeInTheDocument();
  });

  it('moves the selected day into the displayed month after month navigation', () => {
    const { rerender } = render(<TodoListView {...props} />);

    rerender(
      <TodoListView
        {...props}
        focusDate={new Date(2026, 9, 15)}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Thursday, October 15' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('inline-day-view-mock')).toHaveAttribute(
      'data-selected-date',
      '2026-10-15'
    );
  });

  // Regression: §2/§7 (inline day swipes own their date navigation).
  it('updates the visible month when the inline day view swipes across a month boundary', () => {
    const onFocusDateChange = vi.fn();
    render(
      <TodoListView
        {...props}
        focusDate={new Date(2026, 8, 30)}
        onFocusDateChange={onFocusDateChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Swipe to October 1' }));

    expect(
      screen.getByRole('heading', { name: 'Thursday, October 1' })
    ).toBeInTheDocument();
    expect(onFocusDateChange).toHaveBeenCalledWith(new Date(2026, 9, 1));
  });
});

describe('Todo and Diary split panel', () => {
  it('uses the left-side day panel for Todo and preserves calendar selection', async () => {
    dayLayoutSettings.values = { dayDetailPresentation: 'panel', dayPanelSide: 'left', dayPanelHeight: 'screen' };
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, width: 1440, height: 750, top: 0, left: 0,
        right: 1440, bottom: 750, toJSON: () => ({}) } as DOMRect;
    };
    try {
      render(<TodoListView {...props} />);
      const panel = await screen.findByTestId('todo-side-panel-mock');
      expect(panel).toHaveAttribute('data-side', 'left');
      expect(panel).toHaveAttribute('data-height', 'screen');
      expect(panel).toHaveAttribute('data-selected-date', '2026-09-15');
      expect(screen.queryByTestId('inline-day-view-mock')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('gridcell', { name: 'Wednesday, September 16, 2026, 0 tasks' }));
      expect(panel).toHaveAttribute('data-selected-date', '2026-09-16');
      fireEvent.click(screen.getByRole('button', { name: 'Switch to Bottom' }));
      expect(dayLayoutSettings.setSetting).toHaveBeenCalledWith('dayDetailPresentation', 'sheet');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
      dayLayoutSettings.values = {};
    }
  });
  it('shares the same panel in Diary mode and passes the diary flag', async () => {
    dayLayoutSettings.values = { dayDetailPresentation: 'panel', dayPanelSide: 'right' };
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, width: 1440, height: 750, top: 0, left: 0,
        right: 1440, bottom: 750, toJSON: () => ({}) } as DOMRect;
    };
    try {
      render(<TodoListView {...props} markerMode="diary" />);
      const panel = await screen.findByTestId('todo-side-panel-mock');
      expect(panel).toHaveAttribute('data-diary', 'true');
      expect(panel).toHaveAttribute('data-side', 'right');
      expect(screen.getByTestId('todo-calendar-grid')).toBeInTheDocument();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
      dayLayoutSettings.values = {};
    }
  });
});
