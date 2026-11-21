import React from 'react';
import type { DiaryGroupDragSnapshot } from './diaryGroupDragSnapshot';

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
