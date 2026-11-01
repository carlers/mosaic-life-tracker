import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const st = vi.hoisted(() => ({
  submit: vi.fn(),
  clipboard: vi.fn(),
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, title, isOpen }: React.PropsWithChildren<{ title: string; isOpen: boolean }>) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));
vi.mock('../../src/lib/bugReports', () => ({
  newBugReportRequestId: () => 'a'.repeat(32),
  collectBugReportDiagnostics: () => ({ os: 'test' }),
  submitBugReport: st.submit,
}));

import { BugReportSheet } from '../../src/components/modals/BugReportSheet';

const reference = 'bug_' + 'b'.repeat(32);
beforeEach(() => {
  st.submit.mockReset().mockResolvedValue({
    reportId: reference,
    issueUrl: 'https://github.com/carlers/mosaic-life-tracker/issues/123',
  });
  st.clipboard.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: st.clipboard },
  });
});
async function submittedSheet() {
  render(<BugReportSheet isOpen onClose={() => {}} userId="test_user" />);
  fireEvent.change(screen.getByRole('textbox', { name: /what went wrong/i }), {
    target: { value: 'Synthetic problem' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
    target: { value: 'Synthetic details only' },
  });
  fireEvent.click(screen.getByRole('checkbox', {
    name: /agree to publish this report/i,
  }));
  fireEvent.click(screen.getByRole('button', { name: /publish public github issue/i }));
  await screen.findByText('Public GitHub issue created.');
}
describe('bug report confirmation reference copy', () => {
  it('copies only the internal reference, confirms success, and keeps issue link', async () => {
    await submittedSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Copy internal reference' }));
    await waitFor(() => expect(st.clipboard).toHaveBeenCalledWith(reference));
    expect(await screen.findByRole('button', { name: 'Internal reference copied' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View issue on GitHub' }).getAttribute('href'))
      .toBe('https://github.com/carlers/mosaic-life-tracker/issues/123');
    expect(st.submit).toHaveBeenCalledTimes(1);
  });
  it('retains the visible reference and displays a clipboard failure message', async () => {
    st.clipboard.mockRejectedValueOnce(new Error('Clipboard denied'));
    await submittedSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Copy internal reference' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',
      'Could not copy reference. Select the text to copy it.');
    expect(screen.getByText(reference)).toBeTruthy();
    expect(st.submit).toHaveBeenCalledTimes(1);
  });
});
