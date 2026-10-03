import { describe, expect, it } from 'vitest';
import {
  createHolidayDisplayConfig,
  filterHolidayOccurrences,
  groupHolidaysByDate,
  normalizeHolidayRegion,
  resolveHolidayTypesSetting,
  type HolidayOccurrence,
} from '../../src/lib/holidays';
import {
  parseAvailableCountriesPayload,
  parseHolidayApiPayload,
} from '../../src/lib/holidayData';

const holidays: HolidayOccurrence[] = [
  {
    id: 'PH:2026-01-01:New Year',
    date: '2026-01-01',
    title: 'New Year',
    countryCode: 'PH',
    types: ['Public'],
  },
  {
    id: 'PH:2026-11-02:All Souls Day',
    date: '2026-11-02',
    title: 'All Souls Day',
    countryCode: 'PH',
    types: ['Observance'],
  },
  {
    id: 'PH:2026-06-01:School Break',
    date: '2026-06-01',
    title: 'School Break',
    countryCode: 'PH',
    types: ['School'],
  },
];

describe('holiday domain', () => {
  it('normalizes region/type preferences', () => {
    expect(normalizeHolidayRegion(' ph ')).toBe('PH');
    expect(normalizeHolidayRegion('PHL')).toBe('');
    expect(resolveHolidayTypesSetting('public')).toBe('public');
    expect(resolveHolidayTypesSetting('unexpected')).toBe('public-and-observances');
    expect(createHolidayDisplayConfig(true, 'ph', 'public')).toMatchObject({
      enabled: true,
      countryCode: 'PH',
      types: 'public',
    });
  });

  it('keeps public holidays and optionally observances', () => {
    expect(filterHolidayOccurrences(holidays, 'public').map((item) => item.title))
      .toEqual(['New Year']);
    expect(
      filterHolidayOccurrences(holidays, 'public-and-observances').map(
        (item) => item.title
      )
    ).toEqual(['New Year', 'All Souls Day']);
  });

  it('groups occurrences by ISO day', () => {
    const grouped = groupHolidaysByDate([
      holidays[0],
      { ...holidays[1], date: '2026-01-01' },
    ]);
    expect(grouped.get('2026-01-01')?.map((item) => item.title)).toEqual([
      'New Year',
      'All Souls Day',
    ]);
  });

  it('normalizes provider holidays and excludes subdivision-only entries', () => {
    expect(
      parseHolidayApiPayload(
        [
          {
            date: '2026-01-01',
            name: 'New Year',
            countryCode: 'PH',
            nationalHoliday: true,
            subdivisionCodes: null,
            holidayTypes: ['Public'],
          },
          {
            date: '2026-03-01',
            name: 'Local Holiday',
            countryCode: 'PH',
            nationalHoliday: false,
            subdivisionCodes: ['PH-00'],
            holidayTypes: ['Public'],
          },
        ],
        'PH'
      )
    ).toEqual([
      {
        id: 'PH:2026-01-01:New Year',
        date: '2026-01-01',
        title: 'New Year',
        countryCode: 'PH',
        types: ['Public'],
      },
    ]);
  });

  it('normalizes and sorts provider countries', () => {
    expect(
      parseAvailableCountriesPayload([
        { countryCode: 'US', name: 'United States' },
        { countryCode: 'PH', name: 'Philippines' },
        { countryCode: 'PH', name: 'Duplicate' },
      ])
    ).toEqual([
      { countryCode: 'PH', name: 'Philippines' },
      { countryCode: 'US', name: 'United States' },
    ]);
  });
});
