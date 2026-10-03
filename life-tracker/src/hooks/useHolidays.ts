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
  const isEnabled =
    config.enabled && !!config.countryCode && requestedYears.length > 0;
  const requestKey = isEnabled
    ? `${config.countryCode}|${config.types}|${yearsKey}`
    : '';
  const [result, setResult] = useState<{
    key: string;
    holidays: HolidayOccurrence[];
  }>({ key: '', holidays: [] });

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
        if (active) setResult({ key: requestKey, holidays: cached });
        const refreshed = await data.refreshHolidayYears(
          config.countryCode,
          requestedYears,
          config.types
        );
        if (active) setResult({ key: requestKey, holidays: refreshed });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, holidays: [] });
      });
    return () => {
      active = false;
    };
  }, [
    config.countryCode,
    config.types,
    isEnabled,
    requestKey,
    requestedYears,
  ]);

  return useMemo(
    () =>
      isEnabled &&
      result.key === requestKey &&
      result.holidays.length > 0
        ? groupHolidaysByDate(result.holidays)
        : EMPTY_HOLIDAYS_BY_DATE,
    [isEnabled, requestKey, result]
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
