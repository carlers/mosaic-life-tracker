import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryDocument } from '../../src/db/schema';
import { DiaryNoteInline } from '../../src/components/home/views/DiaryNoteInline';
import { DiaryNoteDayContext, type DiaryNoteDayInteraction } from '../../src/components/home/views/diaryNoteDayContext';

const date = '2026-11-23';
const entry: DiaryDocument = {
  id: 'note-first', date, content: 'Move above the first task',
  userId: 'owner', visibility: 'private', isDeleted: false,
  createdAt: date + 'T00:00:00Z', updatedAt: date + 'T00:00:00Z',
};

describe('Diary inline long-press pointer ownership', () => {
  const originalCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'setPointerCapture');
  const originalHasCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hasPointerCapture');
  const originalRelease = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'releasePointerCapture');
  const owners: HTMLElement[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    owners.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback =>
      window.setTimeout(() => callback(16), 16));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id =>
      window.clearTimeout(id));
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true, value: function () { owners.push(this); },
    });
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true, value: function () { return owners.includes(this); },
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true, value: function () {
        owners.splice(owners.indexOf(this), 1);
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const [name, descriptor] of [
      ['setPointerCapture', originalCapture],
      ['hasPointerCapture', originalHasCapture],
      ['releasePointerCapture', originalRelease],
    ] as const) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, name);
    }
  });

  function mount() {
    const actions: DiaryNoteDayInteraction = {
      layout: 'distributed', groupedEntryIds: new Set(), savedCount: 1, totalEntries: 1,
      floatingEntryId: null, floatingExternal: false, toggleLayout: vi.fn(),
      onDragStart: vi.fn(), onDragMove: vi.fn(() => true),
      onDragRelease: vi.fn(() => true), onDragEnd: vi.fn(),
    };
    const view = render(<DiaryNoteDayContext.Provider value={actions}>
      <div data-testid="task-above">Task above the note</div>
      <DiaryNoteInline entry={entry} title="First note" onOpen={vi.fn()} onEdit={vi.fn()} />
    </DiaryNoteDayContext.Provider>);
    const note = screen.getByText('First note').closest('[data-diary-note-row]')!;
    return { actions, view, note };
  }

  it('keeps dragging when the row loses capture during a task-boundary reflow', () => {
    const { actions, note } = mount();
    fireEvent.pointerDown(note, { pointerId: 17, pointerType: 'mouse', button: 0,
      isPrimary: true, clientX: 120, clientY: 210 });
    act(() => vi.advanceTimersByTime(450));
    expect(actions.onDragStart).toHaveBeenCalledTimes(1);
    expect(owners).toContain(document.body);
    expect(owners).not.toContain(note);

    // Moving the original note in the DOM can invalidate capture on the row.
    // Only the stable body owns capture now, so source capture loss is inert.
    fireEvent.lostPointerCapture(note, { pointerId: 17 });
    expect(actions.onDragEnd).not.toHaveBeenCalled();
    act(() => {
      for (let i = 0; i < 35; i++) {
        fireEvent.pointerMove(window, { pointerId: 17, clientX: 120,
          clientY: 208 - i * 2 });
      }
    });
    expect(actions.onDragMove).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16));
    expect(actions.onDragMove).toHaveBeenCalledTimes(1);
    expect(actions.onDragMove).toHaveBeenLastCalledWith('note-first', 120, 140, expect.any(Number));

    act(() => {
      fireEvent.pointerMove(window, { pointerId: 17, clientX: 120, clientY: 112 });
      // Pointer-up before the next animation frame must flush the final position.
      fireEvent.pointerUp(window, { pointerId: 17, clientX: 120, clientY: 112 });
    });
    expect(actions.onDragMove).toHaveBeenCalledTimes(2);
    expect(actions.onDragRelease).toHaveBeenCalledWith('note-first', 120, 112);
    expect(actions.onDragEnd).toHaveBeenCalledTimes(1);
    expect(owners).not.toContain(document.body);
  });

  it('does not capture a normal vertical swipe before long-press activation', () => {
    const { actions, note } = mount();
    fireEvent.pointerDown(note, { pointerId: 18, pointerType: 'touch', button: 0,
      isPrimary: true, clientX: 120, clientY: 200 });
    fireEvent.pointerMove(note, { pointerId: 18, clientX: 120, clientY: 240 });
    act(() => vi.advanceTimersByTime(500));
    expect(actions.onDragStart).not.toHaveBeenCalled();
    expect(owners).not.toContain(document.body);
  });
});
