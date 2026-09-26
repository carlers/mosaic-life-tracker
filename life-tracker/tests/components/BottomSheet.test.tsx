import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { AppearanceContext } from '../../src/hooks/appearanceContext';

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
//   - Drag-to-close. Framer Motion's onDragEnd fires from synthetic pointer
//     sequences that happy-dom does not reproduce faithfully. A passing test
//     would validate the framer-motion binding, not the sheet's behavior.
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

  // Regression: sheet exit must keep expensive children mounted until the
  // transform animation completes, so React teardown cannot compete with the
  // close animation's compositor work.
  it('keeps deferred children mounted during the exit animation', async () => {
    const { rerender } = render(
      <BottomSheet isOpen onClose={noop} deferChildrenUntilPaint>
        <div data-marker="sheet-child">inner</div>
      </BottomSheet>
    );

    expect(document.body.querySelector('[data-marker="sheet-child"]')).not.toBeNull();

    rerender(
      <BottomSheet isOpen={false} onClose={noop} deferChildrenUntilPaint>
        <div data-marker="sheet-child">inner</div>
      </BottomSheet>
    );

    // AnimatePresence owns the exit window; the child must remain available to
    // the exiting sheet instead of being synchronously torn down.
    expect(document.body.querySelector('[data-marker="sheet-child"]')).not.toBeNull();

    await waitFor(() => {
      expect(document.body.querySelector('[data-marker="sheet-child"]')).toBeNull();
    }, { timeout: 1000 });
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

  // Regression: PROJECT_REFERENCE.md §2 — exposed backdrop is a dismissal target.
  it('tapping the backdrop requests closing the topmost sheet', () => {
    render(
      <BottomSheet isOpen onClose={noop}>
        Inner
      </BottomSheet>
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    const backdrop = dialog?.previousElementSibling;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);

    expect(window.history.back).toHaveBeenCalledTimes(1);
  });

  // Regression: PROJECT_REFERENCE.md §2 — phones leave backdrop space; tablets can use full height.
  it('uses responsive full-sheet height instead of covering the entire phone viewport', () => {
    render(
      <BottomSheet isOpen onClose={noop} height="full">
        Inner
      </BottomSheet>
    );

    expect(document.body.querySelector('[role="dialog"]')).toHaveClass(
      'h-[92dvh]',
      'md:h-[100dvh]'
    );
  });

  // Regression: task acceptance — Compact sheets remain phone-width on phones but
  // become a centered, slightly-wider-than-phone surface on tablet/desktop.
  it('centers compact sheets at a 540px maximum on larger screens', () => {
    render(
      <AppearanceContext.Provider
        value={{
          mode: 'system',
          resolvedTheme: 'dark',
          setAppearanceMode: vi.fn().mockResolvedValue(undefined),
          contentWidthMode: 'full',
          sheetWidthMode: 'compact',
          setContentWidthMode: vi.fn().mockResolvedValue(undefined),
          setSheetWidthMode: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <BottomSheet isOpen onClose={noop}>
          Inner
        </BottomSheet>
      </AppearanceContext.Provider>
    );

    expect(document.body.querySelector('[role="dialog"]')).toHaveClass(
      'md:left-1/2',
      'md:right-auto',
      'md:w-[min(540px,calc(100vw-2rem))]',
      'md:[translate:-50%_0]'
    );
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

  // Regression: native Android/Samsung Back needs one browser-history slot per
  // open sheet so nested Back presses cannot fall through to route/app history.
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

  // Regression: UIFIX-8/UIFIX-9 — stacked sheets suspend underlying interaction.
  it('can suspend an underlying stacked sheet so it is hidden from accessibility and pointer interaction', () => {
    render(
      <BottomSheet isOpen onClose={noop} suspendInteraction>
        <button type="button">Underlying action</button>
      </BottomSheet>
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
    expect(dialog).toHaveClass('pointer-events-none', 'select-none');
    expect(dialog?.previousElementSibling).toHaveClass('pointer-events-none');
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
