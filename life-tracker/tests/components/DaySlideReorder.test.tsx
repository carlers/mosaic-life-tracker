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

function hold(title: HTMLElement, pointerType = 'touch') {
  fireEvent.pointerDown(title, { pointerId: 7, pointerType, clientX: 30, clientY: 40 });
  act(() => vi.advanceTimersByTime(450));
}

function visibleCategoryOrder(categoryId: string) {
  const category = document.querySelector(`[data-category-id="${categoryId}"]`);
  if (!category) throw new Error(`Missing category ${categoryId}`);
  return within(category as HTMLElement).queryAllByTestId('task-row')
    .filter((row) => row.dataset.reorderAnchor !== 'true')
    .map((row) => row.dataset.taskId);
}

describe('DaySlide drag coordinator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('keeps the gesture-owning source row mounted while rows make room for the projection', () => {
    renderSlide();
    hold(screen.getByRole('button', { name: 'one' }));
    expect(screen.getByTestId('task-drag-overlay')).toHaveTextContent('one');
    const anchor = document.querySelector('[data-task-id="one"][data-reorder-anchor="true"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.closest('[data-category-id]')).toHaveAttribute('data-category-id', 'a');
    expect(visibleCategoryOrder('a')).toEqual(['two']);
    expect(visibleCategoryOrder('b')).toEqual(['three']);
    expect(screen.getAllByText('one')).toHaveLength(2);
  });

  it('keeps the final projection visible while persistence catches up', () => {
    let resolve!: () => void;
    const reorder = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    renderSlide(reorder);
    const destination = screen.getByRole('button', { name: 'three' }).closest('[data-task-id]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(destination);
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140, height: 40, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: vi.fn() });

    hold(screen.getByRole('button', { name: 'one' }));
    fireEvent.touchMove(window, { touches: [{ identifier: 0, clientX: 40, clientY: 110 }] });
    const placeholder = screen.getByTestId('task-drop-placeholder');
    expect(placeholder.closest('[data-category-id]')).toHaveAttribute('data-category-id', 'b');
    expect(placeholder).toHaveAttribute('data-task-drop-index', '0');

    fireEvent.touchEnd(window, { touches: [] });
    expect(reorder).toHaveBeenCalledTimes(1);
    expect(reorder.mock.calls[0][1]).toBe('b');
    expect(Object.isFrozen(reorder.mock.calls[0][2][0])).toBe(true);
    expect(visibleCategoryOrder('a')).toEqual(['two']);
    expect(visibleCategoryOrder('b')).toEqual(['one', 'three']);

    resolve();
  });

  it('ignores touch pointer cancellation after lift and continues through native touch events', () => {
    const reorder = renderSlide();
    const destination = screen.getByRole('button', { name: 'three' }).closest('[data-task-id]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(destination);
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140, height: 40, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: vi.fn() });

    hold(screen.getByRole('button', { name: 'one' }));
    fireEvent.pointerCancel(window, { pointerId: 7, pointerType: 'touch' });
    expect(screen.getByTestId('task-drag-overlay')).toBeInTheDocument();

    fireEvent.touchMove(window, { touches: [{ identifier: 0, clientX: 40, clientY: 110 }] });
    fireEvent.touchEnd(window, { touches: [] });
    expect(reorder).toHaveBeenCalledTimes(1);
  });

  it('cancels touch reordering only on native touch cancellation', () => {
    const reorder = renderSlide();
    hold(screen.getByRole('button', { name: 'one' }));
    fireEvent.touchCancel(window);
    expect(screen.queryByTestId('task-drag-overlay')).toBeNull();
    expect(reorder).not.toHaveBeenCalled();
    expect(visibleCategoryOrder('a')).toEqual(['one', 'two']);
  });

  it('cancels non-touch reordering on pointer cancellation', () => {
    const reorder = renderSlide();
    hold(screen.getByRole('button', { name: 'one' }), 'mouse');
    fireEvent.pointerCancel(window, { pointerId: 7, pointerType: 'mouse' });
    expect(screen.queryByTestId('task-drag-overlay')).toBeNull();
    expect(reorder).not.toHaveBeenCalled();
  });
});
