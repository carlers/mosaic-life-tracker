import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PersonCarousel } from '../../src/components/home/PersonCarousel';

vi.mock('../../src/components/ui/DeferredAvatar', () => ({
  DeferredAvatar: ({ alt }: { alt: string }) => <span aria-hidden="true">{alt}</span>,
}));
const people = [
  { id: 'me', kind: 'me' as const, userId: 'user_1', username: 'me', displayName: 'Me', avatarFileId: '', bio: '' },
  { id: 'friend1', kind: 'friend' as const, userId: 'user_2', username: 'friend1', displayName: 'Friend One', avatarFileId: '', bio: '' },
  { id: 'friend2', kind: 'friend' as const, userId: 'user_3', username: 'friend2', displayName: 'Friend Two', avatarFileId: '', bio: '' },
];

describe('Home friend carousel keyboard focus', () => {
  it('moves focus with arrows and activates a friend only after Enter/Space click', () => {
    const onSelect = vi.fn();
    const { container } = render(<PersonCarousel persons={people} activePersonId="me"
      onSelect={onSelect} onOpenSettings={vi.fn()} />);
    const me = container.querySelector<HTMLButtonElement>('[data-person-pill="me"]')!;
    const friend = container.querySelector<HTMLButtonElement>('[data-person-pill="friend1"]')!;
    const other = container.querySelector<HTMLButtonElement>('[data-person-pill="friend2"]')!;
    expect(me.tabIndex).toBe(0);
    expect(friend.tabIndex).toBe(-1);
    expect(me).toHaveAttribute('aria-pressed', 'true');
    me.focus();
    fireEvent.keyDown(me, { key: 'ArrowRight' });
    expect(friend).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(friend, { key: 'End' });
    expect(other).toHaveFocus();
    fireEvent.keyDown(other, { key: 'Home' });
    expect(me).toHaveFocus();
    fireEvent.keyDown(me, { key: 'ArrowRight' });
    fireEvent.click(friend);
    expect(onSelect).toHaveBeenCalledWith('friend1');
  });

  it('preserves modified arrows and friend preferences as separate controls', () => {
    const onSettings = vi.fn();
    const onSelect = vi.fn();
    render(<PersonCarousel persons={people} activePersonId="me"
      onSelect={onSelect} onOpenSettings={onSettings} />);
    const me = document.querySelector<HTMLButtonElement>('[data-person-pill="me"]')!;
    me.focus();
    fireEvent.keyDown(me, { key: 'ArrowRight', ctrlKey: true });
    expect(me).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Friend preferences' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
