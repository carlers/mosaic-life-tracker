import { describe, expect, it } from 'vitest';
import { withinDiaryGroupBoundary, type DiaryDragRect } from '../../src/lib/diaryDropGeometry';

const original: DiaryDragRect = { left: 120, right: 460, top: 100, bottom: 320 };

describe('Diary group/container drag hit stability', () => {
  it('does not flip inside/outside during stationary holds at the lower edge', () => {
    let inside = true; // note picked up inside grouped Diary
    for (let step = 0; step < 120; step++) {
      // Actual group may shrink by a full note height, but the logical
      // original boundary stays fixed across in/out-of-flow render commits.
      inside = withinDiaryGroupBoundary(original, 220, 323, inside);
      expect(inside).toBe(true);
    }
    inside = withinDiaryGroupBoundary(original, 220, 340, inside);
    expect(inside).toBe(false);
    for (let step = 0; step < 120; step++) {
      inside = withinDiaryGroupBoundary(original, 220, 316, inside);
      expect(inside).toBe(false);
    }
    inside = withinDiaryGroupBoundary(original, 220, 300, inside);
    expect(inside).toBe(true);
  });

  it('applies the same hysteresis above the container and when entering from a category', () => {
    expect(withinDiaryGroupBoundary(original, 200, 90, true)).toBe(true);
    expect(withinDiaryGroupBoundary(original, 200, 85, true)).toBe(false);
    expect(withinDiaryGroupBoundary(original, 200, 104, false)).toBe(false);
    expect(withinDiaryGroupBoundary(original, 200, 116, false)).toBe(true);
    expect(withinDiaryGroupBoundary(original, 200, 318, false)).toBe(false);
    expect(withinDiaryGroupBoundary(original, 200, 300, false)).toBe(true);
  });

  it('does not accept a missing group or an out-of-band horizontal pointer', () => {
    expect(withinDiaryGroupBoundary(null, 200, 180, true)).toBe(false);
    expect(withinDiaryGroupBoundary(original, 70, 180, true)).toBe(false);
    expect(withinDiaryGroupBoundary(original, 480, 180, false)).toBe(false);
  });

  it('follows scroll delta applied to the pointer baseline, not live resized group rect', () => {
    // The group was at y=100..320 when lifted. The scroll container moved
    // down by 80px; a new pointer y=230 maps to original baseline y=310.
    expect(withinDiaryGroupBoundary(original, 200, 230 + 80, true)).toBe(true);
    expect(withinDiaryGroupBoundary(original, 200, 260 + 80, true)).toBe(false);
  });
});
