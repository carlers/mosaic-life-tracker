// Regression: §24.15 (handled error boundaries report privacy-minimal diagnostics).
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthogRef = vi.hoisted(() => ({
  captureHandledException: vi.fn(),
}));

vi.mock('../../src/lib/posthog', () => posthogRef);

import { RouteErrorBoundary } from '../../src/components/layout/RouteErrorBoundary';

function Bomb() {
  throw new Error('boundary failure');
}

describe('PostHog error boundary integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    posthogRef.captureHandledException.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves route fallback behavior while capturing the route label', () => {
    render(
      <MemoryRouter initialEntries={['/messages/friend_1']}>
        <RouteErrorBoundary label="ChatPage">
          <Bomb />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Back to Home')).toBeTruthy();
    expect(posthogRef.captureHandledException).toHaveBeenCalledTimes(1);
    expect(posthogRef.captureHandledException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ boundary: 'ChatPage' })
    );
  });
});
