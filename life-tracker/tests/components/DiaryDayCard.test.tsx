import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiaryDayCard } from '../../src/components/home/views/DiaryDayPreview';
import type { DiaryDocument } from '../../src/db/schema';

const entry = {
  id: 'diary_example', userId: 'owner_1', date: '2026-10-12',
  content: 'A diary entry with a long excerpt', emoji: '', photos: '[]',
  visibility: 'private', createdAt: '2026-10-12T12:00:00Z',
  updatedAt: '2026-10-12T12:00:00Z', isDeleted: false,
} as DiaryDocument;

afterEach(() => { vi.useRealTimers(); });

describe('diary taskblock gesture disambiguation', () => {
  it('a single pointer click opens the reader only after the disambiguation window', () => {
    vi.useFakeTimers();
    const open = vi.fn(), edit = vi.fn();
    render(<DiaryDayCard entry={entry} onOpen={open} onEdit={edit} />);
    fireEvent.click(screen.getByRole('button'), { detail: 1 });
    expect(open).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(290); });
    expect(open).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
  });

  it('double tap opens the existing owner editor once, without opening a reader first', () => {
    vi.useFakeTimers();
    const open = vi.fn(), edit = vi.fn();
    render(<DiaryDayCard entry={entry} onOpen={open} onEdit={edit} />);
    const card = screen.getByRole('button');
    fireEvent.click(card, { detail: 1 });
    fireEvent.click(card, { detail: 2 });
    act(() => { vi.advanceTimersByTime(320); });
    expect(edit).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('read-only friend cards never expose edit; keyboard activation opens immediately', () => {
    vi.useFakeTimers();
    const open = vi.fn();
    render(<DiaryDayCard entry={entry} onOpen={open} />);
    fireEvent.click(screen.getByRole('button'), { detail: 2 });
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button'), { detail: 0 });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('a long press canceled by the drag sensor cannot open the diary after release', () => {
    vi.useFakeTimers();
    const open = vi.fn(), edit = vi.fn();
    render(<DiaryDayCard entry={entry} onOpen={open} onEdit={edit} />);
    const card = screen.getByRole('button');
    fireEvent.click(card, { detail: 1 });
    fireEvent.pointerCancel(card);
    act(() => { vi.advanceTimersByTime(320); });
    expect(open).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
  });
});
