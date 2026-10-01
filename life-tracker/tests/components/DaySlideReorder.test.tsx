import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderSlide(onReorderTask = vi.fn().mockResolvedValue(undefined)) {
  render(<DaySlide date={new Date('2026-09-30')} dateStr="2026-09-30" tasks={tasks} categories={categories}
    currentUserId="user" editingTaskId={null} editValue="" reorderEnabled onReorderTask={onReorderTask}
    onToggleTask={vi.fn()} onAddTask={vi.fn()} onOpenActions={vi.fn()} onOpenMemo={vi.fn()} onEditTask={vi.fn()}
    onViewImage={vi.fn()} onEditChange={vi.fn()} onEditSave={vi.fn()} onEditCancel={vi.fn()} />);
  return onReorderTask;
}

function lift(title: string, pointerType = 'mouse') {
  vi.useFakeTimers();
  const target = screen.getByRole('button', { name: title });
  fireEvent.pointerDown(target, { pointerId: 7, pointerType, button: 0, clientX: 30, clientY: 40 });
  act(() => {
    vi.advanceTimersByTime(500);
  });
  return target;
}

function visibleCategoryOrder(categoryId: string) {
  const category = document.querySelector(`[data-category-id="${categoryId}"]`);
  if (!category) throw new Error(`Missing category ${categoryId}`);
  return within(category as HTMLElement).queryAllByTestId('task-row')
    .filter((row) => row.dataset.reorderAnchor !== 'true')
    .map((row) => row.dataset.taskId);
}

describe('DaySlide drag coordinator', () => {
  it('starts only after a stationary title long-press and exposes no reorder grip', () => {
    renderSlide();
    vi.useFakeTimers();
    const title = screen.getByRole('button', { name: 'one' });

    expect(screen.queryByRole('button', { name: 'Reorder one' })).toBeNull();
    fireEvent.pointerDown(title, { pointerId: 7, pointerType: 'touch', button: 0, clientX: 30, clientY: 40 });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(screen.queryByTestId('task-drag-overlay')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('task-drag-overlay')).toHaveTextContent('one');
  });

  it('lets movement win before the hold threshold instead of starting reorder', () => {
    renderSlide();
    vi.useFakeTimers();
    const title = screen.getByRole('button', { name: 'one' });
    fireEvent.pointerDown(title, { pointerId: 7, pointerType: 'touch', button: 0, clientX: 30, clientY: 40 });
    fireEvent.pointerMove(title, { pointerId: 7, pointerType: 'touch', clientX: 30, clientY: 80 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId('task-drag-overlay')).toBeNull();
  });

  it('keeps every non-dragged task visible and the source row mounted after lift', () => {
    renderSlide();
    lift('one');
    expect(screen.getByTestId('task-drag-overlay')).toHaveTextContent('one');
    const anchor = document.querySelector('[data-task-id="one"][data-reorder-anchor="true"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.closest('[data-category-id]')).toHaveAttribute('data-category-id', 'a');
    expect(screen.getAllByTestId('task-row')).toHaveLength(3);
    expect(visibleCategoryOrder('a')).toEqual(['two']);
    expect(visibleCategoryOrder('b')).toEqual(['three']);
  });

  it('keeps the final projection visible while persistence catches up', () => {
    let resolve!: () => void;
    const reorder = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    renderSlide(reorder);
    const destination = screen.getByRole('button', { name: 'three' }).closest('[data-task-id]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(destination);
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140, height: 40, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: vi.fn() });

    lift('one');
    fireEvent.pointerMove(window, { pointerId: 7, pointerType: 'mouse', clientX: 40, clientY: 110 });
    const placeholder = screen.getByTestId('task-drop-placeholder');
    expect(placeholder.closest('[data-category-id]')).toHaveAttribute('data-category-id', 'b');
    expect(placeholder).toHaveAttribute('data-task-drop-index', '0');

    fireEvent.pointerUp(window, { pointerId: 7, pointerType: 'mouse', clientX: 40, clientY: 110 });
    expect(reorder).toHaveBeenCalledTimes(1);
    expect(reorder.mock.calls[0][1]).toBe('b');
    expect(Object.isFrozen(reorder.mock.calls[0][2][0])).toBe(true);
    expect(visibleCategoryOrder('a')).toEqual(['two']);
    expect(visibleCategoryOrder('b')).toEqual(['one', 'three']);

    resolve();
  });

  it('restores the live order when persistence rejects', async () => {
    const reorder = vi.fn().mockRejectedValue(new Error('write failed'));
    renderSlide(reorder);
    const destination = screen.getByRole('button', { name: 'three' }).closest('[data-task-id]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(destination);
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140, height: 40, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: vi.fn() });

    lift('one');
    fireEvent.pointerMove(window, { pointerId: 7, pointerType: 'mouse', clientX: 40, clientY: 110 });
    fireEvent.pointerUp(window, { pointerId: 7, pointerType: 'mouse', clientX: 40, clientY: 110 });
    expect(visibleCategoryOrder('b')).toEqual(['one', 'three']);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(visibleCategoryOrder('a')).toEqual(['one', 'two']);
    expect(visibleCategoryOrder('b')).toEqual(['three']);
  });

  it('keeps touch drag alive through pointer cancellation until native touch cancellation', () => {
    const reorder = renderSlide();
    vi.useFakeTimers();
    const title = screen.getByRole('button', { name: 'one' });
    const touch = { identifier: 11, clientX: 30, clientY: 40 };

    fireEvent.touchStart(title, { changedTouches: [touch], touches: [touch] });
    fireEvent.pointerDown(title, { pointerId: 7, pointerType: 'touch', button: 0, clientX: 30, clientY: 40 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('task-drag-overlay')).toBeVisible();

    fireEvent.pointerCancel(window, { pointerId: 7, pointerType: 'touch' });
    expect(screen.getByTestId('task-drag-overlay')).toBeVisible();

    fireEvent.touchCancel(window, { changedTouches: [touch], touches: [] });
    expect(screen.queryByTestId('task-drag-overlay')).toBeNull();
    expect(reorder).not.toHaveBeenCalled();
  });
});
