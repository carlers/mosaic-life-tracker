import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from '../../src/components/home/ViewSwitcher';

describe('Home ViewSwitcher stable icon (#2278)', () => {
  it('preserves the Category View glyph across the lazy Mosaic selector and route remount', async () => {
    const onViewChange = vi.fn();
    const first = render(<ViewSwitcher activeView="category" onViewChange={onViewChange} />);
    const initialTrigger = screen.getByRole('button', { name: 'Choose Home view' });
    const initialGlyph = initialTrigger.querySelector('svg');
    expect(initialGlyph).not.toBeNull();
    expect(initialTrigger).not.toHaveTextContent('▦');
    const iconDrawing = initialGlyph?.innerHTML;

    fireEvent.click(initialTrigger);
    const mosaicTrigger = await screen.findByRole('combobox', { name: 'Choose Home view: Category View' });
    expect(mosaicTrigger.querySelector('svg')?.innerHTML).toBe(iconDrawing);

    first.unmount(); // Leaving Home for Chats/Explore unmounts the pane.
    render(<ViewSwitcher activeView="category" onViewChange={onViewChange} />);
    const restoredTrigger = screen.getByRole('button', { name: 'Choose Home view' });
    expect(restoredTrigger.querySelector('svg')?.innerHTML).toBe(iconDrawing);
    fireEvent.click(restoredTrigger);
    const restoredPicker = await screen.findByRole('combobox', { name: 'Choose Home view: Category View' });
    expect(restoredPicker.querySelector('svg')?.innerHTML).toBe(iconDrawing);
  });
});
