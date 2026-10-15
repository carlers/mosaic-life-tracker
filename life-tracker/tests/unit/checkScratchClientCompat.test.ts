import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkConsumerRows,
  checkConsumerSource,
  sampleRemoteRow,
  SYNCED_TABLE_IDS,
} from '../../scripts/check-scratch-client-compat.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const source = {
  'life-tracker/src/lib/syncMapping.ts': readFileSync(
    new URL('../../src/lib/syncMapping.ts', import.meta.url), 'utf8'
  ),
  'life-tracker/src/db/schema.ts': readFileSync(
    new URL('../../src/db/schema.ts', import.meta.url), 'utf8'
  ),
};
const getSource = (_sha: string, path: string) =>
  source[path as keyof typeof source];

describe('shared Scratch backward-compatible client preflight', () => {
  it('checks all eight real remote table shapes against the actual client mapper and strict schemas', () => {
    expect(Object.keys(SYNCED_TABLE_IDS)).toHaveLength(8);
    expect(checkConsumerSource({
      sha: 'current',
      readSource: getSource,
    })).toEqual([]);
  });

  it('rejects the previous unknown-field passthrough behavior before a migration', () => {
    // Recreate the #708 Diary regression: unknown server columns were kept
    // in the mapped object and rejected by strict RxDB document validation.
    const unfiltered = source['life-tracker/src/lib/syncMapping.ts'].replace(
      /  const known = KNOWN_FIELDS\[collection\];\n  if \(known\) \{\n    for \(const key of Object\.keys\(mapped\)\) \{\n      if \(!known\.has\(key\)\) delete mapped\[key\];\n    \}\n  \}\n/,
      ''
    );
    expect(unfiltered).not.toBe(source['life-tracker/src/lib/syncMapping.ts']);
    const failures = checkConsumerSource({
      sha: 'older',
      readSource: (_sha: string, path: string) =>
        path.endsWith('syncMapping.ts') ? unfiltered : getSource('older', path),
    });
    expect(failures.some((message: string) => message.startsWith('diary:'))).toBe(true);
    expect(failures.some((message: string) => message.startsWith('messages:'))).toBe(true);
  });

  it('rejects schema validation failures even when unknown fields are stripped', () => {
    const mapper = () => ({ id: 'x', userId: 'u', unexpected: 'leak' });
    const failures = checkConsumerRows({
      fromAppwriteFormat: mapper,
      schemas: {
        diarySchema: {
          required: ['id', 'date'],
          properties: { id: { type: 'string' }, date: { type: 'string' } },
        },
      },
      tables: MOSAIC_TABLES,
    });
    expect(failures).toContain('tasks: missing table, mapper or local schema');
    expect(failures.some((message: string) => message.startsWith('diary:') &&
      message.includes('additional properties'))).toBe(true);
  });

  it('creates non-destructive candidate rows including a future server-only field', () => {
    const diary = MOSAIC_TABLES.find((table: { id: string }) => table.id === 'diary');
    const row = sampleRemoteRow(diary);
    expect(row).toMatchObject({
      date: '2026-01-01',
      visibility: 'private',
      future_scratch_column: 'server-only',
    });
  });

  it('fails closed if selected historical sources cannot be evaluated', () => {
    expect(() => checkConsumerSource({
      sha: 'missing',
      readSource: () => 'import { unavailable } from "./other-module"; export const nope = unavailable;',
    })).toThrow();
  });
});
