import { describe, expect, it } from 'vitest';
import { widgetDragIndex, type WidgetSlot } from '../../src/lib/widgetDragProjection';

const slots: WidgetSlot[] = [
  { id: 'today', centerX: 200, centerY: 100 },
  { id: 'diary', centerX: 200, centerY: 360 },
  { id: 'categories', centerX: 100, centerY: 620 },
  { id: 'weekly', centerX: 300, centerY: 620 },
];
describe('widget slot projection', () => {
  it('maps to frozen slots, not live DOM coordinates, across mixed half/full widths', () => {
    expect(widgetDragIndex(slots, 200, 100, 0)).toBe(0);
    expect(widgetDragIndex(slots, 200, 360, 0)).toBe(1);
    expect(widgetDragIndex(slots, 300, 620, 0)).toBe(3);
    expect(widgetDragIndex(slots, 100, 620, 3)).toBe(2);
    expect(widgetDragIndex(slots, 200, -1000, 3)).toBe(0);
  });
  it('does not flip at boundaries without hysteresis and permits deliberate reverse drag', () => {
    expect(widgetDragIndex(slots, 200, 230, 0)).toBe(0);
    expect(widgetDragIndex(slots, 200, 260, 0)).toBe(1);
    expect(widgetDragIndex(slots, 200, 246, 1)).toBe(1);
    expect(widgetDragIndex(slots, 200, 130, 1)).toBe(0);
  });
  it('accounts for scroll moved independently of a fixed overlay', () => {
    expect(widgetDragIndex(slots, 200, 360, 0)).toBe(1);
    expect(widgetDragIndex(slots, 200, 260, 0, 100)).toBe(1);
    expect(widgetDragIndex(slots, 200, 260, 0, 0)).toBe(1);
  });
  it('returns current index for invalid inputs', () => {
    expect(widgetDragIndex([], 0, 0, 2)).toBe(2);
    expect(widgetDragIndex(slots, Number.NaN, 0, 0)).toBe(0);
  });
});
