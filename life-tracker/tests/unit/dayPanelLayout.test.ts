import { describe, expect, it } from 'vitest';
import { clampDayPanelWidth, maxDayPanelWidth, readDayPanelWidth, saveDayPanelWidth,
  DAY_PANEL_MIN_WIDTH, DAY_PANEL_MIN_FRAME_WIDTH } from '../../src/lib/dayPanelLayout';
import { resolveDayDetailPresentation, resolveDayPanelHeight } from '../../src/lib/preferences';

describe('split Day View panel sizing and fallbacks', () => {
  it('protects calendar width and clamps the panel', () => {
    expect(DAY_PANEL_MIN_FRAME_WIDTH).toBe(1040);
    expect(maxDayPanelWidth(1040)).toBe(468);
    expect(clampDayPanelWidth(900, 1040)).toBe(468);
    expect(clampDayPanelWidth(100, 1440)).toBe(DAY_PANEL_MIN_WIDTH);
    expect(clampDayPanelWidth(NaN, 1440)).toBe(400);
  });
  it('rejects unknown settings and preserves the existing bottom-sheet default', () => {
    expect(resolveDayDetailPresentation('invalid')).toBe('sheet');
    expect(resolveDayDetailPresentation('panel')).toBe('panel');
    expect(resolveDayPanelHeight('unknown')).toBe('grid');
    expect(resolveDayPanelHeight('screen')).toBe('screen');
  });
  it('stores bounded widths on this device only', () => {
    const state = new Map<string, string>();
    const storage = { getItem: (key: string) => state.get(key) ?? null,
      setItem: (key: string, value: string) => { state.set(key, value); } };
    expect(readDayPanelWidth(storage)).toBe(400);
    saveDayPanelWidth(900, storage);
    expect(readDayPanelWidth(storage)).toBe(720);
    saveDayPanelWidth(375, storage);
    expect(readDayPanelWidth(storage)).toBe(375);
  });
});
