import { describe, expect, it } from 'vitest';
import { reviewPinchIntent, reviewTouchDistance } from '../../src/lib/dailyReviewPinch';

describe('Daily Review pinch decisions', () => {
  it('distinguishes two-finger pinch from other gestures', () => {
    expect(reviewTouchDistance([{clientX:0,clientY:0},{clientX:90,clientY:120}])).toBe(150);
    expect(reviewTouchDistance([{clientX:0,clientY:0}])).toBe(0);
    expect(reviewPinchIntent(200, 130, false)).toBe('overview');
    expect(reviewPinchIntent(100, 150, true)).toBe('focus');
    expect(reviewPinchIntent(200, 195, false)).toBeNull();
    expect(reviewPinchIntent(200, 150, true)).toBeNull();
    expect(reviewPinchIntent(10, 1, false)).toBeNull();
    expect(reviewPinchIntent(Number.NaN, 50, false)).toBeNull();
  });
});
