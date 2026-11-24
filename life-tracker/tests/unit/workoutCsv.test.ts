import { describe, expect, it } from 'vitest';
import {
  MAX_WORKOUT_CSV_BYTES,
  formatWorkoutPace,
  parseWorkoutCsv,
  previewWorkoutCsv,
  workoutElapsedPace,
} from '../../src/lib/workoutCsv';

const HEADER = 'Completed At,Activity Type,Name,Distance Meters,Elapsed Time In Seconds';
const FIXTURE = [
  HEADER,
  '2026-11-18T07:30:00+08:00,Run,"Morning run, easy",5000,1740',
  '2026-11-19T19:45:00+08:00,Run,Evening run,4200,1610',
  '2026-11-19T19:45:00+08:00,Run,Evening run,4200,1610',
].join('\n');

describe('workout CSV preview: no provider requests or persisted writes', () => {
  it('detects the IFTTT column headers and correctly reports duplicates', () => {
    const csv = parseWorkoutCsv(FIXTURE);
    expect(csv.detectedHeader).toBe(true);
    expect(csv.mapping).toEqual({
      completedAt: 0, sport: 1, name: 2, distanceMeters: 3, elapsedSeconds: 4,
    });
    const preview = previewWorkoutCsv(csv, csv.mapping);
    expect(preview).toMatchObject({ valid: 2, duplicate: 1, invalid: 0 });
    expect(preview.rows[0]).toMatchObject({
      title: 'Morning run, easy', sport: 'Run',
      localDate: '2026-11-18', distanceMeters: 5000, elapsedSeconds: 1740,
    });
    expect(formatWorkoutPace(preview.rows[0].elapsedPaceSecondsPerKm)).toBe('5:48/km');
  });

  it('allows headerless user-configured CSV, without guessing column meaning', () => {
    const csv = parseWorkoutCsv('2026-11-20,Run,Local run,1200,600');
    expect(csv.detectedHeader).toBe(false);
    expect(csv.mapping.completedAt).toBeNull();
    const result = previewWorkoutCsv(csv, {
      completedAt: 0, sport: 1, name: 2, distanceMeters: 3, elapsedSeconds: 4,
    });
    expect(result).toMatchObject({ valid: 1, invalid: 0, duplicate: 0 });
    expect(result.rows[0].elapsedPaceSecondsPerKm).toBe(500);
  });

  it('handles BOM, quoted multiline cells and semicolon-delimited Sheets exports', () => {
    const csv = parseWorkoutCsv(
      '\uFEFFCompleted At;Activity Type;Name;Distance Meters;Elapsed Time In Seconds\r\n' +
      '2026-11-20T23:45:00+08:00;Run;"Evening; training\nwith hills";1400;00:07:00\r\n'
    );
    expect(csv.delimiter).toBe(';');
    expect(csv.records).toHaveLength(1);
    expect(csv.records[0].line).toBe(2);
    const result = previewWorkoutCsv(csv, csv.mapping);
    expect(result.valid).toBe(1);
    expect(result.rows[0].title).toBe('Evening; training\nwith hills');
    expect(result.rows[0].localDate).toBe('2026-11-20');
    expect(result.rows[0].elapsedSeconds).toBe(420);
  });

  it('rejects ambiguous locale dates rather than silently assigning a timezone', () => {
    const csv = parseWorkoutCsv(HEADER + '\n11/20/2026,Run,Run,5000,1500');
    const p = previewWorkoutCsv(csv, csv.mapping);
    expect(p.invalid).toBe(1);
    expect(p.rows[0].issue).toMatch(/Date needs/);
  });

  it('treats incomplete and zero-distance rows as distinct from an invented pace', () => {
    const csv = parseWorkoutCsv(HEADER + '\n2026-11-20,Walk,Stroll,0,60\n2026-11-20,Run,Incomplete,,300');
    const p = previewWorkoutCsv(csv, csv.mapping);
    expect(p.valid).toBe(1);
    expect(p.invalid).toBe(1);
    expect(p.rows[0].elapsedPaceSecondsPerKm).toBeNull();
    expect(formatWorkoutPace(null)).toBe('—');
    expect(workoutElapsedPace(0, 300)).toBeNull();
  });

  it('rejects repeated mapping indexes instead of inventing values', () => {
    const csv = parseWorkoutCsv(FIXTURE);
    const p = previewWorkoutCsv(csv, { ...csv.mapping, sport: csv.mapping.name });
    expect(p.rows).toHaveLength(0);
    expect(p.invalid).toBe(3);
  });

  it('fails closed on malformed quotes and excessively large input', () => {
    expect(() => parseWorkoutCsv(HEADER + '\n2026-11-20,Run,"unclosed,1000,400'))
      .toThrow(/Unterminated quoted value/);
    expect(() => parseWorkoutCsv('a'.repeat(MAX_WORKOUT_CSV_BYTES + 1)))
      .toThrow(/8 MiB/);
  });

  it('does not treat entries absent from an overlap or an IFTTT rollover as deletions', () => {
    const first = previewWorkoutCsv(parseWorkoutCsv(FIXTURE), parseWorkoutCsv(FIXTURE).mapping);
    const secondFile = parseWorkoutCsv(HEADER + '\n2026-11-21,Run,New run,3100,1200');
    const second = previewWorkoutCsv(secondFile, secondFile.mapping);
    expect(first.valid).toBe(2);
    expect(second.valid).toBe(1);
    // Preview is independent of any database. It performs no replacement/deletion.
  });
});
