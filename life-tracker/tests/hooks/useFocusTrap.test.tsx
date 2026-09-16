import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React, { useRef } from 'react';
import { useFocusTrap } from '../../src/hooks/useFocusTrap';

function Trap({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isActive);
  return (
    <div>
      <button data-testid="outside-before">outside-before</button>
      <div ref={ref} data-testid="trap">
        {children}
      </div>
      <button data-testid="outside-after">outside-after</button>
    </div>
  );
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFocusTrap', () => {
  it('focuses the first focusable descendant on activation', async () => {
    const { getByTestId } = render(
      <Trap isActive>
        <button data-testid="first">first</button>
        <button data-testid="second">second</button>
      </Trap>
    );
    // The focus is deferred one animation frame.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('Tab from the last element wraps to the first', async () => {
    const { getByTestId } = render(
      <Trap isActive>
        <button data-testid="first">first</button>
        <button data-testid="second">second</button>
      </Trap>
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const second = getByTestId('second');
    second.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('Shift+Tab from the first element wraps to the last', async () => {
    const { getByTestId } = render(
      <Trap isActive>
        <button data-testid="first">first</button>
        <button data-testid="second">second</button>
      </Trap>
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const first = getByTestId('first');
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('second'));
  });

  it('does nothing when isActive is false', async () => {
    const { getByTestId } = render(
      <Trap isActive={false}>
        <button data-testid="first">first</button>
      </Trap>
    );
    const before = getByTestId('outside-before');
    before.focus();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(before);
  });

  it('restores focus to the previously-focused element on deactivation', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { rerender } = render(
      <Trap isActive>
        <button data-testid="first">first</button>
      </Trap>
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    rerender(
      <Trap isActive={false}>
        <button data-testid="first">first</button>
      </Trap>
    );
    expect(document.activeElement).toBe(outside);
  });

  it('skips disabled and aria-hidden elements', async () => {
    const { getByTestId } = render(
      <Trap isActive>
        <button data-testid="first" disabled>
          disabled
        </button>
        <button data-testid="hidden" aria-hidden="true">
          hidden
        </button>
        <button data-testid="real">real</button>
      </Trap>
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(getByTestId('real'));
  });
});
