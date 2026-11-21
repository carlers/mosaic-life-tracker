import React from 'react';

/** Static snapshot of the owner's already-rendered diary-day card. No diary
 * settings, sync hooks, editors or live controls are mounted in the overlay. */
export interface DiaryGroupDragSnapshot {
  node: HTMLElement;
  width: number;
  height: number;
}

export function captureDiaryGroupDragSnapshot(source: Element | null): DiaryGroupDragSnapshot | null {
  const visual = source?.closest('[data-diary-drag-source]')
    ?.querySelector<HTMLElement>('[data-diary-drag-visual]');
  if (!visual) return null;
  const bounds = visual.getBoundingClientRect();
  const computed = window.getComputedStyle(visual);
  // Margin is outside getBoundingClientRect but consumes a real list slot.
  const margin = (Number.parseFloat(computed.marginTop) || 0) +
    (Number.parseFloat(computed.marginBottom) || 0);
  const node = visual.cloneNode(true) as HTMLElement;
  node.removeAttribute('data-diary-drag-visual');
  // A DOM snapshot must not duplicate accessible/control IDs or test IDs.
  for (const element of [node, ...Array.from(node.querySelectorAll<HTMLElement>('[id], [data-testid]'))]) {
    element.removeAttribute('id');
    element.removeAttribute('data-testid');
  }
  node.setAttribute('aria-hidden', 'true');
  node.inert = true;
  node.style.pointerEvents = 'none';
  node.style.userSelect = 'none';
  return {
    node,
    width: Math.max(1, bounds.width),
    height: Math.max(24, bounds.height + margin),
  };
}

/** dnd-kit's DragOverlay owns pointer translation. We attach the clone once;
 * React must not rerender an entire diary group on every collision update. */
export const DiaryGroupDragVisual = React.memo(({ snapshot }: {
  snapshot: DiaryGroupDragSnapshot;
}) => {
  const hostRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.appendChild(snapshot.node);
    return () => {
      if (host.contains(snapshot.node)) host.removeChild(snapshot.node);
    };
  }, [snapshot]);
  return <div ref={hostRef} data-diary-drag-overlay="true"
    aria-hidden="true" inert
    style={{ width: snapshot.width, pointerEvents: 'none', contain: 'layout paint' }} />;
});
