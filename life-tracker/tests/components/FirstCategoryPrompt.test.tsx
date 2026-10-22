import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FirstCategoryPrompt } from '../../src/components/home/views/FirstCategoryPrompt';

function show(onCreate = vi.fn().mockResolvedValue(undefined)) {
  render(<FirstCategoryPrompt onCreate={onCreate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
  return onCreate;
}

describe('first category prompt', () => {
  it('creates a trimmed, private blue category with the existing owner mutation', async () => {
    const create = show();
    const save = screen.getByRole('button', { name: 'Add Category' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Category name' }), {
      target: { value: '  Work  ' },
    });
    fireEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      name: 'Work', color: '#3B82F6', visibility: 'private',
    }));
    expect(screen.getByRole('status')).toHaveTextContent('Category added.');
  });

  it('keeps the footer action available for subsequent categories and clears each successful draft', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    render(<FirstCategoryPrompt persistent onCreate={create} />);
    expect(screen.queryByText('No categories yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Category name' }), {
      target: { value: 'Work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Add category' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(screen.getByRole('textbox', { name: 'Category name' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Category name' }), {
      target: { value: 'Home' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenLastCalledWith({ name: 'Home', color: '#3B82F6', visibility: 'private' });
  });

  it('prevents invalid and repeated submit while a write is pending', async () => {
    let complete: (() => void) | undefined;
    const create = vi.fn().mockImplementation(() =>
      new Promise<void>(resolve => { complete = resolve; }));
    show(create);
    const input = screen.getByRole('textbox', { name: 'Category name' });
    const save = screen.getByRole('button', { name: 'Add Category' });
    fireEvent.change(input, { target: { value: '    ' } });
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Personal' } });
    const form = screen.getByRole('form', { name: 'Create category' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(create).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    await act(async () => { complete?.(); });
  });

  it('preserves a failed draft for retry and supports cancel', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('offline'));
    show(create);
    fireEvent.change(screen.getByRole('textbox', { name: 'Category name' }), {
      target: { value: 'Home' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByRole('textbox', { name: 'Category name' })).toHaveValue('Home');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Add category' })).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
