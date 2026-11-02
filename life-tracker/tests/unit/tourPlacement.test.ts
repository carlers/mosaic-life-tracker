import { describe, expect, it } from 'vitest';
import { positionTourGuide } from '../../src/components/onboarding/tourPlacement';

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, right: left + width, bottom: top + height, width, height,
});

describe('tour guide safe placement', () => {
  const card = { width: 320, height: 215 };
  it('avoids covering upper controls on narrow screens by placing below', () => {
    const target = rect(270, 24, 36, 36);
    const guide = positionTourGuide(target, card, { width: 360, height: 740 });
    expect(guide.side).toBe('bottom');
    expect(guide.top).toBeGreaterThan(target.bottom);
    expect(guide.left).toBeGreaterThanOrEqual(12);
  });
  it('moves above controls near the bottom of a phone', () => {
    const target = rect(24, 670, 50, 42);
    const guide = positionTourGuide(target, card, { width: 360, height: 740 });
    expect(guide.side).toBe('top');
    expect(guide.top + card.height).toBeLessThan(target.top);
  });
  it('moves beside targets when desktop space permits', () => {
    const target = rect(120, 140, 38, 38);
    const guide = positionTourGuide(target, card, { width: 1200, height: 750 });
    expect(guide.side).toBe('right');
    expect(guide.left).toBeGreaterThan(target.right);
  });
  it('keeps the guide reachable for unavailable targets and small viewports', () => {
    const small = positionTourGuide(null, card, { width: 320, height: 360 });
    expect(small.left).toBeGreaterThanOrEqual(12);
    expect(small.top).toBeGreaterThanOrEqual(12);
    expect(small.top).toBeLessThanOrEqual(360 - card.height - 12);
  });
});
