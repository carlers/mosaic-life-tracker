import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayPanelResizeHandle } from '../../src/components/home/views/DayPanelResizeHandle';

describe('Day Panel keyboard divider', () => {
  it('supports directional resizing, Home and End for a panel on the right', () => {
    const onResize = vi.fn();
    const onCommit = vi.fn();
    const frameRef = { current: document.createElement('div') };
    render(<DayPanelResizeHandle side="right" width={400} frameWidth={1280}
      frameRef={frameRef} onResize={onResize} onCommit={onCommit} />);
    const separator = screen.getByRole('separator', { name: 'Resize day details panel' });
    expect(separator).toHaveAttribute('aria-valuemin', '320');
    expect(separator).toHaveAttribute('aria-valuenow', '400');
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(onResize).toHaveBeenLastCalledWith(420);
    expect(onCommit).toHaveBeenLastCalledWith(420);
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(onCommit).toHaveBeenLastCalledWith(320);
    fireEvent.keyDown(separator, { key: 'End' });
    expect(onCommit).toHaveBeenLastCalledWith(708);
  });
  it('reverses ArrowLeft semantics when the panel is on the left', () => {
    const onResize = vi.fn();
    const onCommit = vi.fn();
    render(<DayPanelResizeHandle side="left" width={400} frameWidth={1040}
      frameRef={{ current: document.createElement('div') }}
      onResize={onResize} onCommit={onCommit} />);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft', shiftKey: true });
    expect(onResize).toHaveBeenCalledWith(360);
    expect(onCommit).toHaveBeenCalledWith(360);
  });
});
