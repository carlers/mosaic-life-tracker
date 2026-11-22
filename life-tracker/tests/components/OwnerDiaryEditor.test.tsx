import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { DiaryDocument } from '../../src/db/schema';
import { OwnerDiaryEditor } from '../../src/components/home/OwnerDiaryEditor';

const spies = vi.hoisted(() => ({
  create: vi.fn(async () => 'd_new'),
  update: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
}));

vi.mock('../../src/hooks/useDiary', () => ({
  useDiary: () => ({
    createEntry: spies.create,
    updateEntry: spies.update,
    deleteEntryById: spies.remove,
  }),
}));

vi.mock('../../src/components/home/views/DiaryEntrySheet', () => ({
  DiaryEntrySheet: ({ onSave, onDelete }: {
    onSave: (date: string, content: string, visibility: 'private',
      emoji: string, photos: string, retryId?: string, titleOnly?: boolean) => Promise<void | string>;
    onDelete?: () => Promise<void>;
  }) => <div>
    <button onClick={() => { void onSave('2026-11-22', '', 'private', '', '', undefined, true); }}>
      Save title-only
    </button>
    {onDelete && <button onClick={() => { void onDelete(); }}>Delete note</button>}
  </div>,
}));

const entry: DiaryDocument = {
  id: 'd_1', userId: 'owner', date: '2026-11-22', content: '', emoji: '',
  photos: '', visibility: 'private', isDeleted: false,
  createdAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z',
};
const shared = { isOpen: true, author: 'Me', onExitComplete: vi.fn(), onClose: vi.fn() };

describe('lazy owner Diary editor (#2298)', () => {
  beforeEach(() => {
    spies.create.mockClear();
    spies.update.mockClear();
    spies.remove.mockClear();
  });
  it('saves a title-only existing note by exact entry id', () => {
    render(<OwnerDiaryEditor {...shared}
      session={{ id: 'owner:2026-11-22:d_1', date: entry.date, entryId: entry.id, entry }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save title-only' }));
    expect(spies.update).toHaveBeenCalledWith(entry.id, entry.date, '', 'private', '', '', true);
    expect(spies.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(spies.remove).toHaveBeenCalledWith(entry.id);
  });
  it('creates a title-only note without confusing it with the selected date', () => {
    render(<OwnerDiaryEditor {...shared}
      session={{ id: 'owner:2026-11-22:new', date: entry.date, entryId: null }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save title-only' }));
    expect(spies.create).toHaveBeenCalledWith(entry.date, '', 'private', '', '', true);
    expect(spies.update).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull();
  });
});
