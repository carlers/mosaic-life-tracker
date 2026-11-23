/** Inert drag snapshot of the already rendered, owner-scoped diary card.
 * Multi-entry groups carry only their count header; the full live group stays
 * mounted and expands again after release. No extra data hooks or editors. */
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
  const margin = (Number.parseFloat(computed.marginTop) || 0) +
    (Number.parseFloat(computed.marginBottom) || 0);

  const group = visual.querySelector<HTMLElement>('[data-diary-drag-group]');
  const heading = group?.querySelector<HTMLElement>('[data-diary-drag-heading]');
  // Shallow clone the styled group shell, plus just its draggable header.
  // Cloning the complete group caused an oversized overlay and insertion gap.
  const compact = Boolean(group && heading);
  const node = compact
    ? group!.cloneNode(false) as HTMLElement
    : visual.cloneNode(true) as HTMLElement;
  if (heading) node.appendChild(heading.cloneNode(true));
  node.removeAttribute('data-diary-drag-visual');
  node.removeAttribute('data-diary-drag-group');
  // A clone must not register a second drag source or expose duplicate IDs.
  node.querySelectorAll('[data-diary-dnd-source]').forEach(element => element.remove());
  for (const element of [node, ...Array.from(node.querySelectorAll<HTMLElement>('[id], [data-testid]'))]) {
    element.removeAttribute('id');
    element.removeAttribute('data-testid');
  }
  node.setAttribute('aria-hidden', 'true');
  node.inert = true;
  node.style.pointerEvents = 'none';
  node.style.userSelect = 'none';

  const padding = group ? window.getComputedStyle(group) : null;
  const headerHeight = heading
    ? Math.max(24, heading.getBoundingClientRect().height) +
      (Number.parseFloat(padding?.paddingTop || '') || 0) +
      (Number.parseFloat(padding?.paddingBottom || '') || 0)
    : bounds.height;
  return {
    node,
    width: Math.max(1, bounds.width),
    height: Math.max(24, headerHeight + margin),
  };
}
