import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskRequestItem } from '../../src/lib/taskRequests';

const { sendRequest, transitionRequest } = vi.hoisted(() => ({
  sendRequest: vi.fn(), transitionRequest: vi.fn(),
}));

vi.mock('../../src/lib/taskRequests', () => ({
  sendTaskRequest: sendRequest,
  transitionTaskRequest: transitionRequest,
  taskRequestOperationId: () => 'op_from_test',
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
vi.mock('../../src/hooks/useFriends', () => ({
  useOptionalFriendList: () => [
    { friendId: 'peer', friendDisplayName: 'Friend One', status: 'accepted', isDeleted: false },
  ],
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({ status: 'online' }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [{
    id: 'recipient_category', name: 'Personal', color: '#d946ef',
    visibility: 'private', userId: 'peer', order: 0, isDeleted: false,
    startedOn: '', retiredOn: '', updatedAt: '2026-11-22T00:00:00.000Z',
  }] }),
}));

import { TaskRequestCard } from '../../src/components/messages/TaskRequestCard';
import { SendTaskRequestSheet } from '../../src/components/messages/SendTaskRequestSheet';
import { AcceptTaskRequestSheet } from '../../src/components/messages/AcceptTaskRequestSheet';

const request: TaskRequestItem = {
  id: 'treq_1', senderId: 'owner', recipientId: 'peer',
  title: 'Buy groceries', note: 'Milk and eggs', suggestedDate: '2026-11-11',
  status: 'pending', revision: 'rev_1',
  createdAt: '2026-11-22T00:00:00.000Z', updatedAt: '2026-11-22T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  sendRequest.mockResolvedValue(request);
  transitionRequest.mockResolvedValue({ ...request, status: 'accepted' });
});

describe('Task Request chat and sheets', () => {
  it('shows recipient actions with distinct accessible labels and authoritative status', () => {
    const accept = vi.fn(), decline = vi.fn();
    const { rerender } = render(<TaskRequestCard item={request} event="created"
      isSender={false} onAccept={accept} onDecline={decline} />);
    expect(screen.getByText('Buy groceries')).toBeVisible();
    expect(screen.getByText('Milk and eggs')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Pending');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(accept).toHaveBeenCalledOnce();
    expect(decline).toHaveBeenCalledOnce();

    rerender(<TaskRequestCard item={{ ...request, status: 'accepted' }} event="created"
      isSender={false} onAccept={accept} onDecline={decline} />);
    expect(screen.getByRole('status')).toHaveTextContent('Accepted');
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });

  it('restricts withdraw to the sender of a pending request', () => {
    const withdraw = vi.fn();
    const { rerender } = render(<TaskRequestCard item={request} event="created"
      isSender onWithdraw={withdraw} />);
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(withdraw).toHaveBeenCalledOnce();
    rerender(<TaskRequestCard item={{ ...request, status: 'withdrawn' }} event="created"
      isSender onWithdraw={withdraw} />);
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
  });

  it('sends only the consent-safe fields from a prefilled task action', async () => {
    const close = vi.fn(), sent = vi.fn();
    render(<SendTaskRequestSheet isOpen onClose={close} onSent={sent}
      recipientId="peer" task={{ title: 'Buy groceries', date: '2026-11-11' }} />);
    const submit = screen.getByRole('button', { name: 'Send request' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(sendRequest).toHaveBeenCalledWith({
      recipientId: 'peer', title: 'Buy groceries', note: '',
      suggestedDate: '2026-11-11', operationId: 'op_from_test',
    }));
    expect(close).toHaveBeenCalledOnce();
    expect(sent).toHaveBeenCalledOnce();
  });

  it('requires a recipient-owned category and uses its color in the chooser', async () => {
    const close = vi.fn(), accepted = vi.fn();
    render(<AcceptTaskRequestSheet item={request} onClose={close} onAccepted={accepted} />);
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Your category: Select a category' }));
    expect(screen.getByRole('option', { name: 'Personal' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Personal' }));
    expect(screen.getByLabelText('Selected category color for Personal')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Add task' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(transitionRequest).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'accept', requestId: request.id,
      categoryId: 'recipient_category', date: '2026-11-11',
    })));
    expect(accepted).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
