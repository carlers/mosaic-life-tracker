import React, { useEffect, useMemo } from 'react';
import { useHolidaysByDate } from '../../../hooks/useHolidays';
import type { HolidayDisplayConfig, HolidayOccurrence } from '../../../lib/holidays';

interface HolidaySnapshot {
  key: string;
  byDate: ReadonlyMap<string, readonly HolidayOccurrence[]>;
}

interface CalendarHolidaySubscriberProps {
  config: HolidayDisplayConfig;
  cacheKey: string;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  onHolidays: (snapshot: HolidaySnapshot) => void;
}

/** Keep optional public-holiday subscriptions outside the initial Calendar bundle. */
export const CalendarHolidaySubscriber: React.FC<CalendarHolidaySubscriberProps> = ({
  config, cacheKey, slides, renderStart, renderEnd, onHolidays,
}) => {
  const years = useMemo(() => {
    const seen = new Set<number>();
    for (let index = renderStart; index <= renderEnd; index += 1) {
      const date = slides[index];
      if (!date) continue;
      const year = date.getFullYear();
      seen.add(year);
      if (date.getMonth() === 0) seen.add(year - 1);
      if (date.getMonth() === 11) seen.add(year + 1);
    }
    return [...seen];
  }, [renderStart, renderEnd, slides]);
  const byDate = useHolidaysByDate(config, years);
  useEffect(() => { onHolidays({ key: cacheKey, byDate }); }, [cacheKey, byDate, onHolidays]);
  return null;
};
