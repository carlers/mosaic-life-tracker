import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiaryDocument } from '../../src/db/schema';

const sheetProps = vi.hoisted(() => vi.fn());
vi.mock('../../src/components/home/views/DiaryEntrySheet', () => ({
  DiaryEntrySheet: (props: {
    date: string;
    entry?: DiaryDocument;
    author: string;
    onSave?: (date: string, body: string, visibility: DiaryDocument['visibility'],
      emoji: string, photos: string, savedEntryId?: string) => Promise<string | void>;
    onDelete?: (date: string) => Promise<void>;
  }) => {
    sheetProps(props);
    return <>
      <button onClick={() => { void props.onSave?.(props.date, 'entry body', 'private', '⭐', '', undefined); }}>Create or update</button>
      <button onClick={() => { void props.onSave?.(props.date, 'entry body', 'private', '⭐', '', 'created'); }}>Retry saved</button>
      {props.onDelete && <button onClick={() => { void props.onDelete?.(props.date); }}>Delete</button>}
    </>;
  },
}));

import { OwnerDiaryEditorAdapter } from '../../src/components/home/views/OwnerDiaryEditorAdapter';

describe('owner Diary lazy wrapper', () => {
  it('creates once and retries as an update using the editor retained ID', async () => {
    const createEntry = vi.fn().mockResolvedValue('created');
    const updateEntry = vi.fn().mockResolvedValue(undefined);
    const deleteEntryById = vi.fn().mockResolvedValue(undefined);
    render(<OwnerDiaryEditorAdapter
      session={{ id: 'draft', date: '2026-11-23', entryId: null }}
      isOpen author="Owner" onClose={vi.fn()} onExitComplete={vi.fn()}
      createEntry={createEntry} updateEntry={updateEntry} deleteEntryById={deleteEntryById} />);
    expect(sheetProps.mock.lastCall?.[0]).toMatchObject({ date: '2026-11-23', author: 'Owner' });
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create or update' }));
    await waitFor(() => expect(createEntry).toHaveBeenCalledWith('2026-11-23', 'entry body', 'private', '⭐', ''));
    fireEvent.click(screen.getByRole('button', { name: 'Retry saved' }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalledWith('created', '2026-11-23', 'entry body', 'private', '⭐', ''));
  });

  it('keeps existing entry ID for updates and deletes', async () => {
    const createEntry = vi.fn();
    const updateEntry = vi.fn().mockResolvedValue(undefined);
    const deleteEntryById = vi.fn().mockResolvedValue(undefined);
    render(<OwnerDiaryEditorAdapter
      session={{ id: 'existing', date: '2026-11-23', entryId: 'entry_1' }}
      isOpen author="Owner" onClose={vi.fn()} onExitComplete={vi.fn()}
      createEntry={createEntry} updateEntry={updateEntry} deleteEntryById={deleteEntryById} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create or update' }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalledWith('entry_1', '2026-11-23', 'entry body', 'private', '⭐', ''));
    expect(createEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteEntryById).toHaveBeenCalledWith('entry_1'));
  });
});
