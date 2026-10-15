import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ChatSyncSheet } from '../../src/components/messages/ChatSyncSheet';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children }: {
    isOpen: boolean; title: string; children: ReactNode;
  }) => isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

describe('ChatSyncSheet', () => {
  it('explains the currently running real stage without fabricated percentages', () => {
    render(<ChatSyncSheet isOpen onClose={() => {}} stage="receiving" repaired={0} error={null} />);
    expect(screen.getByRole('dialog', { name: 'Chat Sync' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Chat sync progress' })).toBeTruthy();
    expect(screen.getByText('Refreshing local messages')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('Server copies recovered: 0')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows the real error without reporting success', () => {
    render(<ChatSyncSheet isOpen onClose={() => {}} stage="failed" repaired={1}
      error="Fresh message sync timed out" />);
    expect(screen.getByRole('alert').textContent).toContain('Fresh message sync timed out');
    expect(screen.getByRole('status').textContent).toContain('stopped before completion');
    expect(screen.queryByText('Chat messages are up to date on this device.')).toBeNull();
  });

  it('does not mount a dialog while closed', () => {
    render(<ChatSyncSheet isOpen={false} onClose={() => {}} stage="sending" repaired={null} error={null} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
