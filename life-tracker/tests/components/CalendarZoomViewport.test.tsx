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
  it('drags with the mouse at finger speed and does not open a date on release', () => {
    const { lane, onNavigate, onTap } = setup(3);
    lane.scrollLeft = 130;
    Object.defineProperty(lane, 'setPointerCapture', { configurable: true, value: vi.fn() });
    const scrollTo = vi.fn();
    Object.defineProperty(lane, 'scrollTo', { configurable: true, value: scrollTo });
    const mouse = (type: string, clientX: number, clientY = 20) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true,
        clientX, clientY, button: 0 });
      Object.defineProperties(event, {
        pointerType: { value: 'mouse' }, pointerId: { value: 1 },
      });
      fireEvent(lane, event);
    };
    mouse('pointerdown', 200);
    mouse('pointermove', 150);
    expect(lane.scrollLeft).toBe(180);
    mouse('pointerup', 150);
    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
    expect(lane.style.scrollSnapType).toBe('none');
    fireEvent(lane, new Event('scrollend'));
    expect(lane.style.scrollSnapType).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(onTap).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    mouse('pointerdown', 200);
    mouse('pointerup', 200);
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(onTap).toHaveBeenCalledTimes(1);

    lane.scrollLeft = 400;
    mouse('pointerdown', 200);
    mouse('pointermove', 90);
    mouse('pointerup', 90);
    expect(onNavigate).toHaveBeenCalledWith('next');
  });

  it('has a snap marker for each legal individual day start in both zoom modes', () => {
    const { lane } = setup(3);
    expect(lane.querySelectorAll('[data-calendar-snap-day]')).toHaveLength(5);
  });

  it('blocks touch, wheel and mouse edge reentry during a period animation', () => {
    const onNavigate = vi.fn();
    const onTap = vi.fn();
    render(
      <CalendarZoomViewport zoomDays={4} navigationLocked
        onNavigate={onNavigate}>
        <button onClick={onTap}>Day</button>
      </CalendarZoomViewport>
    );
    const lane = screen.getByRole('region', { name: 'Scrollable calendar weekdays' });
    fireEvent.touchStart(lane, { touches: [touch(100)] });
    fireEvent.touchEnd(lane, { changedTouches: [touch(10)] });
    fireEvent.wheel(lane, { deltaX: 130, deltaY: 0, deltaMode: 0 });
    fireEvent.pointerDown(lane, { pointerType: 'mouse', clientX: 150, pointerId: 1, button: 0 });
    fireEvent.pointerMove(lane, { pointerType: 'mouse', clientX: 20, pointerId: 1 });
    fireEvent.pointerUp(lane, { pointerType: 'mouse', clientX: 20, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

});
