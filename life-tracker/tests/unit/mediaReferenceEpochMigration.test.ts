import { describe, expect, it, vi } from 'vitest';
import { migrateMediaReferenceEpoch } from '../../scripts/migrate-media-reference-epoch.mjs';
const table={ $id:'media_uploads',rowSecurity:true,enabled:true,$permissions:[],columns:[] };
describe('additive private reference epoch migration',()=>{
  it('creates only one additive integer column',async()=>{
    const req=vi.fn().mockResolvedValueOnce(table).mockResolvedValueOnce({});
    expect(await migrateMediaReferenceEpoch({request:req})).toEqual({added:true});
    expect(req).toHaveBeenCalledWith('POST',
      '/tablesdb/life_tracker/tables/media_uploads/columns/integer',
      {key:'reference_epoch',required:false,default:0,min:0});
  });
  it('accepts existing safe epoch idempotently',async()=>{
    const req=vi.fn().mockResolvedValue({...table,
      columns:[{key:'reference_epoch',type:'integer',required:false,default:0}]});
    expect(await migrateMediaReferenceEpoch({request:req})).toEqual({added:false});
    expect(req).toHaveBeenCalledTimes(1);
  });
  it('rejects permissions and schema drift without writes',async()=>{
    for(const changes of [{$permissions:['create("users")']},
      {rowSecurity:false},{columns:[{key:'reference_epoch',type:'varchar',required:false}]},
      {columns:[{key:'reference_epoch',type:'integer',required:true}]}]){
      const req=vi.fn().mockResolvedValue({...table,...changes});
      await expect(migrateMediaReferenceEpoch({request:req})).rejects.toThrow(/drift/);
      expect(req).toHaveBeenCalledTimes(1);
    }
  });
});
