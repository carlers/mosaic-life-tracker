import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelative } from '../../src/lib/format';

afterEach(() => {
  vi.useRealTimers();
});

function atFixedNow(nowIso: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(nowIso));
}

describe('formatRelative — compact form (suffix = "")', () => {
  it("returns 'now' for less than a minute ago", () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    expect(formatRelative('2026-09-17T11:59:31.000Z')).toBe('now');
  });

  it('returns Nm for minutes', () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    expect(formatRelative('2026-09-17T11:45:00.000Z')).toBe('15m');
  });

  it('returns Nh for hours', () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    expect(formatRelative('2026-09-17T09:00:00.000Z')).toBe('3h');
  });

  it('returns Nd for days (up to 7)', () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    expect(formatRelative('2026-09-15T12:00:00.000Z')).toBe('2d');
  });

  it('falls back to a short locale date beyond 7 days', () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    const out = formatRelative('2026-08-01T12:00:00.000Z');
    expect(out).not.toMatch(/^(\d+m|\d+h|\d+d|now)$/);
  });
});

describe('formatRelative — verbose form (suffix = " ago")', () => {
  it("returns 'just now' for less than a minute ago", () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    expect(formatRelative('2026-09-17T11:59:31.000Z', ' ago')).toBe('just now');
  });

  it('appends the suffix to minute/hour/day buckets', () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    expect(formatRelative('2026-09-17T11:45:00.000Z', ' ago')).toBe('15m ago');
    expect(formatRelative('2026-09-17T09:00:00.000Z', ' ago')).toBe('3h ago');
    expect(formatRelative('2026-09-17T12:00:00.000Z', ' ago')).toBe('just now');
  });
});

describe('formatRelative — null and edge inputs', () => {
  it("returns 'Never' for null", () => {
    expect(formatRelative(null)).toBe('Never');
    expect(formatRelative(null, ' ago')).toBe('Never');
  });

  it("returns 'now' / 'just now' for a future timestamp", () => {
    atFixedNow('2026-09-17T12:00:00.000Z');
    expect(formatRelative('2026-09-17T12:00:30.000Z')).toBe('now');
    expect(formatRelative('2026-09-17T12:00:30.000Z', ' ago')).toBe('just now');
  });
});
