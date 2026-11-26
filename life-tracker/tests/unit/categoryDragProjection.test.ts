import { describe, expect, it } from 'vitest';
import {
  categoryDragOffsets, categoryDragOrder, nextCategoryDragIndex,
  type CategoryDragGeometry,
} from '../../src/lib/categoryDragProjection';

const rows: CategoryDragGeometry[] = [
  { id: 'a', top: 0, bottom: 100, headerCenter: 20 },
  { id: 'b', top: 100, bottom: 310, headerCenter: 120 },
  { id: 'c', top: 310, bottom: 390, headerCenter: 330 },
  { id: 'd', top: 390, bottom: 720, headerCenter: 410 },
];

describe('transform-only category projection', () => {
  it('projects up/down swaps with variable heights without changing input order', () => {
    expect(categoryDragOrder(rows, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(categoryDragOffsets(rows, 0, 2)).toEqual([290, -100, -100, 0]);
    expect(categoryDragOrder(rows, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(categoryDragOffsets(rows, 3, 1)).toEqual([0, 330, 330, -290]);
    expect(rows.map(row => row.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('uses stable cached headers and bidirectional hysteresis', () => {
    expect(nextCategoryDragIndex(rows, 0, 0, 123)).toBe(0);
    expect(nextCategoryDragIndex(rows, 0, 0, 127)).toBe(1);
    expect(nextCategoryDragIndex(rows, 0, 1, 118)).toBe(1);
    expect(nextCategoryDragIndex(rows, 0, 1, 112)).toBe(0);
    expect(nextCategoryDragIndex(rows, 3, 3, 115)).toBe(2);
    expect(nextCategoryDragIndex(rows, 3, 2, 100)).toBe(1);
    expect(nextCategoryDragIndex(rows, 3, 1, 130)).toBe(2);
  });

  it('handles no-op, bounds, and identical visual order', () => {
    expect(categoryDragOffsets(rows, 2, 2)).toEqual([0, 0, 0, 0]);
    expect(categoryDragOffsets(rows, -1, 3)).toEqual([0, 0, 0, 0]);
    expect(categoryDragOrder(rows, -1, 2)).toEqual(['a', 'b', 'c', 'd']);
    expect(nextCategoryDragIndex(rows, -1, 0, 999)).toBe(0);
  });
});
