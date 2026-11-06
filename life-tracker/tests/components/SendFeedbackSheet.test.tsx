import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ submit: vi.fn(), id: vi.fn() }));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children }: React.PropsWithChildren<{ isOpen: boolean; title: string }>) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));
vi.mock('../../src/lib/privateFeedback', () => ({
  FEEDBACK_KINDS: { idea: 'Suggestion', experience: 'Experience', other: 'Other feedback' },
  newFeedbackRequestId: mocks.id,
  collectFeedbackDiagnostics: () => ({ version: '0.85.0', os: 'Android' }),
  submitPrivateFeedback: mocks.submit,
}));

import { SendFeedbackSheet } from '../../src/components/modals/SendFeedbackSheet';

beforeEach(() => {
  let number = 0;
  mocks.id.mockReset().mockImplementation(() => String(++number).padStart(32, 'a'));
  mocks.submit.mockReset().mockResolvedValue({ reference: 'bug_' + 'b'.repeat(32) });
});
describe('Send Feedback', () => {
  it('submits privately with no automatic diagnostics and confirms the receipt', async () => {
    render(<SendFeedbackSheet isOpen onClose={() => {}} userId="alice" />);
    expect(screen.queryByText(/device information that will be sent/i)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your feedback' }), { target: { value: 'Make search faster' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send privately' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(
      'idea', 'Make search faster', expect.any(String), undefined
    ));
    expect(await screen.findByText('Your private feedback was received.')).toBeInTheDocument();
    expect(screen.queryByText(/public GitHub issue created/i)).toBeNull();
  });
  it('preserves drafts when closed, only sends diagnostics after opt-in, and clears on account change', async () => {
    const page = render(<SendFeedbackSheet isOpen onClose={() => {}} userId="alice" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Your feedback' }), { target: { value: 'Unsent draft' } });
    page.rerender(<SendFeedbackSheet isOpen={false} onClose={() => {}} userId="alice" />);
    page.rerender(<SendFeedbackSheet isOpen onClose={() => {}} userId="alice" />);
    expect(screen.getByRole('textbox', { name: 'Your feedback' })).toHaveValue('Unsent draft');
    fireEvent.click(screen.getByRole('checkbox', { name: /Include basic Mosaic version/i }));
    expect(screen.getByText(/Device information that will be sent/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send privately' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(
      'idea', 'Unsent draft', expect.any(String), { version: '0.85.0', os: 'Android' }
    ));
    page.rerender(<SendFeedbackSheet isOpen onClose={() => {}} userId="bob" />);
    expect(screen.getByRole('textbox', { name: 'Your feedback' })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /Include basic Mosaic version/i })).not.toBeChecked();
  });
  it('keeps an unchanged draft and request ID for retries on uncertain failure', async () => {
    mocks.submit.mockRejectedValueOnce(new Error('network'));
    render(<SendFeedbackSheet isOpen onClose={() => {}} userId="alice" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Your feedback' }), { target: { value: 'Please improve contrast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send privately' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Send privately' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[0][2]).toEqual(mocks.submit.mock.calls[1][2]);
  });
});
