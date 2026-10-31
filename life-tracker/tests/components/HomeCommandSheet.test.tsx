import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeCommandSheet } from '../../src/components/home/HomeCommandSheet';
import type { CategoryDocument } from '../../src/db/schema';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({ getSetting: () => false }),
}));

const categories: CategoryDocument[] = [
  { id: 'school', userId: 'owner', name: 'School', color: '#ffffff',
    order: 0, visibility: 'private', isDeleted: false, updatedAt: '' },
  { id: 'errands', userId: 'owner', name: 'Errands', color: '#ffffff',
    order: 1, visibility: 'private', isDeleted: false, updatedAt: '' },
  { id: 'foreign', userId: 'someone-else', name: 'Private', color: '#ffffff',
    order: 2, visibility: 'private', isDeleted: false, updatedAt: '' },
];

function open(props: Partial<React.ComponentProps<typeof HomeCommandSheet>> = {}) {
  const onCreate = vi.fn(async () => {});
  const onClose = vi.fn();
  render(<HomeCommandSheet isOpen onClose={onClose} onCreate={onCreate}
    ownerId="owner" categories={categories} isLoading={false} {...props} />);
  return { onCreate, onClose };
}

describe('Home command Preview confirmation and account safety', () => {
  it('does not create anything during parsing; creates only after explicit confirmation', async () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'add go to school to errands for tomorrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect(onCreate).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Task title') as HTMLInputElement).value).toBe('go to school');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('errands');
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: 'go to school', categoryId: 'errands', date: expect.any(String),
    }, 'bottom');
  });

  it('rejects bulk commands and does not expose the create action', () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'move all school tasks to backlogs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect(screen.getByRole('status').textContent).toContain('not supported yet');
    expect(screen.queryByRole('button', { name: 'Create task' })).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('requires explicit category and schedule for ambiguous commands; hides foreign categories', () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'add homework to School' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect((screen.getByLabelText('Task title') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByRole('option', { name: 'Private' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Enter a title');
  });

  it('honors category ownership change by resetting the review state', () => {
    const { rerender } = render(<HomeCommandSheet isOpen onClose={() => {}}
      ownerId="owner" categories={categories} isLoading={false} onCreate={async () => {}} />);
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'add study to School tomorrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect(screen.queryByLabelText('Task title')).not.toBeNull();
    rerender(<HomeCommandSheet isOpen onClose={() => {}}
      ownerId="other" categories={categories} isLoading={false} onCreate={async () => {}} />);
    expect(screen.queryByLabelText('Task title')).toBeNull();
  });
});
