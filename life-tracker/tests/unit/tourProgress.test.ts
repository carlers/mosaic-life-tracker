import { describe, expect, it } from 'vitest';
import { canOfferFirstRunTour, tourKey } from '../../src/lib/tourProgress';

describe('guided tour eligibility and isolation', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  it('only offers to a newly created owner with no existing tasks', () => {
    expect(canOfferFirstRunTour('2026-11-02T11:59:00Z', 0, now)).toBe(true);
    expect(canOfferFirstRunTour('2026-11-02T11:59:00Z', 1, now)).toBe(false);
    expect(canOfferFirstRunTour('2026-10-01T00:00:00Z', 0, now)).toBe(false);
    expect(canOfferFirstRunTour(undefined, 0, now)).toBe(false);
    expect(canOfferFirstRunTour('invalid', 0, now)).toBe(false);
    expect(canOfferFirstRunTour('2026-11-03T00:00:00Z', 0, now)).toBe(false);
  });
  it('separates account tour keys from the demo namespace', () => {
    expect(tourKey('owner_a')).not.toBe(tourKey('owner_b'));
    expect(tourKey('owner_a')).not.toBe(tourKey('owner_a', true));
    expect(tourKey('owner_a', true)).toBe(tourKey('owner_b', true));
  });
});
