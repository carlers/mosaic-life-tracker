import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepareTodoMateTransfer: vi.fn(),
  restoreUserData: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_A', email: 'mosaic@example.com', name: 'Mosaic User' },
  }),
}));

vi.mock('../../src/lib/todomateImport', () => ({
  prepareTodoMateTransfer: mocks.prepareTodoMateTransfer,
}));

vi.mock('../../src/lib/restoreData', () => ({
  restoreUserData: mocks.restoreUserData,
}));

import { TodoMateImportSheet } from '../../src/components/modals/TodoMateImportSheet';

describe('TodoMateImportSheet', () => {
  const preparedFile = new File(['{}'], 'todomate.json', {
    type: 'application/json',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.prepareTodoMateTransfer.mockResolvedValue({
      file: preparedFile,
      preview: {
        categories: 3,
        tasks: 12,
        diary: 2,
        unscheduledMovedToToday: 1,
        photosFound: 2,
        photosReady: 2,
        photosUnavailable: 0,
        routinesReferenced: 1,
      },
    });
    mocks.restoreUserData.mockResolvedValue({
      mode: 'merge',
      restored: { tasks: 12, categories: 3, diary: 2, settings: 0 },
      skippedNewer: 1,
      tombstoned: 0,
      imagesRestored: 2,
      imagesMissing: 0,
      safetyBackupDownloaded: false,
      syncState: 'synced',
      syncError: '',
    });
  });

  it('previews the transfer and clears the TodoMate password immediately afterward', async () => {
    render(<TodoMateImportSheet isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('TodoMate email'), {
      target: { value: 'todo@example.com' },
    });
    const password = screen.getByLabelText('TodoMate password');
    fireEvent.change(password, { target: { value: 'secret-password' } });

    fireEvent.click(screen.getByRole('button', { name: 'Preview Transfer' }));

    await screen.findByText(/12 tasks · 3 categories · 2 diary entries/i);
    expect(mocks.prepareTodoMateTransfer).toHaveBeenCalledWith(
      {
        email: 'todo@example.com',
        password: 'secret-password',
      },
      expect.objectContaining({ onProgress: expect.any(Function) })
    );
    expect(password).toHaveValue('');
    expect(screen.getByText(/1 unscheduled task will be placed on today/i)).toBeInTheDocument();
    expect(
      screen.getByText(/2 of 2 TodoMate photo attachments are ready to copy/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/1 TodoMate routine reference will stay linked/i)).toBeInTheDocument();
    expect(screen.getByText(/Existing newer Mosaic data wins/i)).toBeInTheDocument();
  });

  it('reports photo downloads that could not be prepared without blocking the import', async () => {
    mocks.prepareTodoMateTransfer.mockResolvedValueOnce({
      file: preparedFile,
      preview: {
        categories: 3,
        tasks: 12,
        diary: 2,
        unscheduledMovedToToday: 0,
        photosFound: 4,
        photosReady: 3,
        photosUnavailable: 1,
        routinesReferenced: 0,
      },
    });

    render(<TodoMateImportSheet isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('TodoMate email'), {
      target: { value: 'todo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('TodoMate password'), {
      target: { value: 'secret-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview Transfer' }));

    await screen.findByText(/3 of 4 TodoMate photo attachments are ready to copy/i);
    expect(
      screen.getByText(/1 TodoMate photo attachment could not be downloaded/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Import into Mosaic' })
    ).toBeEnabled();
  });

  it('imports only through Mosaic Merge restore', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(
      <TodoMateImportSheet
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText('TodoMate email'), {
      target: { value: 'todo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('TodoMate password'), {
      target: { value: 'secret-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview Transfer' }));

    await screen.findByRole('button', { name: 'Import into Mosaic' });
    fireEvent.click(screen.getByRole('button', { name: 'Import into Mosaic' }));

    await waitFor(() =>
      expect(mocks.restoreUserData).toHaveBeenCalledWith(
        preparedFile,
        {
          id: 'user_A',
          email: 'mosaic@example.com',
          name: 'Mosaic User',
        },
        expect.objectContaining({
          mode: 'merge',
          onProgress: expect.any(Function),
        })
      )
    );
    expect(onSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/17 restored.*2 photos copied.*1 newer Mosaic item kept/)
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancels a preview when the sheet closes and ignores its stale result', async () => {
    let resolveFirst!: (value: unknown) => void;
    let firstSignal: AbortSignal | undefined;
    mocks.prepareTodoMateTransfer
      .mockImplementationOnce((_credentials, options) => {
        firstSignal = options.signal;
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      })
      .mockResolvedValueOnce({
        file: preparedFile,
        preview: {
          categories: 1,
          tasks: 2,
          diary: 0,
          unscheduledMovedToToday: 0,
          photosFound: 0,
          photosReady: 0,
          photosUnavailable: 0,
          routinesReferenced: 0,
        },
      });

    const { rerender } = render(
      <TodoMateImportSheet isOpen onClose={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText('TodoMate email'), {
      target: { value: 'first@example.com' },
    });
    fireEvent.change(screen.getByLabelText('TodoMate password'), {
      target: { value: 'pw-one-12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview Transfer' }));
    await waitFor(() => expect(firstSignal).toBeDefined());

    rerender(<TodoMateImportSheet isOpen={false} onClose={vi.fn()} />);
    expect(firstSignal?.aborted).toBe(true);

    rerender(<TodoMateImportSheet isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('TodoMate email'), {
      target: { value: 'second@example.com' },
    });
    fireEvent.change(screen.getByLabelText('TodoMate password'), {
      target: { value: 'pw-two-12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview Transfer' }));
    await screen.findByText(/2 tasks · 1 categories · 0 diary entries/i);

    resolveFirst({
      file: preparedFile,
      preview: {
        categories: 99,
        tasks: 999,
        diary: 99,
        unscheduledMovedToToday: 0,
        photosFound: 0,
        photosReady: 0,
        photosUnavailable: 0,
        routinesReferenced: 0,
      },
    });
    await Promise.resolve();

    expect(screen.queryByText(/999 tasks · 99 categories/i)).not.toBeInTheDocument();
  });

  it('reports sync pending after local apply without claiming full completion', async () => {
    const onSuccess = vi.fn();
    mocks.restoreUserData.mockImplementationOnce(async (_file, _user, options) => {
      options.onLocalApplyComplete?.();
      return {
        mode: 'merge',
        restored: { tasks: 12, categories: 3, diary: 2, settings: 0 },
        skippedNewer: 0,
        tombstoned: 0,
        imagesRestored: 0,
        imagesMissing: 0,
        safetyBackupDownloaded: false,
        syncState: 'pending',
        syncError: 'network timeout',
      };
    });

    render(
      <TodoMateImportSheet isOpen onClose={vi.fn()} onSuccess={onSuccess} />
    );
    fireEvent.change(screen.getByLabelText('TodoMate email'), {
      target: { value: 'todo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('TodoMate password'), {
      target: { value: 'pw-sync-12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview Transfer' }));
    await screen.findByRole('button', { name: 'Import into Mosaic' });
    fireEvent.click(screen.getByRole('button', { name: 'Import into Mosaic' }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/imported locally · Sync pending/i)
      )
    );
    const marker = JSON.parse(
      localStorage.getItem('mosaic_todomate_import_v1_user_A') || '{}'
    );
    expect(marker.phase).toBe('applied');
  });

  it('does not expose a destructive replace mode', async () => {
    render(<TodoMateImportSheet isOpen onClose={vi.fn()} />);

    expect(
      screen.queryByText(/Replace personal data/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio')
    ).not.toBeInTheDocument();
  });
});
