import { useEffect, useState } from 'react';

const DEFAULT_KEYBOARD_INSET = 0;
const ZOOM_SCALE_THRESHOLD = 1.01;

function getKeyboardInset(): number {
  if (typeof window === 'undefined') return DEFAULT_KEYBOARD_INSET;

  const viewport = window.visualViewport;
  if (!viewport) return DEFAULT_KEYBOARD_INSET;

  // Fixed-position elements attach to the layout viewport while the OSK
  // normally shrinks only the visual viewport. Account for iOS Safari moving
  // the visual viewport vertically while it reveals the focused field.
  if (viewport.scale > ZOOM_SCALE_THRESHOLD) return DEFAULT_KEYBOARD_INSET;

  const layoutHeight = document.documentElement.clientHeight;
  return Math.max(
    0,
    Math.round(layoutHeight - viewport.height - viewport.offsetTop)
  );
}

export function useKeyboardInset(): number {
  const [keyboardInset, setKeyboardInset] = useState(getKeyboardInset);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setKeyboardInset(getKeyboardInset());
      });
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return keyboardInset;
}
