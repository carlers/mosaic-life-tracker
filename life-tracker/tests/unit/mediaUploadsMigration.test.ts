import { describe, expect, it, vi } from 'vitest';
import { migrateMediaUploadsBackend } from '../../scripts/migrate-media-uploads.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const manifest = MOSAIC_TABLES.find(t => t.id === 'media_uploads')!;

describe('media provenance schema migration', () => {
  it('creates a server-only private ledger with no browser grants', async () => {
    const request = vi.fn().mockRejectedValueOnce({status:404}).mockResolvedValueOnce({});
    expect(await migrateMediaUploadsBackend({request})).toEqual({created:true});
    expect(request.mock.calls[1][1]).toBe('/tablesdb/life_tracker/tables');
    expect(request.mock.calls[1][2]).toMatchObject({
      tableId:'media_uploads', permissions:[], rowSecurity:true, columns:manifest.columns,
      indexes:manifest.indexes,
    });
  });
  it('is idempotent for an exact manifest', async () => {
    const request = vi.fn().mockResolvedValue({
      $id:'media_uploads',rowSecurity:true,enabled:true,$permissions:[],
      columns:manifest.columns, indexes:manifest.indexes,
    });
    expect(await migrateMediaUploadsBackend({request})).toEqual({created:false});
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects browser grants, incomplete columns and index drift', async () => {
    for (const override of [
      {$permissions:['create("users")']},
      {columns:manifest.columns.slice(1)},
      {indexes:[]},
    ]) {
      const request = vi.fn().mockResolvedValue({
        $id:'media_uploads',rowSecurity:true,enabled:true,$permissions:[],
        columns:manifest.columns,indexes:manifest.indexes,...override,
      });
      await expect(migrateMediaUploadsBackend({request})).rejects.toThrow(/drift/);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
});
