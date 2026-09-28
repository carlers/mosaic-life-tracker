// Regression: §2 (calendar arrow-key navigation preserves editable caret keys).
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { useHorizontalArrowNavigation } from '../../src/hooks/useHorizontalArrowNavigation';

function Harness({
  enabled = true,
  onLeft,
  onRight,
}: {
  enabled?: boolean;
  onLeft: () => void;
  onRight: () => void;
}) {
  useHorizontalArrowNavigation({ enabled, onLeft, onRight });
  return (
    <div>
      <button type="button">Calendar action</button>
      <input aria-label="Task title" />
    </div>
  );
}

describe('useHorizontalArrowNavigation', () => {
  it('maps left/right arrows to horizontal navigation', () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    render(<Harness onLeft={onLeft} onRight={onRight} />);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(onRight).toHaveBeenCalledTimes(1);
  });

  it('does not steal arrows from editable fields or modified browser shortcuts', () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const { getByLabelText } = render(
      <Harness onLeft={onLeft} onRight={onRight} />
    );

    fireEvent.keyDown(getByLabelText('Task title'), { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });

    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  it('does nothing while the owning view is disabled', () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    render(
      <Harness enabled={false} onLeft={onLeft} onRight={onRight} />
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });
});
