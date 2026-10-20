import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayCell } from '../../src/components/home/views/DayCell';
import { MonthView } from '../../src/components/home/views/MonthView';
import { WeekView } from '../../src/components/home/views/WeekView';
import { CALENDAR_TASK_PREVIEW_LIMITS } from '../../src/lib/preferences';
import type { TaskDocument } from '../../src/db/schema';
import type { SharedTaskItem } from '../../src/lib/taskShareQueue';

const date = new Date(2026, 8, 15);
const categories = { cat: { color: '#5588aa', name: 'Work' } };
const makeTasks = (count: number): TaskDocument[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `owned_${index}`,
    title: `Task ${index + 1}`,
    date: '2026-09-15',
    categoryId: 'cat',
    completed: false,
    image: '',
  })) as TaskDocument[];

const previews = (button: HTMLElement) => within(button).queryAllByText(/^Task \d+$/);

describe('calendar per-day task preview limit', () => {
  it.each(CALENDAR_TASK_PREVIEW_LIMITS)('caps a dense day at %i without losing its task count or date action', limit => {
    const onDayClick = vi.fn();
    render(
      <DayCell date={date} tasks={makeTasks(22)} categories={categories}
        taskPreviewLimit={limit} onDayClick={onDayClick} />
    );
    const day = screen.getByRole('button', {
      name: `Tuesday, September 15, 2026, 22 tasks, ${22 - limit} more not previewed`,
    });
    expect(previews(day)).toHaveLength(limit);
    expect(within(day).getByText(`+${22 - limit} more tasks`)).toBeInTheDocument();
    fireEvent.click(day);
    expect(onDayClick).toHaveBeenCalledWith(date);
  });

  it('preserves unlimited display for missing and explicit unlimited preferences', () => {
    const tasks = makeTasks(22);
    const rendered = render(<DayCell date={date} tasks={tasks} categories={categories} />);
    expect(previews(screen.getByRole('button', { name: 'Tuesday, September 15, 2026, 22 tasks' }))).toHaveLength(22);
    expect(screen.queryByText(/more tasks/)).not.toBeInTheDocument();

    rendered.rerender(<DayCell date={date} tasks={tasks} categories={categories} taskPreviewLimit="unlimited" />);
    expect(previews(screen.getByRole('button', { name: 'Tuesday, September 15, 2026, 22 tasks' }))).toHaveLength(22);
  });

  it('updates memoized cells on preference changes, preserving completion-first order', () => {
    const tasks = makeTasks(6);
    tasks[5].completed = true;
    const onDayClick = vi.fn();
    const rendered = render(<DayCell date={date} tasks={tasks} categories={categories}
      taskPreviewLimit={3} onDayClick={onDayClick} />);
    let day = screen.getByRole('button', { name: /6 tasks, 3 more not previewed/ });
    expect(previews(day).map(element => element.textContent)).toEqual(['Task 6', 'Task 1', 'Task 2']);

    rendered.rerender(<DayCell date={date} tasks={tasks} categories={categories}
      taskPreviewLimit={5} onDayClick={onDayClick} />);
    day = screen.getByRole('button', { name: /6 tasks, 1 more not previewed/ });
    expect(previews(day)).toHaveLength(5);
    expect(within(day).getByText('+1 more tasks')).toBeInTheDocument();
  });

  it('counts owned and received shared previews together without consuming holiday slots', () => {
    const shares = Array.from({ length: 3 }, (_, i) => ({
      id: `received_${i}`, title: `Received ${i + 1}`,
    })) as SharedTaskItem[];
    render(<DayCell date={date} tasks={makeTasks(2)} categories={categories}
      sharedItems={shares} taskPreviewLimit={3}
      holidays={[{ id: 'holiday', date: '2026-09-15', title: 'Special Day',
        countryCode: 'PH', types: ['Observance'] }]} />);
    const day = screen.getByRole('button', {
      name: 'Tuesday, September 15, 2026, holiday: Special Day, 5 tasks, 2 more not previewed',
    });
    expect(previews(day)).toHaveLength(2);
    expect(within(day).getByText('Received 1')).toBeInTheDocument();
    expect(within(day).queryByText('Received 2')).not.toBeInTheDocument();
    expect(within(day).getByText('Special Day')).toBeInTheDocument();
    expect(within(day).getByText('+2 more tasks')).toBeInTheDocument();
  });

  it.each(['month', 'week'] as const)('propagates the limit through %s calendar, including mobile zoom', mode => {
    const onDayClick = vi.fn();
    const tasksByDate = new Map([['2026-09-15', makeTasks(7)]]);
    if (mode === 'month') {
      render(<MonthView focusDate={date} zoomDays={3} taskPreviewLimit={5}
        tasksByDate={tasksByDate} categoriesMap={categories} onDayClick={onDayClick} />);
    } else {
      render(<WeekView focusDate={date} zoomDays={4} taskPreviewLimit={5}
        tasksByDate={tasksByDate} categoriesMap={categories} onDayClick={onDayClick} />);
    }
    const day = screen.getByRole('button', {
      name: 'Tuesday, September 15, 2026, 7 tasks, 2 more not previewed',
    });
    expect(previews(day)).toHaveLength(5);
    expect(within(day).getByText('+2 more tasks')).toBeInTheDocument();
    fireEvent.click(day);
    expect(onDayClick).toHaveBeenCalledWith(date);
  });
});
