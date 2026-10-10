import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouteViewportTransition } from '../../src/components/layout/RouteViewportTransition';

describe('chat route viewport handoff', () => {
  it('retains the outgoing scrolling shell when a fixed chat route enters', () => {
    const { rerender } = render(
      <RouteViewportTransition pathname="/messages" direction="none">
        <div data-testid="messages-screen">Messages</div>
      </RouteViewportTransition>
    );
    const initial = screen.getByTestId('messages-screen').closest('[data-viewport-mode]');
    expect(initial).toHaveAttribute('data-viewport-mode', 'standard');

    rerender(
      <RouteViewportTransition pathname="/messages/friend_1" direction="forward">
        <div data-testid="chat-screen">Chat</div>
      </RouteViewportTransition>
    );

    const panels = screen.getAllByTestId('route-viewport-panel');
    expect(panels).toHaveLength(2);
    expect(within(panels[0]).getByTestId('messages-screen')).toBeInTheDocument();
    expect(panels[0]).toHaveAttribute('data-viewport-mode', 'standard');
    expect(panels[0]).toHaveAttribute('aria-hidden', 'true');
    expect(panels[0]).toHaveAttribute('inert');
    expect(within(panels[1]).getByTestId('chat-screen')).toBeInTheDocument();
    expect(panels[1]).toHaveAttribute('data-viewport-mode', 'chat');
    expect(panels[1]).not.toHaveAttribute('aria-hidden');
  });

  it('preserves the same ordinary-page shell between main tabs', () => {
    const { rerender } = render(
      <RouteViewportTransition pathname="/messages" direction="none">
        <div>Messages</div>
      </RouteViewportTransition>
    );
    const shell = screen.getByTestId('route-viewport-panel');
    rerender(
      <RouteViewportTransition pathname="/explore" direction="backward">
        <div>Explore</div>
      </RouteViewportTransition>
    );
    expect(screen.getByTestId('route-viewport-panel')).toBe(shell);
    expect(screen.getByText('Explore')).toBeInTheDocument();
  });
});
