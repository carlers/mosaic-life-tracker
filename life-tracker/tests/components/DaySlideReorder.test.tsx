import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DaySlide } from '../../src/components/home/views/DaySlide';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

vi.mock('../../src/hooks/useImageLoadGate', () => ({ useImageLoadGate: () => ({ targetRef: { current: null }, shouldLoad: false }) }));
vi.mock('../../src/hooks/useTaskImage', () => ({ useTaskImage: () => ({ imageUrl: null, isLoading: false }) }));

const categories = [
  { id: 'a', name: 'Alpha', color: '#2563eb', visibility: 'private' },
  { id: 'b', name: 'Beta', color: '#16a34a', visibility: 'private' },
] as CategoryDocument[];
const makeTask = (id: string, categoryId: string): TaskDocument => ({
  id, categoryId, title: id, completed: false, date: '2026-09-30', createdAt: id,
  updatedAt: id, userId: 'user', isDeleted: false, visibility: '', order: 0,
});
const tasks = [makeTask('one', 'a'), makeTask('two', 'a'), makeTask('three', 'b')];

function renderSlide(onReorderTask = vi.fn().mockResolvedValue(undefined)) {
  render(<DaySlide date={new Date('2026-09-30')} dateStr="2026-09-30" tasks={tasks} categories={categories}
    currentUserId="user" editingTaskId={null} editValue="" reorderEnabled onReorderTask={onReorderTask}
    onToggleTask={vi.fn()} onAddTask={vi.fn()} onOpenActions={vi.fn()} onOpenMemo={vi.fn()} onEditTask={vi.fn()}
    onViewImage={vi.fn()} onEditChange={vi.fn()} onEditSave={vi.fn()} onEditCancel={vi.fn()} />);
  return onReorderTask;
}

function hold(title: HTMLElement) {
  fireEvent.pointerDown(title, { pointerId: 7, pointerType: 'touch', clientX: 30, clientY: 40 });
  act(() => vi.advanceTimersByTime(450));
}

function categoryOrder(categoryId: string) {
  const category = document.querySelector(`[data-category-id="${categoryId}"]`);
  if (!category) throw new Error(`Missing category ${categoryId}`);
  return within(category as HTMLElement).queryAllByTestId('task-row').map((row) => row.dataset.taskId);
}

describe('DaySlide drag coordinator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('keeps every source row mounted and displays a pointer-following overlay after hold', () => {
    renderSlide();
    hold(screen.getByRole('button', { name: 'one' }));
    expect(screen.getByTestId('task-drag-overlay')).toHaveTextContent('one');
    expect(categoryOrder('a')).toEqual(['one', 'two']);
    expect(categoryOrder('b')).toEqual(['three']);
    expect(screen.getAllByText('one')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'two' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'three' })).toBeInTheDocument();
  });

  it('commits one frozen cross-category projection on release', () => {
    const reorder = renderSlide();
    const destination = screen.getByRole('button', { name: 'three' }).closest('[data-task-id]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(destination);
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140, height: 40, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: vi.fn() });
    hold(screen.getByRole('button', { name: 'one' }));
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 40, clientY: 110 });
    expect(categoryOrder('a')).toEqual(['two']);
    expect(categoryOrder('b')).toEqual(['one', 'three']);
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 40, clientY: 110 });
    expect(reorder).toHaveBeenCalledTimes(1);
    expect(reorder.mock.calls[0][1]).toBe('b');
    expect(Object.isFrozen(reorder.mock.calls[0][2][0])).toBe(true);
  });

  it('keeps tracking an activated touch through native touch events', () => {
    const reorder = renderSlide();
    const destination = screen.getByRole('button', { name: 'three' }).closest('[data-task-id]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(destination);
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140, height: 40, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: vi.fn() });

    hold(screen.getByRole('button', { name: 'one' }));
    fireEvent.touchMove(window, { touches: [{ identifier: 0, clientX: 40, clientY: 110 }] });

    expect(categoryOrder('a')).toEqual(['two']);
    expect(categoryOrder('b')).toEqual(['one', 'three']);

    fireEvent.touchEnd(window, { touches: [] });
    expect(reorder).toHaveBeenCalledTimes(1);
  });

  it('discards a touch projection when the browser only sends pointer cancellation', () => {
    const reorder = renderSlide();
    hold(screen.getByRole('button', { name: 'one' }));
    fireEvent.pointerCancel(window, { pointerId: 7, pointerType: 'touch' });
    expect(screen.queryByTestId('task-drag-overlay')).toBeNull();
    expect(reorder).not.toHaveBeenCalled();
    expect(screen.getAllByText('one')).toHaveLength(1);
  });
});
