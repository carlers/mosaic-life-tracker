import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiaryDayGroup } from '../../src/components/home/views/DiaryDayPreview';
import type { DiaryDocument } from '../../src/db/schema';

const makeEntry = (id: string, content: string, createdAt: string): DiaryDocument => ({
  id, userId: 'owner_A', date: '2026-11-14', content, createdAt,
  updatedAt: createdAt, emoji: '', photos: '[]', visibility: 'private', isDeleted: false,
});

afterEach(() => vi.useRealTimers());

describe('DiaryDayGroup', () => {
  it('shows independent cards, one group count, and working expand/new controls', () => {
    const first = makeEntry('morning', 'Morning thoughts\nLonger text', '2026-11-14T08:00:00.000Z');
    const second = makeEntry('evening', 'Evening recap', '2026-11-14T21:00:00.000Z');
    const onOpen = vi.fn();
    const onNew = vi.fn();
    render(<DiaryDayGroup date="2026-11-14" entries={[second, first]} onOpen={onOpen} onNew={onNew} />);
    expect(screen.getByRole('button', { name: 'Diary group, 2 entries' })).toBeInTheDocument();
    expect(screen.getByText('Morning thoughts')).toBeInTheDocument();
    expect(screen.getByText('Evening recap')).toBeInTheDocument();
    expect(screen.getAllByText(/Private/)).toHaveLength(2);
    expect(screen.queryByText(/Longer text/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText(/Longer text/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New entry' }));
    expect(onNew).toHaveBeenCalledTimes(1);
    const read = screen.getAllByRole('button', { name: /Read diary entry from/ });
    fireEvent.click(read[0]);
    expect(onOpen).toHaveBeenCalledWith(first);
    expect(onOpen).not.toHaveBeenCalledWith(second);
    fireEvent.click(screen.getByRole('combobox', { name: /Diary entry order/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Newest first' }));
    const afterToggle = screen.getAllByRole('button', { name: /Read diary entry from/ });
    fireEvent.click(afterToggle[0]);
    expect(onOpen).toHaveBeenLastCalledWith(second);
  });

  it('registers the bulk drag source inside the header, while keeping single-entry drag on its card', () => {
    const first = makeEntry('first', 'Morning thoughts', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Evening thoughts', '2026-11-14T19:00:00Z');
    let source: HTMLSpanElement | null = null;
    const { rerender, container } = render(<DiaryDayGroup date="2026-11-14"
      entries={[first, second]} onOpen={vi.fn()} dragSourceRef={node => { source = node; }} />);
    expect(source).toBe(container.querySelector('[data-diary-dnd-source]'));
    expect(source?.closest('button')).toHaveAccessibleName('Diary group, 2 entries');
    expect(source?.closest('[data-diary-drag-group]')).toBeInTheDocument();
    expect(source?.closest('[data-diary-reorder-id]')).toBeNull();
    rerender(<DiaryDayGroup date="2026-11-14"
      entries={[first]} onOpen={vi.fn()} dragSourceRef={node => { source = node; }} />);
    expect(source).toBe(container.querySelector('[data-diary-dnd-source]'));
    expect(source?.closest('button')).toHaveAccessibleName('Read diary entry');
    expect(container.querySelector('[data-diary-drag-group]')).toBeNull();
  });

  it('restores entry expansion and loaded count after the drag settling wrapper remounts', () => {
    const entries = Array.from({ length: 35 }, (_, i) => makeEntry(
      'entry_' + i, i === 0 ? 'Morning note\nPrivate second line' : 'Other diary ' + i,
      '2026-11-14T08:00:00Z'));
    const sessionStateRef: React.MutableRefObject<import('../../src/components/home/views/DiaryDayPreview').DiaryDayUiSession | null> = {
      current: null,
    };
    const view = (revision: number, date = '2026-11-14', expanded = false) =>
      <DiaryDayGroup key={revision} date={date} entries={entries}
        onOpen={vi.fn()} expanded={expanded} sessionStateRef={sessionStateRef}/>;
    const { rerender } = render(view(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand entry' })[0]);
    expect(screen.getByText('Private second line')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show more diary entries' }));
    expect(screen.getAllByRole('button', { name: /Read diary entry from/ })).toHaveLength(35);

    // Releasing a bulk drag keys the settling frame; this must not reset the
    // expanded entry or collapse pagination back to the first thirty records.
    rerender(view(1));
    expect(screen.getByText('Private second line')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Read diary entry from/ })).toHaveLength(35);
    // Date changes and an explicit Compact/Expanded preference change are
    // separate UI sessions and must not reuse the stale temporary state.
    rerender(view(2, '2026-11-15'));
    expect(screen.queryByText('Private second line')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Read diary entry from/ })).toHaveLength(30);
    rerender(view(3, '2026-11-14', true));
    expect(screen.getByText('Private second line')).toBeInTheDocument();
  });

  it('automatically selects Manual on keyboard reorder while retaining it across sort changes', async () => {
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T10:00:00Z');
    const third = makeEntry('third', 'Third entry', '2026-11-14T12:00:00Z');
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const onSortChange = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<DiaryDayGroup date="2026-11-14" entries={[first, second, third]}
      onOpen={vi.fn()} orderMode="oldest" onOrderModeChange={onSortChange}
      onReorder={onReorder} />);
    const firstHandle = screen.getAllByRole('button', { name: /Read diary entry from/ })[0];
    fireEvent.keyDown(firstHandle, { key: ' ' });
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown' });
    fireEvent.keyDown(firstHandle, { key: ' ' });
    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(['second', 'first', 'third']));
    await waitFor(() => expect(screen.getByRole('combobox', {name: /Diary entry order/})).not.toBeDisabled());
    rerender(<DiaryDayGroup date="2026-11-14" entries={[first, second, third]}
      onOpen={vi.fn()} orderMode="manual" manualOrder={['second', 'first', 'third']}
      onOrderModeChange={onSortChange} onReorder={onReorder} />);
    fireEvent.click(screen.getByRole('combobox', { name: /Diary entry order/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Newest first' }));
    expect(onSortChange).toHaveBeenCalledWith('newest');
    rerender(<DiaryDayGroup date="2026-11-14" entries={[first, second, third]}
      onOpen={vi.fn()} orderMode="newest" manualOrder={['second', 'first', 'third']}
      onOrderModeChange={onSortChange} onReorder={onReorder} />);
    fireEvent.click(screen.getByRole('combobox', { name: /Diary entry order/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Manual' }));
    expect(onSortChange).toHaveBeenLastCalledWith('manual');
  });

  it('long-press pointer drag crosses the target row and enables Manual automatically', () => {
    vi.useFakeTimers();
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T10:00:00Z');
    const third = makeEntry('third', 'Third entry', '2026-11-14T12:00:00Z');
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<DiaryDayGroup date="2026-11-14"
      entries={[first, second, third]} onOpen={vi.fn()}
      orderMode="oldest" onReorder={onReorder}
      onOrderModeChange={vi.fn().mockResolvedValue(undefined)} />);
    const rows = container.querySelectorAll<HTMLElement>('[data-diary-reorder-id]');
    rows.forEach((row, index) => {
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
        top: index * 70, height: 70, bottom: (index + 1) * 70,
        left: 0, width: 400, right: 400, x: 0, y: index * 70,
        toJSON: () => ({}),
      });
    });
    const row = rows[0];
    fireEvent.pointerDown(row, { isPrimary: true, button: 0, pointerId: 3, clientY: 35 });
    act(() => vi.advanceTimersByTime(470));
    // Dragging translates the source row under the pointer. It cannot
    // select itself as a candidate instead of the next insertion midpoint.
    fireEvent.pointerMove(row, { pointerId: 3, clientY: 155 });
    expect(rows[0].style.transform).toBe('translate3d(0, 120px, 0)');
    expect(rows[1].style.transform).toBe('translate3d(0, -70px, 0)');
    expect(rows[2].style.transform).toBe('');
    // Cross the third row, then reverse to the second; siblings reflow live,
    // rather than waiting until pointer release to move into place.
    fireEvent.pointerMove(row, { pointerId: 3, clientY: 195 });
    expect(rows[1].style.transform).toBe('translate3d(0, -70px, 0)');
    expect(rows[2].style.transform).toBe('translate3d(0, -70px, 0)');
    fireEvent.pointerMove(row, { pointerId: 3, clientY: 155 });
    expect(rows[2].style.transform).toBe('');
    fireEvent.pointerUp(row, { pointerId: 3, clientY: 155 });
    expect(onReorder).toHaveBeenCalledWith(['second', 'first', 'third']);
    expect(screen.getByRole('combobox', { name: /Diary entry order: Manual/ })).toBeInTheDocument();
  });

  it('reflows upward with mixed row heights and never reuses shifted hitboxes', () => {
    vi.useFakeTimers();
    const entries = [
      makeEntry('short', 'Short entry', '2026-11-14T08:00:00Z'),
      makeEntry('tall', 'Tall entry', '2026-11-14T09:00:00Z'),
      makeEntry('bottom', 'Bottom entry', '2026-11-14T10:00:00Z'),
    ];
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<DiaryDayGroup date="2026-11-14"
      entries={entries} onOpen={vi.fn()} onReorder={onReorder} />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-diary-reorder-id]'));
    const heights = [56, 116, 90], tops = [0, 60, 180];
    rows.forEach((row, i) => {
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
        top: tops[i], height: heights[i], bottom: tops[i] + heights[i],
        left: 0, width: 400, right: 400, x: 0, y: tops[i], toJSON: () => ({}),
      });
    });
    const row = rows[2];
    fireEvent.pointerDown(row, { isPrimary: true, button: 0, pointerId: 11, clientY: 225 });
    act(() => vi.advanceTimersByTime(470));
    fireEvent.pointerMove(row, { pointerId: 11, clientY: 105 });
    expect(rows[0].style.transform).toBe('');
    expect(rows[1].style.transform).toBe('translate3d(0, 94px, 0)');
    expect(rows[2].style.transform).toBe('translate3d(0, -120px, 0)');
    // Hover does not read transformed positions: moving farther still
    // crosses the *original* first row even while the second has shifted.
    fireEvent.pointerMove(row, { pointerId: 11, clientY: 20 });
    expect(rows[0].style.transform).toBe('translate3d(0, 94px, 0)');
    expect(rows[1].style.transform).toBe('translate3d(0, 94px, 0)');
    fireEvent.pointerUp(row, { pointerId: 11, clientY: 20 });
    expect(onReorder).toHaveBeenCalledWith(['bottom', 'short', 'tall']);
  });

  it('cancels reflow without saving and skips easing in reduced-motion mode', () => {
    vi.useFakeTimers();
    document.documentElement.dataset.reduceMotion = 'true';
    try {
      const entries = [
        makeEntry('a', 'A', '2026-11-14T08:00:00Z'),
        makeEntry('b', 'B', '2026-11-14T09:00:00Z'),
      ];
      const onReorder = vi.fn();
      const { container } = render(<DiaryDayGroup date="2026-11-14"
        entries={entries} onOpen={vi.fn()} onReorder={onReorder} />);
      const rows = container.querySelectorAll<HTMLElement>('[data-diary-reorder-id]');
      rows.forEach((row, i) => {
        vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
          top: i * 64, height: 60, bottom: i * 64 + 60,
          left: 0, width: 400, right: 400, x: 0, y: i * 64, toJSON: () => ({}),
        });
      });
      const row = rows[0];
      fireEvent.pointerDown(row, { isPrimary: true, button: 0, pointerId: 9, clientY: 30 });
      act(() => vi.advanceTimersByTime(470));
      fireEvent.pointerMove(row, { pointerId: 9, clientY: 95 });
      expect(rows[1].style.transform).toBe('translate3d(0, -64px, 0)');
      expect(rows[1].style.transition).toBe('none');
      fireEvent.pointerCancel(row, { pointerId: 9 });
      expect(rows[0].style.transform).toBe('');
      expect(rows[1].style.transform).toBe('');
      expect(onReorder).not.toHaveBeenCalled();
    } finally {
      delete document.documentElement.dataset.reduceMotion;
    }
  });

  it('a short press or canceled pointer gesture cannot mutate manual order', () => {
    vi.useFakeTimers();
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T10:00:00Z');
    const onReorder = vi.fn();
    render(<DiaryDayGroup date="2026-11-14" entries={[first, second]}
      onOpen={vi.fn()} onReorder={onReorder} />);
    const row = screen.getAllByRole('listitem')[0];
    fireEvent.pointerDown(row, { isPrimary: true, button: 0, pointerId: 7, clientY: 35 });
    act(() => vi.advanceTimersByTime(140));
    fireEvent.pointerUp(row, { pointerId: 7, clientY: 35 });
    act(() => vi.advanceTimersByTime(300));
    expect(onReorder).not.toHaveBeenCalled();
    fireEvent.pointerDown(row, { isPrimary: true, button: 0, pointerId: 8, clientY: 35 });
    fireEvent.pointerCancel(row, { pointerId: 8 });
    act(() => vi.advanceTimersByTime(300));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('uses the whole card: short taps still read, edit and expand without reordering', () => {
    vi.useFakeTimers();
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T09:00:00Z');
    const onOpen = vi.fn(), onEdit = vi.fn(), onReorder = vi.fn();
    const { container } = render(<DiaryDayGroup date="2026-11-14" entries={[first, second]}
      onOpen={onOpen} onEdit={onEdit} onReorder={onReorder} />);
    const rows = container.querySelectorAll<HTMLElement>('[data-diary-reorder-id]');
    expect(screen.queryByRole('button', { name: /Reorder diary entry/ })).not.toBeInTheDocument();
    const read = screen.getAllByRole('button', { name: /Read diary entry from/ })[0];
    fireEvent.pointerDown(read, { isPrimary: true, pointerId: 17, button: 0, clientX: 14, clientY: 30 });
    act(() => vi.advanceTimersByTime(130));
    fireEvent.pointerUp(read, { pointerId: 17, button: 0, clientX: 14, clientY: 30 });
    fireEvent.click(read, { detail: 1 });
    expect(onOpen).toHaveBeenCalledWith(first);
    const expand = screen.getAllByRole('button', { name: 'Expand entry' })[0];
    fireEvent.click(expand);
    expect(screen.getAllByRole('button', { name: 'Collapse entry' })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit selected diary entry' })[0]);
    expect(onEdit).toHaveBeenCalledWith(first);
    expect(onReorder).not.toHaveBeenCalled();
    expect(rows).toHaveLength(2);
  });

  it('long-pressing the card text lifts it and suppresses the resulting synthetic click', () => {
    vi.useFakeTimers();
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T09:00:00Z');
    const onOpen = vi.fn();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<DiaryDayGroup date="2026-11-14" entries={[first, second]}
      onOpen={onOpen} onReorder={onReorder} />);
    const rows = container.querySelectorAll<HTMLElement>('[data-diary-reorder-id]');
    rows.forEach((row, i) => vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
      top: i * 70, height: 70, bottom: (i + 1) * 70, left: 0, width: 300,
      right: 300, x: 0, y: i * 70, toJSON: () => ({}),
    }));
    const read = screen.getAllByRole('button', { name: /Read diary entry from/ })[0];
    fireEvent.pointerDown(read, { isPrimary: true, pointerId: 19, pointerType: 'mouse', button: 0,
      buttons: 1, clientX: 15, clientY: 35 });
    act(() => vi.advanceTimersByTime(470));
    fireEvent.pointerMove(rows[0], { pointerId: 19, pointerType: 'mouse', buttons: 1,
      clientX: 15, clientY: 109 });
    expect(rows[1].style.transform).toBe('translate3d(0, -70px, 0)');
    // The click guard must survive a long held drag, not expire while held.
    act(() => vi.advanceTimersByTime(1200));
    fireEvent.pointerUp(rows[0], { pointerId: 19, pointerType: 'mouse', button: 0,
      clientX: 15, clientY: 109 });
    fireEvent.click(read, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    expect(onReorder).toHaveBeenCalledWith(['second', 'first']);
    // A subsequent independent tap is never blocked by the prior drag.
    fireEvent.pointerDown(read, { isPrimary: true, pointerId: 20, button: 0, clientX: 15, clientY: 35 });
    fireEvent.pointerUp(read, { pointerId: 20, button: 0, clientX: 15, clientY: 35 });
    fireEvent.click(read, { detail: 1 });
    expect(onOpen).toHaveBeenCalledWith(first);
  });

  it('keeps native vertical swipe before the hold, but prevents touch scrolling after pickup', () => {
    vi.useFakeTimers();
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T09:00:00Z');
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<DiaryDayGroup date="2026-11-14" entries={[first, second]}
      onOpen={vi.fn()} onReorder={onReorder} />);
    const rows = container.querySelectorAll<HTMLElement>('[data-diary-reorder-id]');
    const row = rows[0];
    fireEvent.pointerDown(row, { isPrimary: true, pointerId: 25, pointerType: 'touch', button: 0,
      clientX: 10, clientY: 35 });
    const swipeBeforeHold = new Event('touchmove', { cancelable: true, bubbles: true });
    Object.defineProperty(swipeBeforeHold, 'touches', { value: [{ identifier: 1 }] });
    row.dispatchEvent(swipeBeforeHold);
    expect(swipeBeforeHold.defaultPrevented).toBe(false);
    fireEvent.pointerMove(row, { pointerId: 25, pointerType: 'touch', clientX: 10, clientY: 65 });
    act(() => vi.advanceTimersByTime(470));
    expect(rows[0].style.transform).toBe('');
    expect(onReorder).not.toHaveBeenCalled();
    fireEvent.pointerDown(row, { isPrimary: true, pointerId: 26, pointerType: 'touch', button: 0,
      clientX: 10, clientY: 35 });
    act(() => vi.advanceTimersByTime(470));
    const scrollDuringDrag = new Event('touchmove', { cancelable: true, bubbles: true });
    Object.defineProperty(scrollDuringDrag, 'touches', { value: [{ identifier: 2 }] });
    row.dispatchEvent(scrollDuringDrag);
    expect(scrollDuringDrag.defaultPrevented).toBe(true);
    fireEvent.pointerCancel(row, { pointerId: 26, pointerType: 'touch' });
    const afterCancel = new Event('touchmove', { cancelable: true, bubbles: true });
    Object.defineProperty(afterCancel, 'touches', { value: [{ identifier: 2 }] });
    row.dispatchEvent(afterCancel);
    expect(afterCancel.defaultPrevented).toBe(false);
  });

  it('only arms one primary pointer and cancels on horizontal day swipe before long press', () => {
    vi.useFakeTimers();
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T09:00:00Z');
    const onReorder = vi.fn();
    const { container } = render(<DiaryDayGroup date="2026-11-14" entries={[first, second]}
      onOpen={vi.fn()} onReorder={onReorder} />);
    const row = container.querySelectorAll<HTMLElement>('[data-diary-reorder-id]')[0];
    fireEvent.pointerDown(row, { pointerId: 2, button: 0, isPrimary: false, clientX: 10, clientY: 30 });
    act(() => vi.advanceTimersByTime(470));
    expect(row.style.transform).toBe('');
    fireEvent.pointerDown(row, { isPrimary: true, pointerId: 3, button: 0, clientX: 10, clientY: 30 });
    fireEvent.pointerMove(row, { pointerId: 3, clientX: 60, clientY: 30 });
    act(() => vi.advanceTimersByTime(470));
    expect(row.style.transform).toBe('');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('offers explicit marker selection from any same-day entry with an emoji', () => {
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = { ...makeEntry('second', 'Second entry', '2026-11-14T10:00:00Z'), emoji: '🌸' };
    const third = { ...makeEntry('third', 'Third entry', '2026-11-14T12:00:00Z'), emoji: '🌙' };
    const onMonthEmojiChange = vi.fn().mockResolvedValue(undefined);
    render(<DiaryDayGroup date="2026-11-14" entries={[first, second, third]} onOpen={vi.fn()}
      onMonthEmojiChange={onMonthEmojiChange} />);
    fireEvent.click(screen.getByRole('combobox', { name: /Month grid emoji/ }));
    fireEvent.click(screen.getByRole('option', { name: /🌙 · Entry 3/ }));
    expect(onMonthEmojiChange).toHaveBeenCalledWith('third');
  });

  it('retains a familiar single card plus an explicit New entry action', () => {
    const only = makeEntry('existing', 'Only entry', '2026-11-14T08:00:00.000Z');
    const onOpen = vi.fn();
    const onNew = vi.fn();
    render(<DiaryDayGroup date="2026-11-14" entries={[only]} onOpen={onOpen} onNew={onNew}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Read diary entry' }));
    expect(onOpen).toHaveBeenCalledWith(only);
    fireEvent.click(screen.getByRole('button', { name: 'New diary entry on this day' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('renders large diary days incrementally rather than mounting every card', () => {
    const entries = Array.from({ length: 65 }, (_, i) =>
      makeEntry('entry_' + String(i).padStart(3, '0'),
        'Diary record ' + i, '2026-11-14T08:00:00.000Z'));
    render(<DiaryDayGroup date="2026-11-14" entries={entries} onOpen={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /Read diary entry from/ })).toHaveLength(30);
    fireEvent.click(screen.getByRole('button', { name: 'Show more diary entries' }));
    expect(screen.getAllByRole('button', { name: /Read diary entry from/ })).toHaveLength(60);
    fireEvent.click(screen.getByRole('button', { name: 'Show more diary entries' }));
    expect(screen.getAllByRole('button', { name: /Read diary entry from/ })).toHaveLength(65);
    expect(screen.queryByRole('button', { name: 'Show more diary entries' })).not.toBeInTheDocument();
  });

  it('expands one diary entry without opening its same-day sibling', () => {
    const first = makeEntry('first', 'First heading\nFirst unique detail', '2026-11-14T08:00:00.000Z');
    const second = makeEntry('second', 'Second heading\nSecond unique detail', '2026-11-14T10:00:00.000Z');
    render(<DiaryDayGroup date="2026-11-14" entries={[first, second]} onOpen={vi.fn()} />);
    expect(screen.queryByText(/First unique detail/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Second unique detail/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand entry' })[0]);
    expect(screen.getByText(/First unique detail/)).toBeInTheDocument();
    expect(screen.queryByText(/Second unique detail/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse entry' }));
    expect(screen.queryByText(/First unique detail/)).not.toBeInTheDocument();
  });

  it('only renders entries supplied by the authorization boundary', () => {
    const visible = makeEntry('visible', 'Visible diary', '2026-11-14T08:00:00.000Z');
    render(<DiaryDayGroup date="2026-11-14" entries={[visible]} onOpen={vi.fn()}/>);
    expect(screen.getByText('Visible diary')).toBeInTheDocument();
    expect(screen.queryByText('2 diary entries')).not.toBeInTheDocument();
  });
});
