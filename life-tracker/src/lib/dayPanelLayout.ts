/** Panel pixel width is device-local, while presentation/side are account-synced. */
export const DAY_PANEL_WIDTH_STORAGE_KEY = 'mosaic_day_panel_width_v1';
export const DAY_PANEL_MIN_WIDTH = 320;
export const DAY_PANEL_MAX_WIDTH = 720;
export const DAY_PANEL_CALENDAR_MIN_WIDTH = 560;
export const DAY_PANEL_DIVIDER_WIDTH = 12;
export const DAY_PANEL_MIN_FRAME_WIDTH = 1040;
export type DayPanelSide = 'left' | 'right';
export function maxDayPanelWidth(frameWidth: number): number {
  if (!Number.isFinite(frameWidth)) return DAY_PANEL_MIN_WIDTH;
  return Math.max(DAY_PANEL_MIN_WIDTH, Math.min(DAY_PANEL_MAX_WIDTH,
    Math.floor(frameWidth - DAY_PANEL_CALENDAR_MIN_WIDTH - DAY_PANEL_DIVIDER_WIDTH)));
}
export function clampDayPanelWidth(width: number, frameWidth: number): number {
  return Math.max(DAY_PANEL_MIN_WIDTH, Math.min(Math.round(Number.isFinite(width) ? width : 400), maxDayPanelWidth(frameWidth)));
}
export function readDayPanelWidth(storage: Pick<Storage, 'getItem'> | null =
  typeof window === 'undefined' ? null : window.localStorage): number {
  try {
    const value = Number(storage?.getItem(DAY_PANEL_WIDTH_STORAGE_KEY));
    return Number.isFinite(value) && value >= DAY_PANEL_MIN_WIDTH && value <= DAY_PANEL_MAX_WIDTH ? value : 400;
  } catch { return 400; }
}
export function saveDayPanelWidth(width: number, storage: Pick<Storage, 'setItem'> | null =
  typeof window === 'undefined' ? null : window.localStorage): void {
  try { storage?.setItem(DAY_PANEL_WIDTH_STORAGE_KEY,
    String(Math.max(DAY_PANEL_MIN_WIDTH, Math.min(DAY_PANEL_MAX_WIDTH, Math.round(width)))));
  } catch { /* resizing continues without local storage */ }
}
