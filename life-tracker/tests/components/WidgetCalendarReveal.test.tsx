import { describe, expect, it, vi } from 'vitest';
import { revealWidgetDate } from '../../src/lib/widgetCalendarReveal';

describe('Widgets Today Calendar reveal', () => {
  it("positions today's cell within native vertical and zoomed horizontal scroll containers", async () => {
    const previous = document.documentElement.dataset.reduceMotion;
    document.documentElement.dataset.reduceMotion = 'true';
    try {
      const host = document.createElement('div');
      const viewport = document.createElement('div');
      viewport.dataset.calendarSlideIndex = '30';
      viewport.setAttribute('role', 'region');
      const lane = document.createElement('div');
      lane.dataset.calendarZoomLane = 'true';
      const cell = document.createElement('button');
      cell.dataset.calendarDay = '2026-11-23';
      host.append(viewport);
      viewport.append(lane);
      lane.append(cell);
      Object.defineProperty(viewport, 'clientHeight', { value: 280 });
      Object.defineProperty(lane, 'clientWidth', { value: 220 });
      Object.defineProperty(cell, 'clientHeight', { value: 44 });
      Object.defineProperty(cell, 'clientWidth', { value: 45 });
      vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
        top: 90, left: 0,
      } as DOMRect);
      vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({
        top: 100, left: 30,
      } as DOMRect);
      vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({
        top: 480, left: 530,
      } as DOMRect);
      viewport.scrollTo = vi.fn();
      lane.scrollTo = vi.fn();
      await revealWidgetDate(host, new Date(2026, 10, 23), () => false);
      expect(viewport.scrollTo).toHaveBeenCalledWith(expect.objectContaining({
        top: expect.any(Number), behavior: 'auto',
      }));
      expect(lane.scrollTo).toHaveBeenCalledWith(expect.objectContaining({
        left: expect.any(Number), behavior: 'auto',
      }));
    } finally {
      if (previous === undefined) delete document.documentElement.dataset.reduceMotion;
      else document.documentElement.dataset.reduceMotion = previous;
    }
  });

  it('cancels inactive requests without a DOM mutation', async () => {
    const host = document.createElement('div');
    const scrollTo = vi.fn();
    host.scrollTo = scrollTo;
    await revealWidgetDate(host, new Date(2026, 10, 23), () => true);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
