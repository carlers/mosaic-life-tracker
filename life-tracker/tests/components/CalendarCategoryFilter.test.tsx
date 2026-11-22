import React from 'react';
import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarCategoryFilterPopup } from '../../src/components/home/views/CalendarCategoryFilterPopup';
import { MonthView } from '../../src/components/home/views/MonthView';
import { WeekView } from '../../src/components/home/views/WeekView';
import { useTasksByDate } from '../../src/hooks/useTasksByDate';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

const categories = [
  { id: 'school', name: 'School', color: '#4466ee' },
  { id: 'work', name: 'Work', color: '#ee9944' },
] as CategoryDocument[];
const tasks = [
  { id: 'a', date: '2026-11-23', categoryId: 'school', completed: false, title: 'School project' },
  { id: 'b', date: '2026-11-23', categoryId: 'work', completed: false, title: 'Work meeting' },
] as TaskDocument[];

describe('calendar filter UI', () => {
  it('toggles multiple categories, clears, and dismisses on Escape', () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };
    const view = render(<CalendarCategoryFilterPopup categories={categories}
      selectedIds={['school']} onToggle={onToggle} onClear={onClear}
      onClose={onClose} triggerRef={triggerRef} />);
    expect(screen.getByRole('checkbox', { name: 'School' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Work' }));
    expect(onToggle).toHaveBeenCalledWith('work');
    const onCalendarKeyDown = vi.fn();
    document.addEventListener('keydown', onCalendarKeyDown);
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'School' }), { key: 'ArrowRight' });
    expect(onCalendarKeyDown).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onCalendarKeyDown);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClear).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
    view.unmount();
    trigger.remove();
  });

  it('shows filtered task previews and counts in both grids while each date remains clickable', () => {
    const { result } = renderHook(() => useTasksByDate(tasks, ['school']));
    const map = result.current;
    expect(map.get('2026-11-23')?.map(task => task.id)).toEqual(['a']);
    expect(tasks.map(task => task.id)).toEqual(['a', 'b']);
    const onDayClick = vi.fn();
    const month = render(<MonthView focusDate={new Date(2026, 10, 23)}
      tasksByDate={map} categoriesMap={{ school: { name: 'School', color: '#4466ee' } }}
      onDayClick={onDayClick} />);
    const day = screen.getByRole('button', { name: 'Monday, November 23, 2026, 1 task' });
    expect(within(day).queryByText('Work meeting')).toBeNull();
    fireEvent.click(day);
    expect(onDayClick).toHaveBeenCalledWith(new Date(2026, 10, 23));
    month.unmount();
    render(<WeekView focusDate={new Date(2026, 10, 23)}
      tasksByDate={map} categoriesMap={{ school: { name: 'School', color: '#4466ee' } }}
      onDayClick={onDayClick} />);
    expect(screen.getByRole('button', { name: 'Monday, November 23, 2026, 1 task' })).toBeEnabled();
  });
});
