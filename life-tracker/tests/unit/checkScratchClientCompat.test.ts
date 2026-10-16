import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkConsumerRows,
  checkConsumerWrites,
  checkConsumerSource,
  sampleRemoteRow,
  SYNCED_TABLE_IDS,
  parseCompatArguments,
  verifiedTableIds,
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

  it('scope is explicit, default remains all eight tables, invalid selection fails closed', () => {
    expect(verifiedTableIds()).toEqual(Object.keys(SYNCED_TABLE_IDS));
    expect(verifiedTableIds(['diary', 'diary', 'messages'])).toEqual(['diary', 'messages']);
    expect(() => verifiedTableIds([])).toThrow('at least one');
    expect(() => verifiedTableIds(['unknown'])).toThrow('Unknown synchronized table');
    const sha = 'a'.repeat(40);
    expect(parseCompatArguments(['--consumer-sha', sha]).scoped).toBe(false);
    expect(parseCompatArguments([
      '--consumer-sha', sha, '--table', 'diary',
      '--consumer-sha', sha, '--table', 'messages',
    ])).toEqual({ commits: [sha], tableIds: ['diary', 'messages'], scoped: true });
    expect(() => parseCompatArguments(['--table', 'diary'])).toThrow('At least one');
    expect(() => parseCompatArguments(['--consumer-sha', 'HEAD'])).toThrow('Only --consumer-sha');
    expect(() => parseCompatArguments(['--consumer-sha', sha, '--table', 'bad']))
      .toThrow('Unknown synchronized table');
  });

  it('can check only older existing collections without treating new tables as old sync subscriptions', () => {
    const oldSchemas = {
      diarySchema: {
        required: ['id', 'date'],
        properties: { id: { type: 'string' }, date: { type: 'string' } },
      },
    };
    const mapper = (row: { $id: string; date: string }) =>
      ({ id: row.$id, date: row.date });
    expect(checkConsumerRows({ fromAppwriteFormat: mapper, schemas: oldSchemas,
      tableIds: ['diary'] })).toEqual([]);
    expect(checkConsumerRows({ fromAppwriteFormat: mapper, schemas: oldSchemas }))
      .toContain('bucket_task_links: missing table, mapper or local schema');
    expect(checkConsumerSource({ sha: 'current', readSource: getSource,
      tableIds: ['tasks', 'categories', 'diary', 'settings', 'friendships', 'messages'] }))
      .toEqual([]);
  });

  it('still blocks old Diary/message unknown-field passthrough when scoped', () => {
    const mapperSource = source['life-tracker/src/lib/syncMapping.ts'];
    const start = mapperSource.indexOf('  const known = KNOWN_FIELDS[collection];',
      mapperSource.indexOf('export function fromAppwriteFormat'));
    const end = mapperSource.indexOf("  if (collection === 'bucketTaskLinks')", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const unfiltered = mapperSource.slice(0, start) + mapperSource.slice(end);
    const failures = checkConsumerSource({
      sha: 'legacy',
      readSource: (_sha: string, path: string) =>
        path.endsWith('syncMapping.ts') ? unfiltered : getSource('legacy', path),
      tableIds: ['diary', 'messages'],
    });
    expect(failures.some((x: string) => x.startsWith('diary:'))).toBe(true);
    expect(failures.some((x: string) => x.startsWith('messages:'))).toBe(true);
    expect(failures.some((x: string) => x.startsWith('bucket_list_items:'))).toBe(false);
  });

  it('rejects the previous unknown-field passthrough behavior before a migration', () => {
    // Recreate the #708 Diary regression: unknown server columns were kept
    // in the mapped object and rejected by strict RxDB document validation.
    const mapperSource = source['life-tracker/src/lib/syncMapping.ts'];
    const start = mapperSource.indexOf(
      '  const known = KNOWN_FIELDS[collection];',
      mapperSource.indexOf('export function fromAppwriteFormat')
    );
    const end = mapperSource.indexOf("  if (collection === 'bucketTaskLinks')", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const unfiltered = mapperSource.slice(0, start) + mapperSource.slice(end);
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
  it('checks that historical client write payloads fit candidate managed columns and retain owner scope', () => {
    // The current real mapper and current manifest must remain compatible.
    expect(checkConsumerSource({ sha: 'current', readSource: getSource })).toEqual([]);
  });

  it('rejects undeclared outgoing fields, missing required fields, and owner spoofing', () => {
    const table = MOSAIC_TABLES.find((item: { id: string }) => item.id === 'diary');
    expect(table).toBeDefined();
    const failures = checkConsumerWrites({
      tables: [table],
      fromAppwriteFormat: () => ({ date: '2026-01-01' }),
      toAppwriteFormat: () => ({ content: 'text', user_id: 'other_user', rogue_field: 'leak' }),
    });
    expect(failures).toContain('diary: writer emits undeclared column rogue_field');
    expect(failures).toContain('diary: writer omits required column date');
    expect(failures).toContain('diary: writer does not enforce the authenticated owner');
  });

  it('rejects wrong outgoing value types before a remote write', () => {
    const table = MOSAIC_TABLES.find((item: { id: string }) => item.id === 'diary');
    const failures = checkConsumerWrites({
      tables: [table],
      fromAppwriteFormat: () => ({ date: '2026-01-01' }),
      toAppwriteFormat: () => ({ user_id: 'compat_owner', date: '2026-01-01', deleted: 'not-a-boolean' }),
    });
    expect(failures).toContain('diary: writer emits non-boolean column deleted');
  });

});
