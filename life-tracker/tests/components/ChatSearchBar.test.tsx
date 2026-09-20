import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ChatSearchBar } from '../../src/components/messages/ChatSearchBar';

// ---------------------------------------------------------------------------
// ChatSearchBar component tests (Layer 5).
//
// Pins the observable contract:
//   - Placeholder renders ("Search messages…").
//   - Typing fires onChange with the current value.
//   - The match counter is hidden when the query is blank and shows
//     "<matchCount>/<totalCount>" when the query is non-blank.
//   - The close button fires onClose.
//
// Deliberately NOT tested here:
//   - The mount-time 80ms focus timer. Timing-coupled; flaky under
//     happy-dom.
//   - Class strings on the counter span.
// ---------------------------------------------------------------------------

describe('ChatSearchBar', () => {
  it('typing fires onChange with the current value', () => {
    const onChange = vi.fn();
    render(
      <ChatSearchBar
        query=""
        onChange={onChange}
        matchCount={0}
        totalCount={0}
        onClose={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText('Search messages…');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('counter is hidden when query is empty and shown when non-empty', () => {
    const { rerender } = render(
      <ChatSearchBar
        query=""
        onChange={vi.fn()}
        matchCount={0}
        totalCount={5}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText('0/5')).toBeNull();

    rerender(
      <ChatSearchBar
        query="hel"
        onChange={vi.fn()}
        matchCount={2}
        totalCount={5}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('close button fires onClose', () => {
    const onClose = vi.fn();
    render(
      <ChatSearchBar
        query=""
        onChange={vi.fn()}
        matchCount={0}
        totalCount={0}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByLabelText('Close search'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
