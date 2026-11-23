import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetLayoutGrid } from '../../src/components/home/WidgetLayoutGrid';
import { DEFAULT_WIDGET_LAYOUT, type WidgetLayoutItem } from '../../src/lib/widgetLayout';

function Harness({ onCommit = vi.fn(), onAction = vi.fn() }: {
  onCommit?: (items: WidgetLayoutItem[]) => void;
  onAction?: (id: string) => void;
}) {
  const [items, setItems] = React.useState<WidgetLayoutItem[]>(() => DEFAULT_WIDGET_LAYOUT.map(item => ({ ...item })));
  const [editing, setEditing] = React.useState(false);
  return (
    <div>
      <output data-testid="editor-state">{editing ? 'editing' : 'viewing'}</output>
      <WidgetLayoutGrid items={items} editing={editing} reducedMotion onStartEditing={() => setEditing(true)}
        onPreview={setItems} onCommit={onCommit}>
        {(id) => <div><span>{id}</span><button type="button" onClick={() => onAction(id)}>Action for {id}</button><button type="button" role="checkbox" aria-checked={false} onClick={() => onAction('checkbox')}>Toggle {id}</button></div>}
      </WidgetLayoutGrid>
    </div>
  );
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Widget grid layout editor', () => {
  it('preserves child-button short taps and starts edit mode on a deliberate long press', () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    const child = screen.getByRole('button', { name: 'Action for today' });
    fireEvent.pointerDown(child, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 20, clientY: 50 });
    act(() => vi.advanceTimersByTime(150));
    fireEvent.pointerUp(child, { pointerId: 1, pointerType: 'touch' });
    fireEvent.click(child);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('editor-state')).toHaveTextContent('viewing');

    fireEvent.pointerDown(child, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 20, clientY: 50 });
    act(() => vi.advanceTimersByTime(440));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('editing');
    fireEvent.pointerUp(child, { pointerId: 2, pointerType: 'touch' });
    fireEvent.click(child);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Resize Today to half width' })).toBeInTheDocument();
  });

  it('does not hijack a task completion checkbox even after a long press', () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Toggle today' });
    fireEvent.pointerDown(checkbox, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 20, clientY: 50 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('viewing');
    fireEvent.pointerUp(checkbox, { pointerId: 3, pointerType: 'touch' });
    fireEvent.click(checkbox);
    expect(onAction).toHaveBeenCalledWith('checkbox');
  });

  it('blocks native touch scroll only while a long-press drag is active', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const card = screen.getByLabelText('Today widget');
    fireEvent.pointerDown(card, {
      pointerId: 7, pointerType: 'touch', button: 0, clientX: 50, clientY: 50,
    });
    const before = new Event('touchmove', { bubbles: true, cancelable: true });
    document.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    act(() => vi.advanceTimersByTime(450));
    const during = new Event('touchmove', { bubbles: true, cancelable: true });
    document.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
    fireEvent.pointerUp(card, { pointerId: 7, pointerType: 'touch' });
    const after = new Event('touchmove', { bubbles: true, cancelable: true });
    document.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('resizes live via grip drag and commits only on release', () => {
    const commit = vi.fn();
    vi.useFakeTimers();
    render(<Harness onCommit={commit} />);
    const card = screen.getByLabelText('Today widget');
    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
    act(() => vi.advanceTimersByTime(440));
    fireEvent.pointerUp(card, { pointerId: 1 });
    const grip = screen.getByRole('button', { name: 'Resize Today to half width' });
    fireEvent.pointerDown(grip, { pointerId: 4, button: 0, clientX: 200, clientY: 80 });
    fireEvent.pointerMove(grip, { pointerId: 4, clientX: 115, clientY: 80 });
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'half');
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerUp(grip, { pointerId: 4 });
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0][0][0]).toMatchObject({ id: 'today', size: 'half' });
  });

  it('reorders via accessible controls without changing child widgets or sizes', () => {
    const commit = vi.fn();
    vi.useFakeTimers();
    render(<Harness onCommit={commit} />);
    const card = screen.getByLabelText('Today widget');
    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
    act(() => vi.advanceTimersByTime(440));
    fireEvent.pointerUp(card, { pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Move Today later' }));
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0][0].map((x: WidgetLayoutItem) => x.id))
      .toEqual(['diary', 'today', 'categories', 'weekly']);
    expect(screen.getByRole('button', { name: 'Action for today' })).toBeInTheDocument();
  });

  it('cancels an interrupted long press before it can steal vertical scrolling', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const card = screen.getByLabelText('Today widget');
    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 25, clientY: 80 });
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('viewing');
  });

  it('always releases an abandoned drag if the pointer is lifted outside the grid', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<Harness onCommit={commit} />);
    const card = screen.getByLabelText('Today widget');
    const grid = screen.getByTestId('widgets-layout-grid');
    fireEvent.pointerDown(card, { pointerId: 40, pointerType: 'touch', button: 0, clientX: 60, clientY: 60 });
    act(() => vi.advanceTimersByTime(450));
    expect(grid.querySelector('[data-widget-placeholder="today"]')).not.toBeNull();
    fireEvent.pointerUp(window, { pointerId: 40, pointerType: 'touch', clientX: 150, clientY: 300 });
    expect(grid.querySelector('[data-widget-placeholder]')).toBeNull();
    expect(card).not.toHaveStyle({ position: 'fixed' });
    const scroll = new Event('touchmove', { cancelable: true });
    document.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it('cancels ghosts and restores scrolling on blur, Escape and pointer cancel', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const grid = screen.getByTestId('widgets-layout-grid');
    for (const [pointerId, interrupt] of [
      [51, () => fireEvent.blur(window)],
      [52, () => fireEvent.keyDown(window, { key: 'Escape' })],
      [53, () => fireEvent.pointerCancel(window, { pointerId: 53, pointerType: 'touch' })],
    ] as const) {
      fireEvent.pointerDown(screen.getByLabelText('Today widget'), {
        pointerId, pointerType: 'touch', button: 0, clientX: 20, clientY: 20,
      });
      act(() => vi.advanceTimersByTime(450));
      expect(grid.querySelector('[data-widget-placeholder]')).not.toBeNull();
      interrupt();
      expect(grid.querySelector('[data-widget-placeholder]')).toBeNull();
      expect(screen.getByLabelText('Today widget')).not.toHaveStyle({ position: 'fixed' });
      const scroll = new Event('touchmove', { cancelable: true });
      document.dispatchEvent(scroll);
      expect(scroll.defaultPrevented).toBe(false);
    }
  });

  it('leaves vertical touch scrolling enabled in edit mode and exposes resize for every widget', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const card = screen.getByLabelText('Today widget');
    fireEvent.pointerDown(card, { pointerId: 61, pointerType: 'touch', button: 0, clientX: 40, clientY: 50 });
    act(() => vi.advanceTimersByTime(450));
    fireEvent.pointerUp(card, { pointerId: 61, pointerType: 'touch' });
    expect(card).toHaveStyle({ touchAction: 'pan-y' });
    expect(screen.getByRole('button', { name: 'Drag Today to move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resize Today diary to half width' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resize Heaviest categories to full width' })).toBeInTheDocument();
  });

  it('lets a simple grip tap switch width, without requiring a horizontal drag', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<Harness onCommit={commit} />);
    const card = screen.getByLabelText('Today widget');
    fireEvent.pointerDown(card, { pointerId: 70, button: 0, clientX: 40, clientY: 40 });
    act(() => vi.advanceTimersByTime(450));
    fireEvent.pointerUp(card, { pointerId: 70 });
    const grip = screen.getByRole('button', { name: 'Resize Today to half width' });
    fireEvent.pointerDown(grip, { pointerId: 71, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(grip, { pointerId: 71, pointerType: 'mouse', clientX: 100, clientY: 100 });
    expect(screen.getByLabelText('Today widget')).toHaveAttribute('data-widget-size', 'half');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('retains active pointer release and cancellation through callback prop rerenders', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness onCommit={vi.fn()} />);
    const grid = screen.getByTestId('widgets-layout-grid');
    fireEvent.pointerDown(screen.getByLabelText('Today widget'), {
      pointerId: 81, pointerType: 'touch', button: 0, clientX: 20, clientY: 20,
    });
    act(() => vi.advanceTimersByTime(450));
    expect(grid.querySelector('[data-widget-placeholder="today"]')).not.toBeNull();
    rerender(<Harness onCommit={vi.fn()} />);
    expect(grid.querySelector('[data-widget-placeholder="today"]')).not.toBeNull();
    fireEvent.pointerUp(window, { pointerId: 81, pointerType: 'touch' });
    expect(grid.querySelector('[data-widget-placeholder]')).toBeNull();
  });
});
