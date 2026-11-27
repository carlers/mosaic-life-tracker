export const FLOATING_NAV_SETTING_KEY = 'floatingBottomNavigation';

/** Existing accounts and malformed/legacy values retain Classic. */
export function resolveFloatingNavigation(value: unknown): boolean {
  return value === true;
}

export type DockDirection = 'hide' | 'restore';

export function dockTravel(direction: DockDirection, startY: number, y: number): number {
  return (direction === 'hide' ? 1 : -1) * (y - startY);
}

/** Lock one vertical intent; horizontal and opposite gestures remain separate. */
export function dockGestureIntent(direction: DockDirection, dx: number, dy: number): 'pending' | 'owned' | 'rejected' {
  const travel = direction === 'hide' ? dy : -dy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return 'pending';
  return travel >= 9 && travel >= Math.abs(dx) * 1.35 ? 'owned' : 'rejected';
}

export function shouldSettleDock(travel: number, elapsedMs: number): boolean {
  return travel >= 36 || (travel >= 20 && travel / Math.max(1, elapsedMs) >= 0.55);
}
