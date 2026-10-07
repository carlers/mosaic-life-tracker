import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ACCENT_COLOR_PALETTES } from '../../src/constants/colors';
import { ColorPalettePicker } from '../../src/components/ui/ColorPalettePicker';

describe('ColorPalettePicker', () => {
  it('opens on the palette containing the selected category color', () => {
    render(
      <ColorPalettePicker
        selectedColor="#3B82F6"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: 'Cool' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('radio', { name: 'Select color #3B82F6' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('accepts a separate accent palette dataset', () => {
    const onSelect = vi.fn();
    render(
      <ColorPalettePicker
        selectedColor="#10B981"
        onSelect={onSelect}
        palettes={ACCENT_COLOR_PALETTES}
        ariaLabel="Choose app accent color"
      />
    );

    expect(
      screen.getByRole('radiogroup', { name: 'Choose app accent color' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #3B82F6' }));
    expect(onSelect).toHaveBeenCalledWith('#3B82F6');
  });
});
