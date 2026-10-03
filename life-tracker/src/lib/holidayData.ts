import {
  filterHolidayOccurrences,
  normalizeHolidayRegion,
  type HolidayCountry,
  type HolidayOccurrence,
  type HolidayTypesSetting,
} from './holidays';

const API_BASE = 'https://nagerholidays.com/api/v4';
const HOLIDAY_CACHE_PREFIX = 'mosaic_holidays_v1';
const COUNTRY_CACHE_KEY = 'mosaic_holiday_countries_v1';
const HOLIDAY_REFRESH_MS = 24 * 60 * 60 * 1000;
const COUNTRY_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7_000;

interface CacheEnvelope<T> {
  fetchedAt: number;
  data: T;
}
interface HolidayApiEntry {
  date?: unknown;
  name?: unknown;
  countryCode?: unknown;
  nationalHoliday?: unknown;
  subdivisionCodes?: unknown;
  holidayTypes?: unknown;
}
interface CountryApiEntry {
  countryCode?: unknown;
  name?: unknown;
}

const holidayRequests = new Map<string, Promise<HolidayOccurrence[]>>();
let countryRequest: Promise<HolidayCountry[]> | null = null;

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null') as CacheEnvelope<T> | null;
    if (!parsed || !Number.isFinite(parsed.fetchedAt) || !('data' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
function writeEnvelope<T>(key: string, data: T): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({ fetchedAt: Date.now(), data } satisfies CacheEnvelope<T>)
    );
  } catch {
    // Optional holiday cache pressure must never block Mosaic.
  }
}
function holidayCacheKey(countryCode: string, year: number): string {
  return `${HOLIDAY_CACHE_PREFIX}:${countryCode}:${year}`;
}
function isHolidayOccurrence(value: unknown): value is HolidayOccurrence {
  if (!value || typeof value !== 'object') return false;
  const holiday = value as Partial<HolidayOccurrence>;
  return typeof holiday.id === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(holiday.date ?? '')
    && typeof holiday.title === 'string'
    && typeof holiday.countryCode === 'string'
    && Array.isArray(holiday.types);
}
function isHolidayCountry(value: unknown): value is HolidayCountry {
  if (!value || typeof value !== 'object') return false;
  const country = value as Partial<HolidayCountry>;
  return /^[A-Z]{2}$/.test(country.countryCode ?? '')
    && typeof country.name === 'string'
    && country.name.length > 0;
}

export function parseHolidayApiPayload(
  payload: unknown,
  expectedCountryCode: string
): HolidayOccurrence[] {
  if (!Array.isArray(payload)) return [];
  const expectedCountry = normalizeHolidayRegion(expectedCountryCode);
  const seen = new Set<string>();
  const holidays: HolidayOccurrence[] = [];
  for (const raw of payload as HolidayApiEntry[]) {
    const date = typeof raw.date === 'string' ? raw.date : '';
    const title = typeof raw.name === 'string' ? raw.name.trim() : '';
    const countryCode = normalizeHolidayRegion(raw.countryCode);
    const nationalScope = raw.nationalHoliday === true;
    const types = Array.isArray(raw.holidayTypes)
      ? raw.holidayTypes.filter((value): value is string => typeof value === 'string')
      : [];
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !title ||
      !countryCode ||
      (expectedCountry && countryCode !== expectedCountry) ||
      !nationalScope ||
      types.length === 0
    ) continue;
    const id = `${countryCode}:${date}:${title}`;
    if (seen.has(id)) continue;
    seen.add(id);
    holidays.push({ id, date, title, countryCode, types });
  }
  return holidays.sort((a, b) =>
    a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
  );
}

export function parseAvailableCountriesPayload(payload: unknown): HolidayCountry[] {
  if (!Array.isArray(payload)) return [];
  const seen = new Set<string>();
  const countries: HolidayCountry[] = [];
  for (const raw of payload as CountryApiEntry[]) {
    const countryCode = normalizeHolidayRegion(raw.countryCode);
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!countryCode || !name || seen.has(countryCode)) continue;
    seen.add(countryCode);
    countries.push({ countryCode, name });
  }
  return countries.sort((a, b) => a.name.localeCompare(b.name));
}

function readHolidayYearEnvelope(
  countryCode: string,
  year: number
): CacheEnvelope<HolidayOccurrence[]> | null {
  const envelope = readEnvelope<unknown>(holidayCacheKey(countryCode, year));
  if (!envelope || !Array.isArray(envelope.data) || !envelope.data.every(isHolidayOccurrence)) return null;
  return { fetchedAt: envelope.fetchedAt, data: envelope.data };
}
function readCountryEnvelope(): CacheEnvelope<HolidayCountry[]> | null {
  const envelope = readEnvelope<unknown>(COUNTRY_CACHE_KEY);
  if (!envelope || !Array.isArray(envelope.data) || !envelope.data.every(isHolidayCountry)) return null;
  return { fetchedAt: envelope.fetchedAt, data: envelope.data };
}
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Holiday provider returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
async function fetchHolidayYear(countryCode: string, year: number): Promise<HolidayOccurrence[]> {
  const key = `${countryCode}:${year}`;
  const existing = holidayRequests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const payload = await fetchJson(
      `${API_BASE}/Holidays/${encodeURIComponent(countryCode)}/${year}`
    );
    const holidays = parseHolidayApiPayload(payload, countryCode);
    writeEnvelope(holidayCacheKey(countryCode, year), holidays);
    return holidays;
  })();
  holidayRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (holidayRequests.get(key) === request) holidayRequests.delete(key);
  }
}

export function readCachedHolidayYears(
  countryCodeValue: string,
  years: readonly number[],
  types: HolidayTypesSetting
): HolidayOccurrence[] {
  const countryCode = normalizeHolidayRegion(countryCodeValue);
  if (!countryCode) return [];
  const holidays: HolidayOccurrence[] = [];
  for (const year of years) {
    const envelope = readHolidayYearEnvelope(countryCode, year);
    if (envelope) holidays.push(...envelope.data);
  }
  return filterHolidayOccurrences(holidays, types);
}

export async function refreshHolidayYears(
  countryCodeValue: string,
  years: readonly number[],
  types: HolidayTypesSetting
): Promise<HolidayOccurrence[]> {
  const countryCode = normalizeHolidayRegion(countryCodeValue);
  if (!countryCode) return [];
  const now = Date.now();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const resolved = await Promise.all(
    years.map(async (year) => {
      const cached = readHolidayYearEnvelope(countryCode, year);
      const fresh = cached && now - cached.fetchedAt < HOLIDAY_REFRESH_MS;
      if (fresh || offline) return cached?.data ?? [];
      try {
        return await fetchHolidayYear(countryCode, year);
      } catch {
        return cached?.data ?? [];
      }
    })
  );
  return filterHolidayOccurrences(resolved.flat(), types);
}

export function readCachedHolidayCountries(): HolidayCountry[] {
  return readCountryEnvelope()?.data ?? [];
}
export async function refreshHolidayCountries(): Promise<HolidayCountry[]> {
  const cached = readCountryEnvelope();
  const fresh = cached && Date.now() - cached.fetchedAt < COUNTRY_REFRESH_MS;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (fresh || offline) return cached?.data ?? [];
  if (countryRequest) return countryRequest;
  countryRequest = (async () => {
    try {
      const payload = await fetchJson(`${API_BASE}/Countries/Available`);
      const countries = parseAvailableCountriesPayload(payload);
      if (countries.length > 0) {
        writeEnvelope(COUNTRY_CACHE_KEY, countries);
        return countries;
      }
      return cached?.data ?? [];
    } catch {
      return cached?.data ?? [];
    }
  })();
  try {
    return await countryRequest;
  } finally {
    countryRequest = null;
  }
}
