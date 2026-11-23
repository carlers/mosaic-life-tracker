import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetLayoutGrid } from '../../src/components/home/WidgetLayoutGrid';
import { DEFAULT_WIDGET_LAYOUT, type WidgetLayoutItem } from '../../src/lib/widgetLayout';

function Harness({ onCommit = vi.fn() }: { onCommit?: (items: WidgetLayoutItem[]) => void }) {
  const [items, setItems] = React.useState<WidgetLayoutItem[]>(() => DEFAULT_WIDGET_LAYOUT.map(item => ({ ...item })));
  const [editing, setEditing] = React.useState(false);
  return (
    <div>
      <output data-testid="editor-state">{editing ? 'editing' : 'viewing'}</output>
      <WidgetLayoutGrid items={items} editing={editing} reducedMotion onStartEditing={() => setEditing(true)}
        onPreview={setItems} onCommit={onCommit}>
        {(id) => <div><span>{id}</span><button type="button">Action for {id}</button></div>}
      </WidgetLayoutGrid>
    </div>
  );
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Widget grid layout editor', () => {
  it('leaves a short tap and child action alone; starts editing only after a long press', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const card = screen.getByLabelText('Today widget');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Action for today' }),
      { pointerId: 1, button: 0, clientX: 20, clientY: 50 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('viewing');
    fireEvent.pointerUp(card, { pointerId: 1 });
    fireEvent.pointerDown(card, { pointerId: 2, button: 0, clientX: 20, clientY: 50 });
    act(() => vi.advanceTimersByTime(440));
    expect(screen.getByTestId('editor-state')).toHaveTextContent('editing');
    expect(screen.getByRole('button', { name: 'Resize Today to half width' })).toBeInTheDocument();
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
});
