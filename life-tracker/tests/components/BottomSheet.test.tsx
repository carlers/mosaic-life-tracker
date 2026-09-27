import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { BottomSheet } from '../../src/components/ui/BottomSheet';

const noop = () => {};

// ---------------------------------------------------------------------------
// BottomSheet component tests (Layer 5).
//
// These pin the observable contracts documented in docs/PROJECT_REFERENCE.md §§7 and 13:
//   - Portal to document.body (escapes parent z-index / overflow traps).
//   - AnimatePresence unmounts cleanly when isOpen flips to false.
//   - Escape-stack: only the topmost sheet's onClose fires.
//   - openSheetCount ref-counting: body scroll stays locked until the last
//     sheet unmounts.
//
// Deliberately NOT tested here:
//   - Backdrop dismissal and drag-to-close. Real browser contracts own these
//     pointer/geometry behaviors; happy-dom would only validate bindings.
//   - Most visual treatment remains internals-coupled. The suspended-sheet
//     interaction state is asserted because stacked modal safety depends on it.
// ---------------------------------------------------------------------------

describe('BottomSheet', () => {
  beforeEach(async () => {
    // Let deferred sheet cleanup from the prior RTL root settle before the
    // next case inspects the module-level history stack.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    // Defensive reset. RTL's afterEach(cleanup) unmounts every root, which
    // triggers the component's effect cleanup and restores body overflow.
    // This line guards against a future test that forgets to clean up.
    document.body.style.overflow = '';
    window.history.replaceState({}, '', window.location.href);
    // happy-dom's asynchronous history traversal can bleed popstate events
    // into the next case. Unit tests assert that the controller requests Back;
    // Playwright covers the real browser traversal end-to-end.
    vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    // Unmount before flushing the deferred unregister. Relying on RTL's
    // automatic cleanup ordering lets that zero-delay task bleed into the
    // following case in happy-dom.
    cleanup();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    vi.restoreAllMocks();
  });

  it('portals children into document.body, not the render container', () => {
    const { container } = render(
      <BottomSheet isOpen onClose={noop}>
        <div data-marker="sheet-child">inner</div>
      </BottomSheet>
    );
    // RTL's container is itself appended to document.body. If BottomSheet
    // did NOT portal, the child would be a descendant of container. The
    // null assertion below is the actual portal guarantee.
    expect(container.querySelector('[data-marker="sheet-child"]')).toBeNull();
    expect(
      document.body.querySelector('[data-marker="sheet-child"]')
    ).not.toBeNull();
  });

  it('keeps deferred children mounted during the exit transition', () => {
    const { rerender } = render(
      <BottomSheet isOpen onClose={noop} deferChildrenUntilPaint>
        <div data-marker="sheet-child">inner</div>
      </BottomSheet>
    );

    rerender(
      <BottomSheet isOpen={false} onClose={noop} deferChildrenUntilPaint>
        <div data-marker="sheet-child">inner</div>
      </BottomSheet>
    );

    // happy-dom does not run compositor CSS transitions, so the browser
    // contract owns the eventual transitionend/removal assertion. This test
    // pins the important React contract: exit starts with children still mounted.
    expect(document.body.querySelector('[data-marker="sheet-child"]')).not.toBeNull();
  });

  it('preserves dialog semantics on the draggable sheet surface', () => {
    render(
      <BottomSheet isOpen onClose={noop} ariaLabel="Day view">
        Inner
      </BottomSheet>
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Day view');
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <BottomSheet isOpen={false} onClose={noop}>
        <div data-marker="sheet-child">inner</div>
      </BottomSheet>
    );
    expect(
      document.body.querySelector('[data-marker="sheet-child"]')
    ).toBeNull();
    // The scroll-lock effect early-returns when isOpen is false; overflow
    // must not have been touched.
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  // Regression: §7 (locked sheets cannot be dismissed while destructive work is in flight).
  it('a locked top sheet ignores Escape dismissal', () => {
    const onClose = vi.fn();
    const historyBack = vi.mocked(window.history.back);

    render(
      <BottomSheet isOpen isLocked onClose={onClose}>
        Processing
      </BottomSheet>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(historyBack).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape requests Back for the topmost sheet history slot', () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    const historyBack = vi.mocked(window.history.back);

    render(
      <>
        <BottomSheet isOpen onClose={onCloseA}>A</BottomSheet>
        <BottomSheet isOpen onClose={onCloseB}>B</BottomSheet>
      </>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();
    expect(onCloseB).not.toHaveBeenCalled();
  });

  // Regression: §7 (nested sheets reserve modal browser-history layers).
  it('reserves one same-route history entry for every open sheet layer', () => {
    const baselineLength = window.history.length;

    render(
      <>
        <BottomSheet isOpen onClose={noop}>A</BottomSheet>
        <BottomSheet isOpen onClose={noop}>B</BottomSheet>
        <BottomSheet isOpen onClose={noop}>C</BottomSheet>
      </>
    );

    expect(window.history.length).toBe(baselineLength + 3);
  });

  it('does not allocate another history slot when an onClose callback rerenders', () => {
    const baselineLength = window.history.length;
    const { rerender } = render(
      <BottomSheet isOpen onClose={() => undefined}>A</BottomSheet>
    );
    expect(window.history.length).toBe(baselineLength + 1);

    rerender(
      <BottomSheet isOpen onClose={() => undefined}>A updated</BottomSheet>
    );
    expect(window.history.length).toBe(baselineLength + 1);
  });

  it('can suspend an underlying stacked sheet so it is hidden from accessibility and pointer interaction', () => {
    render(
      <BottomSheet isOpen onClose={noop} suspendInteraction>
        <button type="button">Underlying action</button>
      </BottomSheet>
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
  });

  it('locks body scroll while open and restores on unmount', () => {
    const { unmount } = render(
      <BottomSheet isOpen onClose={noop}>
        <div>inner</div>
      </BottomSheet>
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    // The component sets `'unset'` (not `''`) when openSheetCount reaches 0.
    expect(document.body.style.overflow).toBe('unset');
  });

  it('keeps the body locked until the last stacked sheet unmounts', () => {
    // Two separate render roots, so they can be unmounted independently.
    // The openSheetCount counter is module-level and shared across roots,
    // which is the behavior this test pins.
    const a = render(
      <BottomSheet isOpen onClose={noop}>
        <div data-marker="sheet-a">A</div>
      </BottomSheet>
    );
    const b = render(
      <BottomSheet isOpen onClose={noop}>
        <div data-marker="sheet-b">B</div>
      </BottomSheet>
    );
    expect(document.body.style.overflow).toBe('hidden');
    a.unmount();
    // Counter is still 1 (B remains open). Body must stay locked.
    expect(document.body.style.overflow).toBe('hidden');
    b.unmount();
    // Counter hits 0. Body releases.
    expect(document.body.style.overflow).toBe('unset');
  });
});
