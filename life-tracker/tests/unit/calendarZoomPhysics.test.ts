import { describe, expect, it } from 'vitest';
import {
  edgeSwipeDirection, nearestZoomSnap, zoomSnapColumns,
} from '../../src/lib/calendarZoomPhysics';

describe('mobile Calendar zoom gestures', () => {
  it('snaps at each individual weekday without empty trailing days', () => {
    expect(zoomSnapColumns(3)).toEqual([0, 1, 2, 3, 4]);
    expect(zoomSnapColumns(4)).toEqual([0, 1, 2, 3]);
    expect(nearestZoomSnap(2.7, 3)).toBe(3);
    expect(nearestZoomSnap(1.3, 3)).toBe(1);
    expect(nearestZoomSnap(1.6, 3)).toBe(2);
    expect(nearestZoomSnap(3.8, 3)).toBe(4);
    expect(nearestZoomSnap(2.6, 4)).toBe(3);
    expect(nearestZoomSnap(2.1, 4)).toBe(2);
    expect(nearestZoomSnap(0.4, 4)).toBe(0);
  });
  it('changes month only on an intentional outward edge swipe', () => {
    expect(edgeSwipeDirection('right', -80, 3)).toBe('next');
    expect(edgeSwipeDirection('left', 80, 3)).toBe('prev');
    expect(edgeSwipeDirection('right', 80, 0)).toBeNull();
    expect(edgeSwipeDirection('left', -80, 0)).toBeNull();
    expect(edgeSwipeDirection(null, -100, 0)).toBeNull();
    expect(edgeSwipeDirection('right', -50, 0)).toBeNull();
    expect(edgeSwipeDirection('right', -90, 110)).toBeNull();
  });
});
