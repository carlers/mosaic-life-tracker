// Regression for #434: reject/retry must never leave a profile sheet stuck.
// Busy UI is not a substitute for handler-level synchronous single-flight.
import type React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    children,
    title,
  }: React.PropsWithChildren<{ isOpen: boolean; title: string }>) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

import { EditNameSheet } from '../../src/components/modals/EditNameSheet';
import { EditDescriptionSheet } from '../../src/components/modals/EditDescriptionSheet';

function pendingSave() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('profile save sheets', () => {
  it('name: single-flight, inline failure feedback, retained text, and retry', async () => {
    const pending = pendingSave();
    const onSave = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      <EditNameSheet
        isOpen
        currentName="Before"
        onClose={onClose}
        onSave={onSave}
      />
    );

    const nameInput = screen.getByRole('textbox', { name: 'Display Name' });
    fireEvent.change(nameInput, { target: { value: '  After  ' } });
    const save = screen.getByRole('button', { name: 'Save Name' });

    // Same React batch: both handlers fire before disabled re-render.
    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith('After');
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      pending.reject(new Error('storage temporarily unavailable'));
      await pending.promise.catch(() => undefined);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i);
    expect(nameInput).toHaveValue('  After  ');
    expect(save).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('description: single-flight, inline failure feedback, text retained, retry', async () => {
    const pending = pendingSave();
    const onSave = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      <EditDescriptionSheet
        isOpen
        currentDescription="Before"
        onClose={onClose}
        onSave={onSave}
      />
    );
    const description = screen.getByRole('textbox', { name: 'Bio / Description' });
    fireEvent.change(description, { target: { value: '  A fresh bio  ' } });
    const save = screen.getByRole('button', { name: 'Save Description' });

    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith('A fresh bio');

    await act(async () => {
      pending.reject(new Error('temporary failure'));
      await pending.promise.catch(() => undefined);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i);
    expect(description).toHaveValue('  A fresh bio  ');
    expect(save).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('ignores the late success from a previous opening of the name sheet', async () => {
    const prior = pendingSave();
    const onSave = vi.fn().mockReturnValueOnce(prior.promise).mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    const props = { currentName: 'Previous', onClose, onSave };
    const view = render(<EditNameSheet isOpen {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Display Name' }), {
      target: { value: 'Prior draft' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Name' }));
    expect(onSave).toHaveBeenCalledOnce();

    // Forced parent teardown/reopen is possible even when gestures are locked.
    view.rerender(<EditNameSheet isOpen={false} {...props} />);
    view.rerender(<EditNameSheet isOpen {...props} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Display Name' }), {
      target: { value: 'Current' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Name' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledTimes(2);

    await act(async () => {
      prior.resolve();
      await prior.promise;
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

});
