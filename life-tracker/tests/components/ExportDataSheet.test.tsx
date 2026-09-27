import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  inspectBackupFile: vi.fn(),
  restoreUserData: vi.fn(),
  exportUserData: vi.fn(),
  triggerDownload: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_A', email: 'a@example.com', name: 'A' },
  }),
}));

vi.mock('../../src/lib/exportData', () => ({
  exportUserData: mocks.exportUserData,
  triggerDownload: mocks.triggerDownload,
}));

vi.mock('../../src/lib/restoreData', () => ({
  inspectBackupFile: mocks.inspectBackupFile,
  restoreUserData: mocks.restoreUserData,
}));

import { ExportDataSheet } from '../../src/components/modals/ExportDataSheet';

const preview = {
  version: 2,
  exportedAt: '2026-09-20T12:00:00.000Z',
  sourceUser: { id: 'user_A', email: 'a@example.com', name: 'A' },
  counts: {
    tasks: 2,
    categories: 1,
    diary: 1,
    settings: 2,
    images: 0,
  },
  imagesIncluded: false,
  friendshipsReferenceOnly: 0,
};

describe('Backup & Restore destructive confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inspectBackupFile.mockResolvedValue(preview);
    mocks.exportUserData.mockResolvedValue({
      blob: new Blob(['backup'], { type: 'application/json' }),
      filename: 'mosaic-backup.json',
      counts: {
        tasks: 0,
        categories: 0,
        diary: 0,
        settings: 0,
        friendships: 0,
        images: 0,
        missingImages: 0,
      },
    });
    mocks.restoreUserData.mockResolvedValue({
      mode: 'replace',
      restored: { tasks: 2, categories: 1, diary: 1, settings: 2 },
      skippedNewer: 0,
      tombstoned: 1,
      imagesRestored: 0,
      imagesMissing: 0,
      safetyBackupDownloaded: true,
    });
  });

  it('reports a successful backup completion time', async () => {
    const onBackupComplete = vi.fn();
    render(
      <ExportDataSheet
        isOpen
        onClose={vi.fn()}
        onBackupComplete={onBackupComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download Backup' }));

    await waitFor(() => expect(mocks.exportUserData).toHaveBeenCalledOnce());
    expect(mocks.triggerDownload).toHaveBeenCalledOnce();
    expect(onBackupComplete).toHaveBeenCalledWith(expect.any(String));
  });

  it('requires a second explicit confirmation before Replace Personal Data runs', async () => {
    const onClose = vi.fn();
    const onRestoreComplete = vi.fn();
    render(
      <ExportDataSheet
        isOpen
        onClose={onClose}
        onSuccess={vi.fn()}
        onRestoreComplete={onRestoreComplete}
      />
    );

    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Choose Mosaic backup file'), {
      target: { files: [file] },
    });

    await screen.findByText('backup.json');
    fireEvent.click(
      screen.getByRole('radio', { name: /Replace personal data with backup/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Replace Personal Data' })
    );

    const confirmation = await screen.findByRole('dialog', {
      name: 'Replace personal data?',
    });
    expect(confirmation).toHaveTextContent(/Current-only personal data will be deleted from sync/i);
    expect(confirmation).toHaveTextContent(/Friends, messages, and your login account are not affected/i);
    expect(mocks.restoreUserData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Replace Data' }));

    await waitFor(() =>
      expect(mocks.restoreUserData).toHaveBeenCalledWith(
        file,
        { id: 'user_A', email: 'a@example.com', name: 'A' },
        expect.objectContaining({ mode: 'replace' })
      )
    );
    expect(onRestoreComplete).toHaveBeenCalledWith(expect.any(String));
  });

  it('resets the safer Merge mode whenever a different backup is chosen', async () => {
    render(<ExportDataSheet isOpen onClose={vi.fn()} />);

    const input = screen.getByLabelText('Choose Mosaic backup file');
    const first = new File(['{}'], 'first.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [first] } });
    await screen.findByText('first.json');

    fireEvent.click(
      screen.getByRole('radio', { name: /Replace personal data with backup/i })
    );
    expect(
      screen.getByRole('radio', { name: /Replace personal data with backup/i })
    ).toBeChecked();

    const second = new File(['{}'], 'second.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [second] } });
    await screen.findByText('second.json');

    expect(
      screen.getByRole('radio', { name: /Merge with current data/i })
    ).toBeChecked();
  });
});
