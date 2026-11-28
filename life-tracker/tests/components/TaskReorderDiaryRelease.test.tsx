import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiaryPlacement } from '../../src/lib/diaryPlacement';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../src/db/schema';
import { diaryDayLayoutKey, diaryNotePositionKey } from '../../src/lib/diaryNotes';

// Keep the real reorder runtime and its placement/persistence logic. Replace
// only the sensor and rendering engine so release collisions can be specified
// deterministically, including a null target after the gap has visibly moved.
const drag = vi.hoisted(() => ({
  start: null as unknown,
  over: null as unknown,
  end: null as unknown,
}));
vi.mock('@dnd-kit/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@dnd-kit/react')>();
  const react = await import('react');
  return {
    ...actual,
    DragDropProvider: ({ children, onDragStart, onDragOver, onDragEnd }: {
      children: React.ReactNode;
      onDragStart?: unknown;
      onDragOver?: unknown;
      onDragEnd?: unknown;
    }) => {
      drag.start = onDragStart;
      drag.over = onDragOver;
      drag.end = onDragEnd;
      return react.createElement(react.Fragment, null, children);
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) =>
      react.createElement(react.Fragment, null, children),
  };
});
vi.mock('../../src/components/home/views/DaySlideContent', () => ({
  DaySlideContent: ({ diaryPlacement, diaryProjectedPlacement, tasksByCategory }: {
    diaryPlacement?: DiaryPlacement;
    diaryProjectedPlacement?: DiaryPlacement | null;
    tasksByCategory?: Map<string, TaskDocument[]>;
  }) => <div data-testid="day-slide">
    <output data-testid="visible-task-order">
      {tasksByCategory?.get('work')?.map(task => task.id).join(',') || ''}
    </output>
    <div data-diary-drag-source="true">
      <div data-diary-drag-visual="true">
        <section data-diary-drag-group="true">
          <button data-diary-drag-heading="true">
            <span data-diary-dnd-source="true" aria-hidden="true"/>7 diary entries
          </button>
        </section>
      </div>
    </div>
    <output data-testid="diary-visible-gap">
      {JSON.stringify(diaryProjectedPlacement)}
    </output>
    <output data-testid="diary-rendered-location">
      {JSON.stringify(diaryPlacement)}
    </output>
  </div>,
}));

import { TaskReorderRuntime } from '../../src/components/home/views/TaskReorderRuntime';

const dateStr = '2026-11-14';
const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
const tasks: TaskDocument[] = ids.map((id, order) => ({
  id, title: id, order, categoryId: 'work', date: dateStr, userId: 'owner',
  createdAt: dateStr + 'T08:00:00Z', updatedAt: dateStr + 'T08:00:00Z',
  completed: false, isDeleted: false, visibility: 'private',
}));
const original: DiaryPlacement = { kind: 'after', categoryId: 'work', taskId: 'a', index: 1 };
const fifth: DiaryPlacement = { kind: 'after', categoryId: 'work', taskId: 'd', index: 4 };

function fire(which: 'start' | 'over' | 'end', event: unknown) {
  (drag[which] as (value: unknown) => void)(event);
}

function fixture(onMoveDiary: (location: DiaryPlacement) => Promise<void>, diaryPlacement = original) {
  return {
    date: new Date(2026, 10, 14), dateStr, tasks, categories: [],
    currentUserId: 'owner', editingTaskId: null, editValue: '',
    onToggleTask: vi.fn(), onAddTask: vi.fn(), onOpenActions: vi.fn(),
    onOpenMemo: vi.fn(), onEditTask: vi.fn(), onViewImage: vi.fn(),
    onEditChange: vi.fn(), onEditSave: vi.fn(), onEditCancel: vi.fn(),
    categoryIds: ['work'], livePlacement: { work: ids },
    diaryEnabled: true, diaryPlacement, onMoveDiary,
  };
}

const rect = { x: 0, y: 0, top: 0, left: 0, width: 600, height: 600,
  right: 600, bottom: 600, toJSON: () => ({}) };

function operation(target: string | null = null, x = 120, y = 150) {
  const source = screen.getByTestId('day-slide')
    .querySelector<HTMLElement>('[data-diary-dnd-source]')!;
  return {
    source: { id: 'diary:' + dateStr, data: {
      entry: { id: 'owned', userId: 'owner', date: dateStr }, expanded: false,
    }, element: source },
    target: target ? { id: target } : null,
    position: { current: { x, y } },
  };
}

const pointer = (x = 120, y = 150) =>
  new MouseEvent('pointerup', { clientX: x, clientY: y });

const taskOperation = (taskId: string, target: string | null = null) => ({
  source: { id: taskId, element: screen.getByTestId('day-slide') },
  target: target ? { id: target } : null,
  position: { current: { x: 120, y: 150 } },
});

describe('Diary group drag release', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let revision = 0;
  const flushFrame = () => act(() => {
    for (const [id, cb] of [...frames]) {
      frames.delete(id);
      cb(performance.now());
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    frames.clear();
    drag.start = drag.over = drag.end = null;
    revision = 0;
  });

  const mount = (onMoveDiary: (location: DiaryPlacement) => Promise<void>) => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      frames.set(++revision, cb);
      return revision;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id);
    });
    const mounted = render(<TaskReorderRuntime {...fixture(onMoveDiary)} />);
    const day = screen.getByTestId('day-slide');
    vi.spyOn(day, 'getBoundingClientRect').mockReturnValue(rect);
    return mounted;
  };

  it('commits the visible fifth-position gap when pointer-up has no target, and holds it until settings reflect the write', async () => {
    let finishWrite: (() => void) | undefined;
    const onMoveDiary = vi.fn(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    const { rerender } = mount(onMoveDiary);
    act(() => fire('start', {
      operation: operation(), nativeEvent: pointer(), canceled: false,
    }));
    act(() => fire('over', {
      operation: operation('task-insert:work:d:after'), nativeEvent: pointer(), canceled: false,
    }));
    flushFrame();
    expect(screen.getByTestId('diary-visible-gap')).toHaveTextContent(JSON.stringify(fifth));

    act(() => fire('end', {
      operation: operation(null), nativeEvent: pointer(), canceled: false,
    }));
    await waitFor(() => expect(onMoveDiary).toHaveBeenCalledWith(fifth));
    expect(screen.getByTestId('diary-rendered-location')).toHaveTextContent(JSON.stringify(fifth));

    await act(async () => { finishWrite?.(); await Promise.resolve(); });
    flushFrame();
    // Even if the asynchronous settings subscription has not rendered yet,
    // successful persistence must not clear the optimistic placement.
    expect(screen.getByTestId('diary-rendered-location')).toHaveTextContent(JSON.stringify(fifth));
    rerender(<TaskReorderRuntime {...fixture(onMoveDiary, fifth)} />);
    expect(screen.getByTestId('diary-rendered-location')).toHaveTextContent(JSON.stringify(fifth));
  });

  it('ignores a stale release collision when the painted insertion gap is already farther down', async () => {
    const onMoveDiary = vi.fn(async () => undefined);
    mount(onMoveDiary);
    act(() => fire('start', {
      operation: operation(), nativeEvent: pointer(), canceled: false,
    }));
    act(() => fire('over', {
      operation: operation('task-insert:work:d:after'), nativeEvent: pointer(), canceled: false,
    }));
    flushFrame();
    act(() => fire('end', {
      operation: operation('task-insert:work:a:after'), nativeEvent: pointer(), canceled: false,
    }));
    await waitFor(() => expect(onMoveDiary).toHaveBeenCalledWith(fifth));
  });

  it('keeps a task moved through a diary note in its destination until live ordering catches up', async () => {
    const onMoveDiary = vi.fn(async () => undefined);
    const onReorderTasks = vi.fn(async () => undefined);
    const note: DiaryDocument = {
      id: 'note', userId: 'owner', date: dateStr, content: 'Diary',
      createdAt: dateStr + 'T08:00:00Z', updatedAt: dateStr + 'T08:00:00Z',
      visibility: 'private', isDeleted: false,
    };
    const category: CategoryDocument = {
      id: 'work', userId: 'owner', name: 'Work', color: '#fff',
      visibility: 'private', order: 0, isDeleted: false, updatedAt: dateStr,
    };
    const position = { categoryId: 'work', anchorTaskId: 'b',
      side: 'before' as const, rank: 1, noteOrder: 0 };
    const getSetting = (key: string) =>
      key === diaryDayLayoutKey(dateStr) ? 'distributed' :
        key === diaryNotePositionKey(note.id) ? position : undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      frames.set(++revision, cb);
      return revision;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id);
    });
    const makeProps = (livePlacement: { work: string[] }) => ({
      ...fixture(onMoveDiary), categories: [category], livePlacement,
      onReorderTasks, diaryReorderEntries: [note],
      diaryReorderGetSetting: getSetting,
      diaryReorderSetSetting: vi.fn(async () => undefined),
    });
    const originalOrder = { work: [...ids] };
    const movedOrder = { work: ['a', 'd', 'b', 'c', 'e', 'f'] };
    const { rerender } = render(<TaskReorderRuntime {...makeProps(originalOrder)} />);
    act(() => fire('start', { operation: taskOperation('d'), nativeEvent: pointer(), canceled: false }));
    act(() => fire('over', { operation: taskOperation('d',
      'task-insert:work:diary_note_note:before'), nativeEvent: pointer(), canceled: false }));
    act(() => fire('end', { operation: taskOperation('d',
      'task-insert:work:diary_note_note:before'), nativeEvent: pointer(), canceled: false }));
    await waitFor(() => expect(onReorderTasks).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    flushFrame(); flushFrame(); flushFrame();
    expect(screen.getByTestId('visible-task-order')).toHaveTextContent(movedOrder.work.join(','));

    // The callback has already resolved; the subscription is still stale.
    // Neither a one-frame clear nor the second settling frame may snap back.
    rerender(<TaskReorderRuntime {...makeProps(originalOrder)} />);
    flushFrame();
    expect(screen.getByTestId('visible-task-order')).toHaveTextContent(movedOrder.work.join(','));

    // Once RxDB reflects the write, normal live data can take ownership.
    rerender(<TaskReorderRuntime {...makeProps(movedOrder)} />);
    flushFrame();
    expect(screen.getByTestId('visible-task-order')).toHaveTextContent(movedOrder.work.join(','));
  });

    it('restores the previous placement on cancel or release outside the day workspace', () => {
    const onMoveDiary = vi.fn(async () => undefined);
    const mounted = mount(onMoveDiary);
    for (const outside of [false, true]) {
      act(() => fire('start', {
        operation: operation(), nativeEvent: pointer(), canceled: false,
      }));
      act(() => fire('over', {
        operation: operation('task-insert:work:d:after'), nativeEvent: pointer(), canceled: false,
      }));
      flushFrame();
      act(() => fire('end', {
        operation: operation('task-insert:work:d:after', outside ? 900 : 120),
        nativeEvent: pointer(outside ? 900 : 120), canceled: !outside,
      }));
      expect(screen.getByTestId('diary-rendered-location')).toHaveTextContent(JSON.stringify(original));
    }
    expect(onMoveDiary).not.toHaveBeenCalled();
    mounted.unmount();
  });
});
