import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_HOLIDAYS_BY_DATE,
  groupHolidaysByDate,
  type HolidayCountry,
  type HolidayDisplayConfig,
  type HolidayOccurrence,
} from '../lib/holidays';

export function useHolidaysByDate(
  config: HolidayDisplayConfig,
  years: readonly number[]
): ReadonlyMap<string, readonly HolidayOccurrence[]> {
  const yearsKey = [...new Set(years)]
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b)
    .join(',');
  const requestedYears = useMemo(
    () => (yearsKey ? yearsKey.split(',').map(Number) : []),
    [yearsKey]
  );
  const [holidays, setHolidays] = useState<HolidayOccurrence[]>([]);
  const isEnabled =
    config.enabled && !!config.countryCode && requestedYears.length > 0;

  useEffect(() => {
    if (!isEnabled) return;
    let active = true;
    void import('../lib/holidayData')
      .then(async (data) => {
        const cached = data.readCachedHolidayYears(
          config.countryCode,
          requestedYears,
          config.types
        );
        if (active) setHolidays(cached);
        const refreshed = await data.refreshHolidayYears(
          config.countryCode,
          requestedYears,
          config.types
        );
        if (active) setHolidays(refreshed);
      })
      .catch(() => {
        if (active) setHolidays([]);
      });
    return () => {
      active = false;
    };
  }, [config.countryCode, config.types, isEnabled, requestedYears]);

  return useMemo(
    () => isEnabled && holidays.length > 0
      ? groupHolidaysByDate(holidays)
      : EMPTY_HOLIDAYS_BY_DATE,
    [holidays, isEnabled]
  );
}

export function useHolidayCountries(): HolidayCountry[] {
  const [countries, setCountries] = useState<HolidayCountry[]>([]);
  useEffect(() => {
    let active = true;
    void import('../lib/holidayData')
      .then(async (data) => {
        const cached = data.readCachedHolidayCountries();
        if (active && cached.length > 0) setCountries(cached);
        const refreshed = await data.refreshHolidayCountries();
        if (active) setCountries(refreshed);
      })
      .catch(() => {
        if (active) setCountries([]);
      });
    return () => {
      active = false;
    };
  }, []);
  return countries;
}
