import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiaryDayGroup } from '../../src/components/home/views/DiaryDayPreview';
import type { DiaryDocument } from '../../src/db/schema';

const makeEntry = (id: string, content: string, createdAt: string): DiaryDocument => ({
  id, userId: 'owner_A', date: '2026-11-14', content, createdAt,
  updatedAt: createdAt, emoji: '', photos: '[]', visibility: 'private', isDeleted: false,
});

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

  it('automatically selects Manual on keyboard reorder while retaining it across sort changes', async () => {
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = makeEntry('second', 'Second entry', '2026-11-14T10:00:00Z');
    const third = makeEntry('third', 'Third entry', '2026-11-14T12:00:00Z');
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const onSortChange = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<DiaryDayGroup date="2026-11-14" entries={[first, second, third]}
      onOpen={vi.fn()} orderMode="oldest" onOrderModeChange={onSortChange}
      onReorder={onReorder} />);
    const firstHandle = screen.getByRole('button', { name: 'Reorder diary entry 1 of 3' });
    fireEvent.keyDown(firstHandle, { key: ' ' });
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown' });
    fireEvent.keyDown(firstHandle, { key: ' ' });
    expect(onReorder).toHaveBeenCalledWith(['second', 'first', 'third']);
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

  it('offers explicit marker selection from any same-day entry with an emoji', () => {
    const first = makeEntry('first', 'First entry', '2026-11-14T08:00:00Z');
    const second = { ...makeEntry('second', 'Second entry', '2026-11-14T10:00:00Z'), emoji: '🌸' };
    const third = { ...makeEntry('third', 'Third entry', '2026-11-14T12:00:00Z'), emoji: '🌙' };
    const onMonthEmojiChange = vi.fn().mockResolvedValue(undefined);
    render(<DiaryDayGroup date="2026-11-14" entries={[first, second, third]} onOpen={vi.fn()}
      onMonthEmojiChange={onMonthEmojiChange} />);
    fireEvent.click(screen.getByRole('combobox', { name: /Month grid emoji/ }));
    fireEvent.click(screen.getByRole('option', { name: '🌙 · Entry 3' }));
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
