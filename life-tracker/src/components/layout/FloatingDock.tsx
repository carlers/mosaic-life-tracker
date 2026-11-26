import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dockGestureIntent, dockTravel, shouldSettleDock, type DockDirection } from '../../lib/floatingNavigation';
import './FloatingDock.css';

type Drag = { id: number; x: number; y: number; started: number; direction: DockDirection; owned: boolean };
const EDITOR = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, [contenteditable="true"], [role="textbox"]';

export default function FloatingDock({ children, hidden: controlledHidden, onHiddenChange }: {
  children: React.ReactNode;
  hidden?: boolean;
  onHiddenChange?: (hidden: boolean) => void;
}) {
  const [localHidden, setLocalHidden] = useState(false);
  const hidden = controlledHidden ?? localHidden;
  const [keyboard, setKeyboard] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const show = useRef<HTMLButtonElement>(null);
  const hide = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(0);
  const focusAfter = useRef(false);

  const clearDrag = React.useCallback(() => {
    drag.current = null;
    dock.current?.style.removeProperty('--mosaic-dock-drag');
    dock.current?.removeAttribute('data-dragging');
  }, []);

  useEffect(() => {
    const visual = window.visualViewport;
    let width = window.innerWidth;
    let resting = visual?.height ?? window.innerHeight;
    const measure = () => {
      const height = visual?.height ?? window.innerHeight;
      if (width !== window.innerWidth) { width = window.innerWidth; resting = height; }
      const editable = document.activeElement instanceof HTMLElement && document.activeElement.matches(EDITOR);
      if (!editable) resting = Math.max(resting, height);
      const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      setKeyboard(Boolean(touch && editable && Math.abs((visual?.scale ?? 1) - 1) < 0.01 && resting - height > 120));
    };
    const resize = () => { clearDrag(); measure(); };
    const cancel = () => clearDrag();
    visual?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    document.addEventListener('focusin', measure);
    document.addEventListener('focusout', measure);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      visual?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
      document.removeEventListener('focusin', measure);
      document.removeEventListener('focusout', measure);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [clearDrag]);

  useLayoutEffect(() => {
    if (!focusAfter.current || keyboard) return;
    focusAfter.current = false;
    (hidden ? show.current : hide.current)?.focus({ preventScroll: true });
  }, [hidden, keyboard]);

  function changeVisibility(next: boolean) {
    focusAfter.current = Boolean(nav.current?.contains(document.activeElement));
    if (onHiddenChange) onHiddenChange(next);
    else setLocalHidden(next);
  }

  function start(event: React.PointerEvent<HTMLElement>) {
    if (drag.current) { clearDrag(); suppressClick.current = performance.now() + 500; return; }
    if (keyboard || event.button !== 0 || event.isPrimary === false) return;
    suppressClick.current = 0;
    drag.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(),
      direction: hidden ? 'restore' : 'hide', owned: false,
    };
  }

  function move(event: React.PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.owned) {
      const intent = dockGestureIntent(current.direction, dx, dy);
      if (intent === 'rejected') { clearDrag(); return; }
      if (intent !== 'owned') return;
      current.owned = true;
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* detached */ }
      dock.current?.setAttribute('data-dragging', 'true');
    }
    event.preventDefault();
    event.stopPropagation();
    const travel = Math.min(140, Math.max(0, dockTravel(current.direction, current.y, event.clientY)));
    dock.current?.style.setProperty('--mosaic-dock-drag', (current.direction === 'hide' ? travel : -travel) + 'px');
  }

  function finish(event: React.PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const travel = dockTravel(current.direction, current.y, event.clientY);
    if (current.owned) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = performance.now() + 500;
      if (shouldSettleDock(travel, performance.now() - current.started)) changeVisibility(current.direction === 'hide');
    }
    clearDrag();
  }

  return (
    <nav ref={nav} aria-label="Main" aria-hidden={keyboard || undefined} className="mosaic-floating-navigation"
      data-mosaic-floating-nav="true" data-mosaic-nav-hidden={hidden ? 'true' : 'false'}
      data-mosaic-nav-keyboard={keyboard ? 'true' : 'false'}
      onPointerDownCapture={start} onPointerMoveCapture={move} onPointerUpCapture={finish}
      onPointerCancelCapture={clearDrag} onLostPointerCapture={e => { if (e.target === e.currentTarget) clearDrag(); }}
      onClickCapture={e => {
        if (e.detail !== 0 && performance.now() < suppressClick.current) {
          e.preventDefault(); e.stopPropagation(); suppressClick.current = 0;
        }
      }}
      onTouchEndCapture={e => {
        if (drag.current?.owned || performance.now() < suppressClick.current) e.stopPropagation();
      }}>
      <div ref={dock} className="mosaic-navigation-bar mosaic-floating-dock" inert={hidden || keyboard}
        aria-hidden={hidden || keyboard ? true : undefined}>
        <button ref={hide} type="button" className="mosaic-floating-hide" aria-label="Hide navigation"
          onClick={() => changeVisibility(true)}><span aria-hidden="true" /></button>
        <div className="relative flex items-center justify-around h-[3.75rem]">{children}</div>
      </div>
      <button ref={show} type="button" className="mosaic-floating-restore" aria-label="Show navigation"
        hidden={!hidden || keyboard} onClick={() => changeVisibility(false)}><span aria-hidden="true" /></button>
    </nav>
  );
}
