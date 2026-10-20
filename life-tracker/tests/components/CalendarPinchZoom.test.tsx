import React, { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarZoomDays } from '../../src/lib/preferences';
import { calendarPinchMorphFrame, nextCalendarPinchMode, playCalendarPinchMorph, useCalendarPinchZoom } from '../../src/components/home/views/useCalendarPinchZoom';

interface Props {
  enabled?: boolean;
  zoomDays?: CalendarZoomDays;
  locked?: boolean;
  onChange: (days: CalendarZoomDays, centerFraction: number) => void;
}
function Fixture({ enabled = true, zoomDays = 7, locked = false, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useCalendarPinchZoom(ref, { enabled, zoomDays, locked, activeIndex: 30, onChange });
  return <div ref={ref} data-testid="viewport">
    <div data-calendar-slide-index="30"><div role="grid"><button>Day</button></div></div>
    <div data-calendar-slide-index="31"><div role="grid"><button>Next month</button></div></div>
  </div>;
}
type Contact = { clientX: number; clientY: number; target: EventTarget };
function touch(target: Element, name: string, points: Contact[]) {
  const e = new Event(name, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', {
    value: { length: points.length, item: (i: number) => points[i] ?? null },
  });
  act(() => { target.dispatchEvent(e); });
  return e;
}
const points = (target: Element, xs: number[]): Contact[] =>
  xs.map(clientX => ({ clientX, clientY: 50, target }));
function pinch(target: Element, from: number[], to: number[]) {
  const start = touch(target, 'touchstart', points(target, from));
  touch(target, 'touchmove', points(target, to));
  touch(target, 'touchend', points(target, [to[0]]));
  return start;
}
function layout() {
  vi.spyOn(screen.getByTestId('viewport'), 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, right: 200, top: 0, bottom: 300, width: 200, height: 300, toJSON: () => ({}),
  });
}

describe('opt-in Calendar pinch', () => {

  it('anchors both zoom directions to the pinch location', () => {
    const intoFour = calendarPinchMorphFrame({
      fromDays: 7, anchorWeekday: 3.5, centerFraction: 0.5,
      viewportWidth: 350, trackWidth: 612.5, scrollLeft: 175,
    });
    expect(intoFour!.scaleX).toBeCloseTo(4 / 7);
    expect(intoFour!.originX - 175 + intoFour!.translateX).toBeCloseTo(175);

    const intoSeven = calendarPinchMorphFrame({
      fromDays: 4, anchorWeekday: 4, centerFraction: 0.5,
      viewportWidth: 350, trackWidth: 350, scrollLeft: 0,
    });
    expect(intoSeven!.scaleX).toBeCloseTo(7 / 4);
    expect(intoSeven!.originX + intoSeven!.translateX).toBeCloseTo(175);
    expect(calendarPinchMorphFrame({
      fromDays: 7, anchorWeekday: 3, centerFraction: 0.5,
      viewportWidth: 0, trackWidth: 350, scrollLeft: 0,
    })).toBeNull();
  });

  it('creates a short compositor animation without writing horizontal scroll offsets', () => {
    const node = document.createElement('div');
    const finish = { cancel: vi.fn() } as unknown as Animation;
    const animate = vi.fn().mockReturnValue(finish);
    Object.defineProperty(node, 'animate', { configurable: true, value: animate });
    const frame = { scaleX: 4 / 7, originX: 200, translateX: 25 };
    expect(playCalendarPinchMorph(node, frame)).toBe(finish);
    expect(animate).toHaveBeenCalledTimes(1);
    const [frames, options] = animate.mock.calls[0];
    expect(frames[0].transform).toContain('scaleX(0.571428');
    expect(frames[1].transform).toBe('translateX(0px) scaleX(1)');
    expect(options.duration).toBeGreaterThan(0);
    expect(options.duration).toBeLessThanOrEqual(300);
    Object.defineProperty(node, 'animate', { configurable: true, value: undefined });
    expect(playCalendarPinchMorph(node, frame)).toBeNull();
  });

  it('maps directional thresholds to one 7/4/3-day step, clamping boundaries', () => {
    expect(nextCalendarPinchMode(7, 1.3)).toBe(4);
    expect(nextCalendarPinchMode(4, 1.3)).toBe(3);
    expect(nextCalendarPinchMode(3, 1.3)).toBe(3);
    expect(nextCalendarPinchMode(3, 0.7)).toBe(4);
    expect(nextCalendarPinchMode(4, 0.7)).toBe(7);
    expect(nextCalendarPinchMode(7, 0.7)).toBe(7);
    expect(nextCalendarPinchMode(7, 1.1)).toBe(7);
    expect(nextCalendarPinchMode(4, Number.NaN)).toBe(4);
  });
  it('commits one step on release, preserving gesture-center position', () => {
    const onChange = vi.fn();
    const view = render(<Fixture onChange={onChange} />);
    layout();
    const day = screen.getByRole('button', { name: 'Day' });
    expect(pinch(day, [50, 150], [10, 190]).defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(4, 0.5);
    view.rerender(<Fixture zoomDays={4} onChange={onChange} />);
    pinch(day, [50, 150], [10, 190]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(3, 0.5);
  });
  it('leaves native touch untouched by default and ignores short or cancelled pinches', () => {
    const onChange = vi.fn();
    const view = render(<Fixture enabled={false} onChange={onChange} />);
    layout();
    const day = screen.getByRole('button', { name: 'Day' });
    expect(pinch(day, [50, 150], [10, 190]).defaultPrevented).toBe(false);
    view.rerender(<Fixture onChange={onChange} />);
    pinch(day, [50, 150], [48, 152]);
    touch(day, 'touchstart', points(day, [50, 150]));
    touch(day, 'touchmove', points(day, [10, 190]));
    touch(day, 'touchcancel', []);
    touch(day, 'touchend', []);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('ignores gestures on inactive slides or during navigation transitions', () => {
    const onChange = vi.fn();
    const view = render(<Fixture onChange={onChange} />);
    layout();
    expect(pinch(screen.getByRole('button', { name: 'Next month' }), [50, 150], [10, 190]).defaultPrevented).toBe(false);
    view.rerender(<Fixture locked onChange={onChange} />);
    pinch(screen.getByRole('button', { name: 'Day' }), [50, 150], [10, 190]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
