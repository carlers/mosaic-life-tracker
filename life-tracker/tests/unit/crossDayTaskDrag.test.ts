import { describe, expect, it } from 'vitest';
import {
  adjacentCalendarDate, clampTaskInsertIndex, dragEdgeDirection,
} from '../../src/components/home/views/crossDayTaskDrag';

describe('continuous Day View drag navigation boundaries', () => {
  const viewport = { left: 100, right: 460, top: 60, bottom: 740, width: 360 };

  it('only triggers when vertically aligned with Day View, including beyond its horizontal edges', () => {
    expect(dragEdgeDirection(110, 300, viewport)).toBe(-1);
    expect(dragEdgeDirection(445, 300, viewport)).toBe(1);
    expect(dragEdgeDirection(270, 300, viewport)).toBe(0);
    expect(dragEdgeDirection(8, 300, viewport)).toBe(-1);
    expect(dragEdgeDirection(850, 300, viewport)).toBe(1);
    expect(dragEdgeDirection(-40, 300, viewport)).toBe(-1);
    expect(dragEdgeDirection(850, 30, viewport)).toBe(0);
    expect(dragEdgeDirection(-40, 750, viewport)).toBe(0);
    expect(dragEdgeDirection(450, 800, viewport)).toBe(0);
    expect(dragEdgeDirection(Number.NaN, 300, viewport)).toBe(0);
  });

  it('never makes overlapping edge zones on a narrow Day View', () => {
    const narrow = { ...viewport, left: 10, right: 80, width: 70 };
    expect(dragEdgeDirection(15, 400, narrow)).toBe(-1);
    expect(dragEdgeDirection(70, 400, narrow)).toBe(1);
    expect(dragEdgeDirection(45, 400, narrow)).toBe(0);
  });

  it('advances calendar dates across month, leap-year and year boundaries', () => {
    expect(adjacentCalendarDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(adjacentCalendarDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(adjacentCalendarDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(adjacentCalendarDate('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('clamps position for empty, smaller and stale destination lists', () => {
    expect(clampTaskInsertIndex(20, 0)).toBe(0);
    expect(clampTaskInsertIndex(-3, 5)).toBe(0);
    expect(clampTaskInsertIndex(12, 5)).toBe(5);
    expect(clampTaskInsertIndex(2.9, 5)).toBe(2);
    expect(clampTaskInsertIndex(Infinity, 2)).toBe(2);
  });
});
