import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarZoomViewport } from '../../src/components/home/views/CalendarZoomViewport';

const setup = (zoomDays: 3 | 4 = 3) => {
  const onNavigate = vi.fn();
  const onTap = vi.fn();
  render(
    <CalendarZoomViewport zoomDays={zoomDays} onNavigate={onNavigate}>
      <button type="button" onClick={onTap}>Day</button>
    </CalendarZoomViewport>
  );
  const lane = screen.getByRole('region', { name: 'Scrollable calendar weekdays' }) as HTMLDivElement;
  Object.defineProperties(lane, {
    clientWidth: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 700 },
  });
  return { lane, onNavigate, onTap };
};
const touch = (x: number, y = 20) => ({ clientX: x, clientY: y });

describe('CalendarZoomViewport boundary interactions', () => {
  it('navigates exactly once on a deliberate extra swipe at each edge', () => {
    const { lane, onNavigate } = setup(3);
    lane.scrollLeft = 0;
    fireEvent.touchStart(lane, { touches: [touch(50)] });
    fireEvent.touchEnd(lane, { changedTouches: [touch(145)] });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenLastCalledWith('prev');
    lane.scrollLeft = 400;
    fireEvent.touchStart(lane, { touches: [touch(145)] });
    fireEvent.touchEnd(lane, { changedTouches: [touch(50)] });
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenLastCalledWith('next');
  });
  it('does not navigate while panning within the week or scrolling vertically', () => {
    const { lane, onNavigate, onTap } = setup(4);
    lane.scrollLeft = 130;
    fireEvent.touchStart(lane, { touches: [touch(160)] });
    fireEvent.touchEnd(lane, { changedTouches: [touch(60)] });
    lane.scrollLeft = 0;
    fireEvent.touchStart(lane, { touches: [touch(60, 20)] });
    fireEvent.touchEnd(lane, { changedTouches: [touch(85, 140)] });
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
  it('does not let one trackpad gesture both pan into the edge and change month', () => {
    const { lane, onNavigate } = setup(3);
    lane.scrollLeft = 120;
    fireEvent.wheel(lane, { deltaX: 95, deltaY: 0, deltaMode: 0 });
    lane.scrollLeft = 400;
    fireEvent.wheel(lane, { deltaX: 95, deltaY: 0, deltaMode: 0 });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
