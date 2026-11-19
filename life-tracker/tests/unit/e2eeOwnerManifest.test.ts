import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import { migrateE2eeOwnerBackend, OWNER_CIPHERTEXT_TABLE_IDS } from '../../scripts/migrate-e2ee-owner.mjs';

describe('M2 private owner ciphertext schema is isolated until authorized', () => {
  it('rejects Production and arbitrary projects before any HTTP request', async () => {
    const request = vi.fn();
    for (const projectId of ['6ae9599c002ab812f9c3','', 'other']) {
      await expect(migrateE2eeOwnerBackend({projectId,request})).rejects.toThrow('exact disposable Oracle Scratch');
    }
    expect(request).not.toHaveBeenCalled();
  });
  it('enforces browser-deny table permissions and no plain field columns', () => {
    for(const id of OWNER_CIPHERTEXT_TABLE_IDS) {
      const table = MOSAIC_TABLES.find(t=>t.id===id);
      expect(table).toMatchObject({permissions:[],rowSecurity:true,enabled:true});
      const keys = table?.columns.map(c=>c.key)||[];
      expect(keys).toContain('envelope');
      expect(keys).not.toContain('content');
      expect(keys).not.toContain('title');
      expect(keys).not.toContain('description');
      expect(keys).not.toContain('password');
      expect(keys).not.toContain('recovery_secret');
    }
  });
  it('supports exact-Scratch additive table creation without old plaintext writes', async () => {
    const requests:Array<[string,string,unknown]> = [];
    const request = vi.fn(async (verb:string,url:string,body?:unknown)=>{
      requests.push([verb,url,body]);
      if (verb==='GET') throw { status:404 };
      return {};
    });
    const result=await migrateE2eeOwnerBackend({
      projectId:'6ae94a2100014d01f5ed',request,
    });
    expect(result.map(r=>r.created)).toEqual([true,true]);
    const writes=requests.filter(([verb])=>verb==='POST');
    expect(writes).toHaveLength(2);
    expect(writes.map(([,url])=>url)).toEqual([
      '/tablesdb/life_tracker/tables','/tablesdb/life_tracker/tables',
    ]);
    for(const [, , raw] of writes) {
      expect(raw).toMatchObject({permissions:[],rowSecurity:true,enabled:true});
      expect(JSON.stringify(raw)).not.toContain('create(\\"users\\")');
    }
  });
  it('fails closed on existing table permission drift', async () => {
    const request = vi.fn(async (_verb:string, url:string)=>{
      const id=url.split('/').pop();
      const table=MOSAIC_TABLES.find(t=>t.id===id);
      return { $id:id, ...table, permissions:['create("users")'] };
    });
    await expect(migrateE2eeOwnerBackend({
      projectId:'6ae94a2100014d01f5ed',request,
    })).rejects.toThrow('access drift');
  });
});
