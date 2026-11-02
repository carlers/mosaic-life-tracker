import { describe, expect, it, vi } from 'vitest';
import { migrateSyntheticMediaDelete } from '../../scripts/migrate-synthetic-media-delete.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(t=>t.id==='media_uploads')!;
const onlyBase = expected.columns.filter(c=>!['delete_requested_at','delete_token_hash','deleted_at','delete_receipt'].includes(c.key));
const safe = (columns: unknown[]=onlyBase) => ({
  $id:'media_uploads',rowSecurity:true,enabled:true,$permissions:[],columns,
});
describe('private additive synthetic media receipt migration',()=>{
  it('adds only optional server-controlled receipt columns',async()=>{
    const request=vi.fn().mockResolvedValueOnce(safe()).mockResolvedValue({});
    expect(await migrateSyntheticMediaDelete({request})).toEqual({added:4});
    const posts=request.mock.calls.filter(([method]:any)=>method==='POST');
    expect(posts).toHaveLength(4);
    expect(posts.map(([,url]:any)=>url)).toEqual(Array(4).fill('/tablesdb/life_tracker/tables/media_uploads/columns/varchar'));
    expect(posts.every(([,_,body]:any)=>body.required===false)).toBe(true);
  });
  it('is idempotent for the complete manifest',async()=>{
    const request=vi.fn().mockResolvedValue(safe(expected.columns));
    expect(await migrateSyntheticMediaDelete({request})).toEqual({added:0});
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects unsafe permissions and incompatible columns',async()=>{
    for(const issue of [
      {...safe(),$permissions:['read("users")']},
      safe(expected.columns.map(c=>c.key==='deleted_at'?{...c,size:12}:c)),
    ]) {
      await expect(migrateSyntheticMediaDelete({
        request:vi.fn().mockResolvedValue(issue),
      })).rejects.toThrow();
    }
  });
});
