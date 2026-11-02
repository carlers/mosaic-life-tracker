/** First-run hints are optional, owner-scoped UI state, never auth state. */
export const TOUR_VERSION = 1;
export type TourOutcome = 'skipped' | 'completed';
export function tourKey(ownerId: string, demo = false): string {
  return demo ? 'mosaic_demo_tour_v1' : 'mosaic_tour_v1_' + ownerId;
}
export function readTourOutcome(key: string): TourOutcome | null {
  try {
    const value = localStorage.getItem(key);
    return value === 'skipped' || value === 'completed' ? value : null;
  } catch { return null; }
}
export function recordTourOutcome(key: string, outcome: TourOutcome): void {
  try { localStorage.setItem(key, outcome); } catch { /* optional UI state */ }
}
/** Never treat an absent browser flag as evidence that an existing owner is new. */
export function canOfferFirstRunTour(createdAt: string | undefined, taskCount: number, now = Date.now()): boolean {
  if (taskCount !== 0 || !createdAt) return false;
  const age = now - Date.parse(createdAt);
  return Number.isFinite(age) && age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}
