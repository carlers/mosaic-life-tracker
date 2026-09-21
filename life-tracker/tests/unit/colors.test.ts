import { describe, expect, it } from 'vitest';
import {
  getAllAvailableColors,
  getCategoryLabelColor,
  getContrastRatio,
  getReadableTextColor,
} from '../../src/constants/colors';

describe('accessible category colors', () => {
  // Regression: Phase 4 WCAG AA audit — normal text requires 4.5:1 contrast.
  it('keeps every predefined category label readable on the black pill', () => {
    for (const color of getAllAvailableColors()) {
      expect(
        getContrastRatio(getCategoryLabelColor(color), '#000000')
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('selects readable task text for every predefined category color', () => {
    for (const color of getAllAvailableColors()) {
      expect(
        getContrastRatio(getReadableTextColor(color), color)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
