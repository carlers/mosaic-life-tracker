import type { WidgetId } from './widgetLayout';

/** Snapshot a finite set of stable insertion slots at drag activation.
 * Live animated widget rectangles must never participate in collision detection. */
export interface WidgetSlot {
  id: WidgetId;
  centerX: number;
  centerY: number;
}
export function widgetDragIndex(
  slots: readonly WidgetSlot[], centerX: number, centerY: number,
  currentIndex: number, scrollDeltaY = 0, hysteresisPx = 22
): number {
  if (!slots.length || !Number.isFinite(centerX) || !Number.isFinite(centerY)) {
    return currentIndex;
  }
  const distance = (slot: WidgetSlot) =>
    Math.hypot((centerX - slot.centerX) * 0.85, centerY - (slot.centerY - scrollDeltaY));
  const from = slots[currentIndex];
  if (!from) return currentIndex;
  const currentDistance = distance(from);
  let candidate = currentIndex;
  let closestDistance = currentDistance;
  slots.forEach((slot, index) => {
    const d = distance(slot);
    if (d < closestDistance) {
      candidate = index;
      closestDistance = d;
    }
  });
  // Stable, symmetric deadband. Holding the pointer stationary cannot reflow
  // widgets repeatedly even while their DOM coordinates animate.
  return candidate !== currentIndex && closestDistance + hysteresisPx < currentDistance
    ? candidate : currentIndex;
}
