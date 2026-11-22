import React from 'react';
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarCategoryFilterPopup } from '../../src/components/home/views/CalendarCategoryFilterPopup';
import { placeCalendarCategoryPopup } from '../../src/lib/calendarCategoryPopupPlacement';
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
      selectedIds={['school']} textQuery="" onTextChange={vi.fn()} onToggle={onToggle} onClear={onClear}
      onClose={onClose} triggerRef={triggerRef} />);
    expect(screen.getByRole('searchbox', { name: 'Search task titles' })).toHaveFocus();
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

  it('portals outside clipped calendar ancestors and flips above a low trigger', () => {
    const clipped = document.createElement('div');
    clipped.style.overflow = 'hidden';
    const trigger = document.createElement('button');
    clipped.appendChild(trigger);
    document.body.appendChild(clipped);
    const bottom = window.innerHeight - 12;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 360, right: 392, top: bottom - 28, bottom, width: 32, height: 28,
    } as DOMRect);
    const view = render(<CalendarCategoryFilterPopup categories={categories}
      selectedIds={[]} textQuery="" onTextChange={vi.fn()} onToggle={vi.fn()} onClear={vi.fn()}
      onClose={vi.fn()} triggerRef={{ current: trigger }} />);
    const popup = screen.getByRole('dialog', { name: 'Filter calendar by category' });
    expect(popup.parentElement).toBe(document.body);
    expect(popup.style.position).toBe('fixed');
    expect(popup.style.bottom).not.toBe('');
    expect(popup.style.top).toBe('');
    expect(Number.parseInt(popup.style.maxHeight, 10)).toBeLessThanOrEqual(window.innerHeight - 48);
    view.unmount();
    clipped.remove();
  });

  it('repositions on grid scrolling without scrolling or dismissing the options', async () => {
    const trigger = document.createElement('button');
    const calendarScroller = document.createElement('div');
    calendarScroller.style.overflow = 'auto';
    calendarScroller.appendChild(trigger);
    document.body.appendChild(calendarScroller);
    let top = 110;
    vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => ({
      left: 300, right: 332, top, bottom: top + 28, width: 32, height: 28,
    } as DOMRect));
    const onClose = vi.fn();
    const view = render(<CalendarCategoryFilterPopup categories={categories}
      selectedIds={['school']} textQuery="" onTextChange={vi.fn()} onToggle={vi.fn()} onClear={vi.fn()}
      onClose={onClose} triggerRef={{ current: trigger }} />);
    const popup = screen.getByRole('dialog', { name: 'Filter calendar by category' });
    expect(popup.style.top).not.toBe('');
    top = window.innerHeight - 42;
    fireEvent.scroll(calendarScroller);
    await waitFor(() => expect(popup.style.bottom).not.toBe(''));
    expect(popup.style.top).toBe('');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.scroll(popup.querySelector('.overflow-y-auto')!);
    expect(onClose).not.toHaveBeenCalled();
    view.unmount();
    calendarScroller.remove();
  });

  it('clamps geometry to the visual viewport when there is little space below', () => {
    const placement = placeCalendarCategoryPopup(
      { top: 400, bottom: 428, right: 425 }, 30,
      { top: 10, left: 25, width: 320, height: 450 }, 768
    );
    expect(placement.left).toBeGreaterThanOrEqual(33);
    expect(placement.left + placement.width).toBeLessThanOrEqual(337);
    expect(placement.maxHeight).toBeLessThanOrEqual(382);
    expect(placement.bottom).toBeDefined();
  });

  it('keeps text entry, clear-text and clearing all filters independently usable', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    const onClear = vi.fn();
    const onTextChange = vi.fn();
    const view = render(<CalendarCategoryFilterPopup categories={categories}
      selectedIds={['school']} textQuery="report" onTextChange={onTextChange}
      onToggle={vi.fn()} onClear={onClear} onClose={vi.fn()}
      triggerRef={{ current: trigger }} />);
    const input = screen.getByRole('searchbox', { name: 'Search task titles' });
    expect(input).toHaveValue('report');
    fireEvent.change(input, { target: { value: '  REPORT  ' } });
    expect(onTextChange).toHaveBeenCalledWith('  REPORT  ');
    fireEvent.click(screen.getByRole('button', { name: 'Clear task text' }));
    expect(onTextChange).toHaveBeenCalledWith('');
    fireEvent.click(screen.getByRole('button', { name: 'All categories' }));
    expect(onClear).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalledTimes(2);
    expect(onTextChange).toHaveBeenLastCalledWith('');
    view.unmount();
    trigger.remove();
  });

  it('matches task titles case-insensitively with category OR then text AND without reordering', () => {
    const source = [...tasks,
      { id: 'c', date: '2026-11-23', categoryId: 'school', title: 'Weekly notes', memo: 'Project' },
      { id: 'd', date: '2026-11-23', categoryId: 'work', title: 'Project milestone' },
      { id: 'e', date: '2026-11-23', categoryId: 'other', title: 'project outside category' },
    ] as TaskDocument[];
    const { result, rerender } = renderHook(
      ({ ids, text }: { ids: string[]; text: string }) => useTasksByDate(source, ids, text),
      { initialProps: { ids: ['school', 'work'], text: '  pRoJeCt  ' } }
    );
    expect(result.current.get('2026-11-23')?.map(task => task.id)).toEqual(['a', 'd']);
    rerender({ ids: [], text: 'PROJECT' });
    expect(result.current.get('2026-11-23')?.map(task => task.id)).toEqual(['a', 'd', 'e']);
    rerender({ ids: ['school'], text: 'meeting' });
    expect(result.current.has('2026-11-23')).toBe(false);
    rerender({ ids: ['school'], text: '   ' });
    expect(result.current.get('2026-11-23')?.map(task => task.id)).toEqual(['a', 'c']);
    expect(source.map(task => task.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
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
