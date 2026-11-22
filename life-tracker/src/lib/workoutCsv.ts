/**
 * Local-only, source-agnostic workout CSV preparation.
 * Nothing here contacts a provider, persists a record, or changes a Mosaic task.
 * IFTTT/Strava-derived rows are PREVIEW ONLY pending downstream-use clearance (#2370).
 */

export const MAX_WORKOUT_CSV_BYTES = 8 * 1024 * 1024;
export const MAX_WORKOUT_CSV_ROWS = 20000;
const MAX_CELL_CHARS = 8192;

export type WorkoutColumn = 'completedAt' | 'sport' | 'name' | 'distanceMeters' | 'elapsedSeconds';
export const REQUIRED_WORKOUT_COLUMNS: readonly WorkoutColumn[] = [
  'completedAt', 'sport', 'name', 'distanceMeters', 'elapsedSeconds',
];
export type WorkoutMapping = Record<WorkoutColumn, number | null>;

export interface CsvWorkbook {
  headers: string[];
  records: Array<{ line: number; cells: string[] }>;
  detectedHeader: boolean;
  delimiter: string;
  mapping: WorkoutMapping;
}
export interface WorkoutPreviewRow {
  line: number;
  title: string;
  sport: string;
  localDate: string;
  distanceMeters: number | null;
  elapsedSeconds: number | null;
  elapsedPaceSecondsPerKm: number | null;
  state: 'valid' | 'duplicate' | 'invalid';
  issue: string | null;
}
export interface WorkoutPreview {
  rows: WorkoutPreviewRow[];
  valid: number;
  duplicate: number;
  invalid: number;
}
const COLUMN_HINTS: Record<WorkoutColumn, readonly string[]> = {
  completedAt: ['completedat', 'completed', 'createdat', 'activitydate', 'date', 'timestamp', 'enddate'],
  sport: ['sport', 'sporttype', 'activitytype', 'type', 'workouttype'],
  name: ['name', 'title', 'activityname', 'workoutname'],
  distanceMeters: ['distancem', 'distancemeters', 'distanceinmeters', 'meters'],
  elapsedSeconds: ['elapsedseconds', 'elapsedtimeinseconds', 'durationseconds', 'durationinseconds', 'totalseconds', 'elapsedtime'],
};
export function normalizedWorkoutHeader(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[^a-z0-9]/g, '');
}
export function suggestWorkoutMapping(headers: string[]): WorkoutMapping {
  const used = new Set<number>();
  const mapping = {} as WorkoutMapping;
  for (const field of REQUIRED_WORKOUT_COLUMNS) {
    const i = headers.findIndex((header, index) =>
      !used.has(index) && COLUMN_HINTS[field].includes(normalizedWorkoutHeader(header))
    );
    mapping[field] = i < 0 ? null : i;
    if (i >= 0) used.add(i);
  }
  return mapping;
}

function detectDelimiter(text: string): string {
  let quote = false;
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };
  for (let i = 0; i < Math.min(text.length, 32768); i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') i += 1;
      else quote = !quote;
    } else if (!quote && (c === '\n' || c === '\r')) break;
    else if (!quote && c in counts) counts[c] += 1;
  }
  return (['\t', ';', ','] as const).sort((a, b) => counts[b] - counts[a])[0] || ',';
}

export function parseWorkoutCsv(input: string): CsvWorkbook {
  if (new TextEncoder().encode(input).byteLength > MAX_WORKOUT_CSV_BYTES) {
    throw new Error('CSV exceeds the 8 MiB file limit.');
  }
  const text = input.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('CSV is empty.');
  const delimiter = detectDelimiter(text);
  const rows: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let rowLine = 1;

  const finishCell = () => {
    cells.push(cell.trim());
    cell = '';
    closedQuote = false;
  };
  const finishRow = () => {
    finishCell();
    if (cells.some((value) => value.length > 0)) {
      rows.push({ line: rowLine, cells });
      if (rows.length > MAX_WORKOUT_CSV_ROWS + 1) {
        throw new Error('CSV exceeds the 20,000-row limit.');
      }
    }
    cells = [];
    rowLine = line;
  };

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else { quoted = false; closedQuote = true; }
      } else if (c === '\r' || c === '\n') {
        cell += '\n';
        if (c === '\r' && text[i + 1] === '\n') i += 1;
        line += 1;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      if (cell === '' && !closedQuote) quoted = true;
      else throw new Error('Unexpected quote near CSV line ' + line + '.');
    } else if (c === delimiter) {
      finishCell();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      line += 1;
      finishRow();
    } else if (closedQuote && c !== ' ' && c !== '\t') {
      throw new Error('Unexpected character after quoted value near line ' + line + '.');
    } else if (!closedQuote) {
      cell += c;
    }
    if (cell.length > MAX_CELL_CHARS) {
      throw new Error('CSV cell exceeds the 8,192-character limit near line ' + line + '.');
    }
  }
  if (quoted) throw new Error('Unterminated quoted value near CSV line ' + rowLine + '.');
  if (cell !== '' || cells.length > 0 || closedQuote) finishRow();
  if (!rows.length) throw new Error('CSV contains no records.');

  const first = rows[0].cells;
  const inferred = suggestWorkoutMapping(first);
  const detectedHeader = REQUIRED_WORKOUT_COLUMNS.filter((field) =>
    inferred[field] !== null
  ).length >= 2;
  const headers = detectedHeader
    ? first
    : first.map((_, index) => 'Column ' + (index + 1));
  const records = detectedHeader ? rows.slice(1) : rows;
  if (!records.length) throw new Error('CSV has column headings but no workout rows.');
  return { headers, records, detectedHeader, delimiter, mapping: detectedHeader ? inferred : suggestWorkoutMapping(headers) };
}

function parseTimestamp(value: string): string | null {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(text + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
  }
  const day = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const validDay = new Date(day + 'T00:00:00Z');
  if (Number.isNaN(validDay.getTime()) || validDay.toISOString().slice(0, 10) !== day) return null;
  // Require an explicit offset. Locale-dependent Sheets dates must be mapped/corrected,
  // never silently interpreted in the device timezone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : text.slice(0, 10);
}

function parseNonnegativeNumber(value: string): number | null {
  if (!/^(?:\d+)(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1e10 ? parsed : null;
}
function parseSeconds(value: string): number | null {
  const plain = parseNonnegativeNumber(value);
  if (plain !== null) return plain;
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || !parts.every((part) => /^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (parts.length === 2 && numbers[1] < 60) return numbers[0] * 60 + numbers[1];
  if (parts.length === 3 && numbers[1] < 60 && numbers[2] < 60) {
    return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
  }
  return null;
}
export function workoutElapsedPace(distanceMeters: number | null, seconds: number | null): number | null {
  return distanceMeters !== null && seconds !== null && distanceMeters > 0 && seconds > 0
    ? seconds / (distanceMeters / 1000)
    : null;
}
export function formatWorkoutPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm)) return '—';
  const total = Math.round(secondsPerKm);
  return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0') + '/km';
}

export function previewWorkoutCsv(workbook: CsvWorkbook, mapping: WorkoutMapping): WorkoutPreview {
  const usedColumns = REQUIRED_WORKOUT_COLUMNS.map((field) => mapping[field]);
  if (usedColumns.some((index) => index === null) || new Set(usedColumns).size !== usedColumns.length) {
    return { rows: [], valid: 0, duplicate: 0, invalid: workbook.records.length };
  }
  const get = (cells: string[], key: WorkoutColumn) => cells[mapping[key] as number] ?? '';
  const seen = new Set<string>();
  const rows: WorkoutPreviewRow[] = workbook.records.map(({ line, cells }) => {
    const title = get(cells, 'name').trim();
    const sport = get(cells, 'sport').trim();
    const localDate = parseTimestamp(get(cells, 'completedAt'));
    const distance = parseNonnegativeNumber(get(cells, 'distanceMeters'));
    const duration = parseSeconds(get(cells, 'elapsedSeconds'));
    let issue: string | null = null;
    if (!title || !sport) issue = 'Missing title or activity type';
    else if (!localDate) issue = 'Date needs YYYY-MM-DD or an ISO timestamp with timezone';
    else if (distance === null || duration === null) issue = 'Invalid distance or elapsed duration';
    else if (cells.length <= Math.max(...(usedColumns as number[]))) issue = 'Missing mapped column';
    const fingerprint = JSON.stringify([title.toLowerCase(), sport.toLowerCase(), localDate, distance, duration]);
    let state: WorkoutPreviewRow['state'] = issue ? 'invalid' : 'valid';
    if (state === 'valid' && seen.has(fingerprint)) {
      state = 'duplicate';
      issue = 'Possible duplicate: identical stats in an earlier row. Review both before importing.';
    } else if (state === 'valid') {
      seen.add(fingerprint);
    }
    return {
      line, title, sport, localDate: localDate ?? '',
      distanceMeters: distance, elapsedSeconds: duration,
      elapsedPaceSecondsPerKm: workoutElapsedPace(distance, duration),
      state, issue,
    };
  });
  return {
    rows,
    valid: rows.filter((row) => row.state === 'valid').length,
    duplicate: rows.filter((row) => row.state === 'duplicate').length,
    invalid: rows.filter((row) => row.state === 'invalid').length,
  };
}
