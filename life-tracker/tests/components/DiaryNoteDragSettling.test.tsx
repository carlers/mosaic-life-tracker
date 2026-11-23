import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../src/db/schema';
import { diaryDayLayoutKey, diaryNotePositionKey } from '../../src/lib/diaryNotes';
import { useDiaryNoteInteractions } from '../../src/components/home/views/useDiaryNoteInteractions';
import { DiaryNoteDayContext, type DiaryNoteDayInteraction } from '../../src/components/home/views/diaryNoteDayContext';
import { DiaryDayGroup } from '../../src/components/home/views/DiaryDayPreview';

const date = '2026-11-22';
const meta = { userId: 'owner', visibility: 'private' as const, isDeleted: false,
  createdAt: date + 'T00:00:00Z', updatedAt: date + 'T00:00:00Z' };
const category: CategoryDocument = {
  ...meta, id: 'cat', name: 'Category', color: '#fff', order: 0,
};
const task: TaskDocument = {
  ...meta, id: 'task', date, categoryId: 'cat', title: 'Task',
  completed: false, order: 0,
};
const group: DiaryDocument = { ...meta, id: 'group', date, content: 'Grouped Diary entry' };
const inline: DiaryDocument = { ...meta, id: 'inline', date, content: 'Inline Diary entry' };
const settings = {
  [diaryDayLayoutKey(date)]: 'distributed',
  [diaryNotePositionKey('inline')]: {
    categoryId: 'cat', anchorTaskId: 'task', side: 'after', rank: 1,
  },
} as Record<string, unknown>;
const getSetting = (key: string) => settings[key];
const tasks = new Map([['cat', [task]]]);
const onSet = vi.fn(async () => undefined);

const rect = (top: number, bottom: number, left = 0, right = 320) => ({
  top, bottom, left, right, width: right - left, height: bottom - top,
  x: left, y: top, toJSON: () => ({}),
} as DOMRect);

const Fixture = React.forwardRef<DiaryNoteDayInteraction>(function Fixture(_props, ref) {
  const { context, hover, notePlan, overlay } = useDiaryNoteInteractions({
    date, entries: [group, inline], categories: [category],
    tasksByCategory: tasks, getSetting, setSetting: onSet,
  });
  React.useImperativeHandle(ref, () => context!, [context]);
  return <DiaryNoteDayContext.Provider value={context}>
    <div data-testid="day-slide" data-date-str={date}>
      <DiaryDayGroup date={date} entries={notePlan.grouped} onOpen={vi.fn()}
        onReorder={async () => undefined}/>
      <section data-task-category-id="cat">
        <div data-diary-note-task-id="task">Task</div>
        {notePlan.placed.map(note =>
          <div key={note.entry.id} data-diary-note-row={note.entry.id}
            data-visual-note-slot={note.slot}>{note.entry.content}</div>)}
        {hover?.categoryId === 'cat' && <div data-diary-note-gap="true"
          data-testid="held-note-gap" data-gap-index={hover.index}
          data-gap-order={hover.order} />}
      </section>
      <output data-testid="hover">
        {hover ? `${hover.categoryId}:${hover.index}:${hover.order}` : 'none'}
      </output>
      {overlay}
    </div>
  </DiaryNoteDayContext.Provider>;
});

describe('Diary mixed drag settle and bulk boundary', () => {
  beforeEach(() => {
    onSet.mockClear();
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback =>
      window.setTimeout(() => callback(16), 16));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id =>
      window.clearTimeout(id));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const node = this as HTMLElement;
      if (node.dataset.diaryDragGroup !== undefined) return rect(35,
        node.querySelector('[data-diary-reorder-id="group"]')?.getAttribute('style')?.includes('absolute')
          ? 76 : 110);
      if (node.dataset.taskCategoryId === 'cat') return rect(125, 290);
      if (node.dataset.diaryNoteTaskId === 'task') return rect(150, 180);
      if (node.dataset.diaryNoteRow) return rect(196, 238);
      if (node.dataset.diaryNoteGap !== undefined) return rect(196, 238);
      if (node.dataset.diaryReorderId === 'group') return rect(65, 105);
      return rect(10, 30);
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('holds the destination gap through release and the full settle, including under a category pill', () => {
    const actions = React.createRef<DiaryNoteDayInteraction>();
    render(<Fixture ref={actions} />);
    act(() => actions.current!.onDragStart('group', rect(65, 105), 120, 82, 'group'));
    expect(screen.getByTestId('hover')).toHaveTextContent('none');
    act(() => actions.current!.onDragMove('group', 120, 137, 40));
    expect(screen.getByTestId('hover')).toHaveTextContent('cat:0:0');
    expect(screen.getByTestId('held-note-gap')).toBeInTheDocument();

    let accepted = false;
    act(() => { accepted = actions.current!.onDragRelease('group', 120, 137); });
    expect(accepted).toBe(true);
    act(() => actions.current!.onDragEnd());
    expect(screen.getByTestId('held-note-gap')).toBeInTheDocument();
    expect(document.querySelector('[data-diary-note-floating]')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(196));
    expect(screen.getByTestId('held-note-gap')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30));
    expect(screen.queryByTestId('held-note-gap')).not.toBeInTheDocument();
    expect(document.querySelector('[data-diary-note-floating]')).toBeNull();
    expect(screen.getByText('Grouped Diary entry')).toBeInTheDocument();
  });

  it('removes the grouped source from flow as it crosses into a category and restores it on return', () => {
    const actions = React.createRef<DiaryNoteDayInteraction>();
    render(<Fixture ref={actions} />);
    act(() => actions.current!.onDragStart('group', rect(65, 105), 120, 82, 'group'));
    const row = document.querySelector<HTMLElement>('[data-diary-reorder-id="group"]')!;
    expect(row.style.position).toBe('relative');
    act(() => actions.current!.onDragMove('group', 120, 201, 40));
    expect(row.style.position).toBe('absolute');
    expect(screen.getByTestId('held-note-gap')).toBeInTheDocument();

    // Recaptured bulk rect ends above 80px. The pointer can return without
    // sticking to the original (now-collapsed) 110px group boundary.
    act(() => actions.current!.onDragMove('group', 120, 55, 40));
    expect(row.style.position).toBe('relative');
    expect(screen.queryByTestId('held-note-gap')).not.toBeInTheDocument();
    expect(document.querySelector('[data-diary-note-floating]')).toBeInTheDocument();
    act(() => actions.current!.onDragEnd());
    expect(document.querySelector('[data-diary-note-floating]')).toBeNull();
  });

  it('retains the exact last-note destination during release, not just a task index', () => {
    const actions = React.createRef<DiaryNoteDayInteraction>();
    render(<Fixture ref={actions} />);
    act(() => actions.current!.onDragStart('group', rect(65, 105), 120, 82, 'group'));
    act(() => actions.current!.onDragMove('group', 120, 267, 40));
    expect(screen.getByTestId('hover')).toHaveTextContent('cat:1:1');
    act(() => { expect(actions.current!.onDragRelease('group', 120, 267)).toBe(true); });
    act(() => actions.current!.onDragEnd());
    expect(screen.getByTestId('hover')).toHaveTextContent('cat:1:1');
    act(() => vi.advanceTimersByTime(240));
    expect(screen.getByTestId('hover')).toHaveTextContent('none');
  });

  it('does not reserve a category gap when an inline note returns to the bulk group', () => {
    const actions = React.createRef<DiaryNoteDayInteraction>();
    render(<Fixture ref={actions} />);
    act(() => actions.current!.onDragStart('inline', rect(196, 238), 120, 212, 'inline'));
    act(() => actions.current!.onDragMove('inline', 120, 50, 42));
    expect(screen.queryByTestId('held-note-gap')).not.toBeInTheDocument();
    act(() => { expect(actions.current!.onDragRelease('inline', 120, 50)).toBe(true); });
    act(() => actions.current!.onDragEnd());
    expect(document.querySelector('[data-diary-note-floating]')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(250));
    expect(document.querySelector('[data-diary-note-floating]')).toBeNull();
    expect(screen.getByText('Inline Diary entry')).toBeInTheDocument();
  });
});
