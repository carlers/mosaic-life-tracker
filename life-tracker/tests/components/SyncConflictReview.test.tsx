import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SyncConflictReview } from '../../src/components/modals/SyncConflictReview';
import { registerSyncConflictReview } from '../../src/lib/syncConflictReview';
vi.mock('../../src/hooks/useCategories', () => ({ useCategories: () => ({ categories: [] }) }));
afterEach(cleanup);

describe('owner-controlled conflict review', () => {
  it('shows both versions and retains the decision after a failed conditional write', async () => {
    const keepLocal = vi.fn().mockRejectedValue(Error('Cloud changed again'));
    const registration = registerSyncConflictReview('owner', { keepLocal, refresh: vi.fn() });
    registration.publish([{
      domain: 'tasks', documentId: 'task_1', title: 'Preserved task', revision: '9',
      canKeepLocal: true, fields: [{ label: 'Completed', local: 'Yes', remote: 'No' }],
    }]);
    render(<SyncConflictReview ownerId="owner" />);
    expect(screen.getByRole('columnheader', { name: 'This device' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Cloud' })).toBeVisible();
    expect(screen.getByRole('row', { name: 'Completed Yes No' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my version' }));
    await screen.findByRole('alert');
    expect(keepLocal).toHaveBeenCalledWith(expect.objectContaining({ revision: '9' }));
    expect(screen.getByRole('article', { name: 'Review Preserved task' })).toBeVisible();
    act(() => registration.unregister());
  });
  it('names deletion explicitly and never renders another account’s draft', async () => {
    const keepLocal = vi.fn().mockResolvedValue(undefined);
    const registration = registerSyncConflictReview('owner', { keepLocal, refresh: vi.fn() });
    registration.publish([{
      domain: 'categories', documentId: 'cat_1', title: 'Private list', revision: '4',
      canKeepLocal: true, fields: [{ label: 'Deleted', local: 'Yes', remote: 'No' }],
    }]);
    const view = render(<SyncConflictReview ownerId="other" />);
    expect(screen.queryByText('Private list')).toBeNull();
    view.rerender(<SyncConflictReview ownerId="owner" />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply my deletion' }));
    await waitFor(() => expect(keepLocal).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply my deletion' })).not.toBeDisabled());
    act(() => registration.unregister());
  });
});
