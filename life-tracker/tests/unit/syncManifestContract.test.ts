// Regression: PROJECT_REFERENCE.md §6 and AGENTS.md — synced remote payloads
// must have columns in the Git-owned Appwrite backend manifest.
import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import {
  __resetDriftWarningsForTests,
  fromAppwriteFormat,
  toAppwriteFormat,
} from '../../src/lib/syncMapping';

const syncedCollections = [
  'tasks',
  'categories',
  'diary',
  'settings',
  'friendships',
  'messages',
] as const;

const manifest = new Map(MOSAIC_TABLES.map((table) => [table.id, table]));

describe('synchronized Appwrite serialization contract', () => {
  for (const collection of syncedCollections) {
    it(collection + ': every emitted remote field exists in the managed manifest', () => {
      const table = manifest.get(collection);
      expect(table, 'manifest table for ' + collection).toBeDefined();

      const columnNames = new Set(table!.columns.map((column) => column.key));
      const outgoing = toAppwriteFormat(
        collection === 'messages' ? { direction: 'outgoing' } : {},
        collection,
        'viewer_A'
      );
      expect(Object.keys(outgoing).length).toBeGreaterThan(0);
      expect(Object.keys(outgoing).filter((key) => !columnNames.has(key))).toEqual([]);

      // Incoming message read receipts are a separate legal serialization path.
      if (collection === 'messages') {
        expect(outgoing).not.toHaveProperty('read_at');
        const incoming = toAppwriteFormat(
          { direction: 'incoming', readAt: '2026-10-09T00:00:00.000Z' },
          collection,
          'viewer_A'
        );
        expect(incoming).toHaveProperty('read_at');
        expect(Object.keys(incoming).filter((key) => !columnNames.has(key))).toEqual([]);
      }
    });

    it(collection + ': declared remote columns are accepted without drift warnings', () => {
      const table = manifest.get(collection);
      expect(table).toBeDefined();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      __resetDriftWarningsForTests();
      try {
        // Appwrite metadata keys are intentionally not managed columns.
        const remote = Object.fromEntries(table!.columns.map((column) => [column.key, '']));
        fromAppwriteFormat({ ...remote, $id: 'row_1', $createdAt: '' }, collection);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  }
});
