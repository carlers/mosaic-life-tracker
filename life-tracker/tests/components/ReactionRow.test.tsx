import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ReactionRow } from '../../src/components/messages/ReactionRow';
import type { Reaction } from '../../src/lib/reactionUtils';

// ---------------------------------------------------------------------------
// ReactionRow component tests (Layer 5).
//
// Pins the observable contract: renders one chip per reaction with the
// emoji and the count, caps at MAX_VISIBLE (6), shows an overflow "+N",
// and fires onToggle(emoji) on chip tap.
//
// Deliberately NOT tested here:
//   - The `mine` highlight. That is a className-string check (emerald vs
//     grey), internals-coupled and §24.3-non-compliant.
//   - Framer Motion whileTap.
// ---------------------------------------------------------------------------

describe('ReactionRow', () => {
  it('renders nothing when reactions is empty', () => {
    const { container } = render(
      <ReactionRow
        reactions={[]}
        currentUserId="user_A"
        isOutgoing={false}
        onToggle={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders each reaction chip with emoji and count; tap fires onToggle(emoji)', () => {
    const onToggle = vi.fn();
    const reactions: Reaction[] = [
      { emoji: '👍', userIds: ['u1', 'u2'] },
      { emoji: '❤️', userIds: ['u1'] },
    ];
    render(
      <ReactionRow
        reactions={reactions}
        currentUserId="user_A"
        isOutgoing={false}
        onToggle={onToggle}
      />
    );
    const thumbsUp = screen.getByText('👍').closest('button');
    expect(thumbsUp).not.toBeNull();
    expect(thumbsUp?.textContent).toContain('2');
    const heart = screen.getByText('❤️').closest('button');
    expect(heart?.textContent).toContain('1');
    fireEvent.click(thumbsUp as Element);
    expect(onToggle).toHaveBeenCalledWith('👍');
  });

  it('caps visible chips at 6 and shows +N overflow', () => {
    const reactions: Reaction[] = Array.from({ length: 9 }, (_, i) => ({
      emoji: `e${i}`,
      userIds: ['u1'],
    }));
    render(
      <ReactionRow
        reactions={reactions}
        currentUserId="user_A"
        isOutgoing={false}
        onToggle={vi.fn()}
      />
    );
    for (let i = 0; i < 6; i++) {
      expect(screen.queryByText(`e${i}`)).not.toBeNull();
    }
    expect(screen.queryByText('e6')).toBeNull();
    expect(screen.queryByText('+3')).not.toBeNull();
  });

  it('does not render an overflow indicator when reactions <= 6', () => {
    const reactions: Reaction[] = Array.from({ length: 6 }, (_, i) => ({
      emoji: `e${i}`,
      userIds: ['u1'],
    }));
    render(
      <ReactionRow
        reactions={reactions}
        currentUserId="user_A"
        isOutgoing={false}
        onToggle={vi.fn()}
      />
    );
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });
});
