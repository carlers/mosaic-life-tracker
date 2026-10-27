import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountStartView } from '../../src/components/auth/AccountStartView';

describe('explicit new-data account start', () => {
  it('makes no default choice, discloses missing history and requires consent', () => {
    const onContinue = vi.fn(async () => true);
    render(<AccountStartView busy={false} error={null} onContinue={onContinue} onCancel={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Continue with new data' });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Matching emails do not link accounts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /earlier Mosaic data/ }));
    fireEvent.click(submit);
    expect(onContinue).toHaveBeenCalledWith('recovery-pending');
  });
  it('allows a fresh choice and a safe sign-out instead of implied migration', () => {
    const onContinue = vi.fn(async () => true), onCancel = vi.fn(async () => true);
    render(<AccountStartView busy={false} error={null} onContinue={onContinue} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('radio', { name: 'I am starting a new Mosaic account.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue with new data' }));
    expect(onContinue).toHaveBeenCalledWith('fresh');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
