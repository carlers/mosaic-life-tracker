import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FloatingDock from '../../src/components/layout/FloatingDock';

describe('FloatingDock', () => {
  it('hides navigation without making restoration inaccessible and transfers keyboard focus', () => {
    const onTab = vi.fn();
    render(<FloatingDock><button onClick={onTab}>Home</button></FloatingDock>);
    const hide = screen.getByRole('button', { name: 'Hide navigation' });
    hide.focus();
    fireEvent.click(hide);
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
    expect(onTab).not.toHaveBeenCalled();
    const show = screen.getByRole('button', { name: 'Show navigation' });
    expect(show).toHaveFocus();
    fireEvent.click(show);
    expect(screen.getByRole('button', { name: 'Hide navigation' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onTab).toHaveBeenCalledOnce();
  });

  it('keeps the externally owned dismissal state and reports restoration intent', () => {
    const onHiddenChange = vi.fn();
    const { rerender } = render(<FloatingDock hidden onHiddenChange={onHiddenChange}><button>Home</button></FloatingDock>);
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show navigation' }));
    expect(onHiddenChange).toHaveBeenCalledWith(false);
    rerender(<FloatingDock hidden={false} onHiddenChange={onHiddenChange}><button>Home</button></FloatingDock>);
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });
});
