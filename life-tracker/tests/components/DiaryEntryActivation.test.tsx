import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiaryEntryActivation } from '../../src/components/home/views/useDiaryEntryActivation';
import React from 'react';

const read = vi.fn();
const edit = vi.fn();
const Action = () => {
  const activation = useDiaryEntryActivation(read, edit);
  return <button type="button"
    onPointerDown={event => activation.rememberPointer(event.pointerType)}
    onClick={event => activation.activate('entry-1', event.detail)}
    onDoubleClick={() => activation.doubleClick('entry-1')}>Entry</button>;
};
beforeEach(() => { vi.useFakeTimers(); read.mockClear(); edit.mockClear(); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

describe('Diary entry activation', () => {
  it('a mouse double-click edits without first opening a read sheet', () => {
    render(<Action />);
    const entry = screen.getByRole('button', { name: 'Entry' });
    fireEvent.pointerDown(entry, { pointerType: 'mouse' });
    fireEvent.click(entry, { detail: 1 });
    fireEvent.click(entry, { detail: 2 });
    fireEvent.doubleClick(entry);
    act(() => vi.advanceTimersByTime(300));
    expect(read).not.toHaveBeenCalled();
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledWith('entry-1');
  });
  it('still opens on a single mouse click and immediately for touch or keyboard', () => {
    render(<Action />);
    const entry = screen.getByRole('button', { name: 'Entry' });
    fireEvent.pointerDown(entry, { pointerType: 'mouse' });
    fireEvent.click(entry, { detail: 1 });
    expect(read).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(240));
    expect(read).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(entry, { pointerType: 'touch' });
    fireEvent.click(entry, { detail: 1 });
    fireEvent.click(entry, { detail: 0 });
    expect(read).toHaveBeenCalledTimes(3);
    expect(edit).not.toHaveBeenCalled();
  });
});
