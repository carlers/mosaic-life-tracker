import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetLayoutGrid } from '../../src/components/home/WidgetLayoutGrid';
import { DEFAULT_WIDGET_LAYOUT, type WidgetLayoutItem } from '../../src/lib/widgetLayout';

function Harness({ onCommit = vi.fn(), onAction = vi.fn() }: {
  onCommit?: (items: WidgetLayoutItem[]) => void;
  onAction?: (id: string) => void;
}) {
  const [items, setItems] = React.useState<WidgetLayoutItem[]>(() =>
    DEFAULT_WIDGET_LAYOUT.map(item => ({ ...item })));
  const [editing, setEditing] = React.useState(false);
  return <div>
    <output data-testid="editor-state">{editing ? 'editing' : 'viewing'}</output>
    <div data-widgets-scrollport="true" style={{ height: 280, overflowY: 'auto' }}>
      <WidgetLayoutGrid items={items} editing={editing} reducedMotion
        onStartEditing={() => setEditing(true)}
        onPreview={setItems} onCommit={onCommit}>
        {id => <div style={{ height: 240 }}>
          <span>{id}</span>
          <button type="button" onClick={() => onAction(id)}>Action for {id}</button>
          <button type="button" role="checkbox" aria-checked={false}
            onClick={() => onAction('checkbox')}>Toggle {id}</button>
        </div>}
      </WidgetLayoutGrid>
    </div>
  </div>;
}
const touch = (node: Element, pointerId: number, x = 40, y = 40) => {
  fireEvent.pointerDown(node, { pointerId, pointerType: 'touch', button: 0, clientX: x, clientY: y });
};
const move = (pointerId: number, x: number, y: number) =>
  fireEvent.pointerMove(window, { pointerId, pointerType: 'touch', clientX: x, clientY: y });
const release = (pointerId: number, x = 40, y = 40) =>
  fireEvent.pointerUp(window, { pointerId, pointerType: 'touch', clientX: x, clientY: y });
const enterEdit = () => {
  touch(screen.getByLabelText('Today widget'), 1);
  act(() => vi.advanceTimersByTime(450));
  release(1);
  expect(screen.getByTestId('editor-state')).toHaveTextContent('editing');
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Widgets stable drag and resize ownership', () => {
  it('keeps ordinary widget actions and checkboxes actionable before edit, even on long press', () => {
    vi.useFakeTimers();
    const action = vi.fn();
    render(<Harness onAction={action} />);
    fireEvent.click(screen.getByRole('button', { name: 'Action for today' }));
    expect(action).toHaveBeenCalledWith('today');
    touch(screen.getByRole('checkbox', { name: 'Toggle today' }), 4);
    act(() => vi.advanceTimersByTime(490));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('viewing');
    release(4);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Toggle today' }));
    expect(action).toHaveBeenCalledWith('checkbox');
  });

  it('enters edit on hold but never positions the real grid card fixed', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<Harness onCommit={commit} />);
    touch(screen.getByLabelText('Today widget'), 8);
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('editing');
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-placeholder', 'today');
    expect(screen.getByLabelText('Today widget')).not.toHaveStyle({ position: 'fixed' });
    expect(document.body.querySelector('[data-widget-drag-overlay="today"]')).not.toBeNull();
    release(8);
    expect(document.body.querySelector('[data-widget-drag-overlay]')).toBeNull();
    expect(screen.getByLabelText('Today widget')).not.toHaveAttribute('data-widget-placeholder');
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not prevent native touch scrolling before hold, and restores it after release', () => {
    vi.useFakeTimers();
    render(<Harness />);
    touch(screen.getByLabelText('Today widget'), 9);
    const before = new Event('touchmove', { cancelable: true });
    document.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    act(() => vi.advanceTimersByTime(450));
    const during = new Event('touchmove', { cancelable: true });
    document.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
    release(9);
    const after = new Event('touchmove', { cancelable: true });
    document.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('requires a real grip drag to resize and commits exactly once', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<Harness onCommit={commit} />);
    enterEdit();
    const grip = screen.getByRole('button', { name: 'Drag to resize Today to half width' });
    touch(grip, 12, 200, 80);
    release(12, 200, 80);
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'full');
    expect(commit).not.toHaveBeenCalled();
    touch(grip, 13, 200, 80);
    move(13, 130, 80);
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'half');
    release(13, 130, 80);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0][0]).toMatchObject({ id: 'today', size: 'half' });
  });

  it('cancels the drag on blur, cancel, and Escape, never leaving overlay or touch scroll blockers', () => {
    vi.useFakeTimers();
    render(<Harness />);
    for (const [id, cancel] of [
      [21, () => fireEvent.blur(window)],
      [22, () => fireEvent.keyDown(window, { key: 'Escape' })],
      [23, () => fireEvent.pointerCancel(window, { pointerId: 23, pointerType: 'touch' })],
    ] as const) {
      touch(screen.getByLabelText('Today widget'), id);
      act(() => vi.advanceTimersByTime(450));
      expect(document.body.querySelector('[data-widget-drag-overlay]')).not.toBeNull();
      cancel();
      expect(document.body.querySelector('[data-widget-drag-overlay]')).toBeNull();
      expect(screen.getByLabelText('Today widget')).not.toHaveAttribute('data-widget-placeholder');
      const scroll = new Event('touchmove', { cancelable: true });
      document.dispatchEvent(scroll);
      expect(scroll.defaultPrevented).toBe(false);
    }
  });

  it('survives rerendered callbacks and releases outside all widgets', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness onCommit={vi.fn()} />);
    touch(screen.getByLabelText('Today widget'), 31);
    act(() => vi.advanceTimersByTime(450));
    rerender(<Harness onCommit={vi.fn()} />);
    expect(document.body.querySelector('[data-widget-drag-overlay]')).not.toBeNull();
    release(31, 5000, -1000);
    expect(document.body.querySelector('[data-widget-drag-overlay]')).toBeNull();
  });

  it('supports the same move and resize keyboard alternatives without pointer taps', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<Harness onCommit={commit} />);
    enterEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Move Today later' }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0].map((item: WidgetLayoutItem) => item.id))
      .toEqual(['diary', 'today', 'categories', 'weekly']);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag to resize Today to half width' }),
      { key: 'ArrowLeft' });
    expect(commit).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'half');
  });

  it('discards a native page-scroll movement before a long-press timer activates', () => {
    vi.useFakeTimers();
    render(<Harness />);
    touch(screen.getByLabelText('Today widget'), 48, 20, 20);
    move(48, 20, 100);
    act(() => vi.advanceTimersByTime(500));
    expect(document.body.querySelector('[data-widget-drag-overlay]')).toBeNull();
    expect(screen.getByTestId('editor-state')).toHaveTextContent('viewing');
    release(48, 20, 100);
  });

  it('does not resize by double clicking or simply clicking a resize grip', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<Harness onCommit={commit} />);
    fireEvent.doubleClick(screen.getByLabelText('Today widget'));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('editing');
    const grip = screen.getByRole('button', { name: 'Drag to resize Today to half width' });
    fireEvent.click(grip);
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'full');
    expect(commit).not.toHaveBeenCalled();
  });

  it('keeps drag and resize active after a transient lostpointercapture event', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<Harness onCommit={commit} />);
    enterEdit();
    const grip = screen.getByRole('button', { name: 'Drag to resize Today to half width' });
    touch(grip, 71, 200, 80);
    fireEvent.lostPointerCapture(screen.getByTestId('widgets-layout-grid'), {
      pointerId: 71, pointerType: 'touch',
    });
    move(71, 120, 80);
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'half');
    release(71, 120, 80);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'half');
  });
});
