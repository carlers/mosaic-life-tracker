import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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
//   - Drag-to-close. Framer Motion's onDragEnd fires from synthetic pointer
//     sequences that happy-dom does not reproduce faithfully. A passing test
//     would validate the framer-motion binding, not the sheet's behavior.
//   - Most visual treatment remains internals-coupled. The suspended-sheet
//     interaction state is asserted because stacked modal safety depends on it.
// ---------------------------------------------------------------------------

describe('BottomSheet', () => {
  beforeEach(() => {
    // Defensive reset. RTL's afterEach(cleanup) unmounts every root, which
    // triggers the component's effect cleanup and restores body overflow.
    // This line guards against a future test that forgets to clean up.
    document.body.style.overflow = '';
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

  it('Escape calls onClose of the topmost sheet only', () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    // Two sheets mounted in the same commit. React fires sibling effects
    // in tree order, so A pushes onto the escape stack before B does.
    // The stack is therefore [A, B] and B is the top.
    render(
      <>
        <BottomSheet isOpen onClose={onCloseA}>
          <div data-marker="sheet-a">A</div>
        </BottomSheet>
        <BottomSheet isOpen onClose={onCloseB}>
          <div data-marker="sheet-b">B</div>
        </BottomSheet>
      </>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();
  });

  // Regression: UIFIX-8/UIFIX-9 — stacked sheets suspend underlying interaction.\n  it('can suspend an underlying stacked sheet so it is hidden from accessibility and pointer interaction', () => {
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

  it('adds backdrop blur only when requested', () => {
    const { rerender } = render(
      <BottomSheet isOpen onClose={noop}>
        <div>inner</div>
      </BottomSheet>
    );
    expect(document.body.querySelector('.backdrop-blur-sm')).toBeNull();

    rerender(
      <BottomSheet isOpen onClose={noop} backdropBlur>
        <div>inner</div>
      </BottomSheet>
    );
    expect(document.body.querySelector('.backdrop-blur-sm')).not.toBeNull();
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
