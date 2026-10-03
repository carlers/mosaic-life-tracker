export type HolidayTypesSetting = 'public' | 'public-and-observances';

export interface HolidayDisplayConfig {
  enabled: boolean;
  countryCode: string;
  types: HolidayTypesSetting;
}

export interface HolidayOccurrence {
  id: string;
  date: string;
  title: string;
  countryCode: string;
  types: string[];
}

export interface HolidayCountry {
  countryCode: string;
  name: string;
}

export const EMPTY_HOLIDAYS: readonly HolidayOccurrence[] = [];
export const EMPTY_HOLIDAYS_BY_DATE: ReadonlyMap<string, readonly HolidayOccurrence[]> =
  new Map();

export const DISABLED_HOLIDAY_CONFIG: HolidayDisplayConfig = {
  enabled: false,
  countryCode: '',
  types: 'public-and-observances',
};

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export function normalizeHolidayRegion(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  return COUNTRY_CODE_PATTERN.test(normalized) ? normalized : '';
}

export function inferHolidayRegion(): string {
  if (typeof navigator === 'undefined') return '';
  const candidates = [
    navigator.language,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const region = normalizeHolidayRegion(new Intl.Locale(candidate).region);
      if (region) return region;
    } catch {
      const fallback = candidate.match(/[-_]([A-Za-z]{2})(?:$|[-_])/);
      const region = normalizeHolidayRegion(fallback?.[1]);
      if (region) return region;
    }
  }
  return '';
}

export function resolveHolidayTypesSetting(value: unknown): HolidayTypesSetting {
  return value === 'public' ? 'public' : 'public-and-observances';
}

export function createHolidayDisplayConfig(
  enabledValue: unknown,
  regionValue: unknown,
  typesValue: unknown
): HolidayDisplayConfig {
  return {
    enabled: enabledValue === true,
    countryCode: normalizeHolidayRegion(regionValue) || inferHolidayRegion(),
    types: resolveHolidayTypesSetting(typesValue),
  };
}

export function filterHolidayOccurrences(
  holidays: readonly HolidayOccurrence[],
  setting: HolidayTypesSetting
): HolidayOccurrence[] {
  return holidays.filter((holiday) => {
    if (holiday.types.includes('Public')) return true;
    return setting === 'public-and-observances'
      && holiday.types.includes('Observance');
  });
}

export function groupHolidaysByDate(
  holidays: readonly HolidayOccurrence[]
): ReadonlyMap<string, readonly HolidayOccurrence[]> {
  const grouped = new Map<string, HolidayOccurrence[]>();
  for (const holiday of holidays) {
    const existing = grouped.get(holiday.date);
    if (existing) existing.push(holiday);
    else grouped.set(holiday.date, [holiday]);
  }
  return grouped;
}

export function holidayNames(
  holidays: readonly HolidayOccurrence[]
): string {
  return holidays.map((holiday) => holiday.title).join(', ');
}
