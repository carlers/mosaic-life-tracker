import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from '../../src/components/ui/ErrorBoundary';
import { installChunkLoadErrorTracking } from '../../src/lib/chunkLoadErrors';

function Bomb({ shouldThrow, error }: { shouldThrow: boolean; error?: Error }) {
  if (shouldThrow) throw error ?? new Error('bomb');
  return <div>safe</div>;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary label="test">
        <div>hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders the fallback when a child throws', () => {
    render(
      <ErrorBoundary label="test">
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('offers an explicit reload when a lazy route chunk fails', () => {
    render(
      <ErrorBoundary label="route" reloadOnChunkError>
        <Bomb
          shouldThrow
          error={new Error('Failed to fetch dynamically imported module')}
        />
      </ErrorBoundary>
    );
    expect(screen.getByText('Reload app')).toBeTruthy();
    expect(screen.getByText(/may discard unfinished form input/)).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('uses the exact error payload from Vite preload events', () => {
    const opaqueError = new Error('opaque browser import failure');
    installChunkLoadErrorTracking();
    const event = new Event('vite:preloadError');
    Object.defineProperty(event, 'payload', { value: opaqueError });
    window.dispatchEvent(event);
    render(
      <ErrorBoundary label="route" reloadOnChunkError>
        <Bomb shouldThrow error={opaqueError} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Reload app')).toBeTruthy();
  });

  it('logs with the [ErrorBoundary:<label>] prefix', () => {
    render(
      <ErrorBoundary label="chat">
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    const messages = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(messages.some((m) => m.includes('[ErrorBoundary:chat]'))).toBe(
      true
    );
  });

  it('recovers when "Try again" is clicked and the child no longer throws', () => {
    const { rerender } = render(
      <ErrorBoundary label="test">
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    // Flip the child to safe, then click Try again.
    rerender(
      <ErrorBoundary label="test">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Try again'));
    expect(screen.getByText('safe')).toBeTruthy();
  });

  it('clears the error when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary label="test" resetKey="/a">
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    rerender(
      <ErrorBoundary label="test" resetKey="/b">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('safe')).toBeTruthy();
  });

  it('renders the Back button only when onBack is provided', () => {
    const { rerender } = render(
      <ErrorBoundary label="test">
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.queryByText('Back to Home')).toBeNull();
    rerender(
      <ErrorBoundary label="test" onBack={() => {}}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Back to Home')).toBeTruthy();
  });

  it('invokes onBack when the Back button is clicked', () => {
    const onBack = vi.fn();
    render(
      <ErrorBoundary label="test" onBack={onBack}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Back to Home'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
