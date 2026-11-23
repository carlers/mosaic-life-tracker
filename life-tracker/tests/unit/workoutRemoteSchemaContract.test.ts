import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import { ACCOUNT_ERASURE_POLICY } from '../../infrastructure/account-erasure-policy.mjs';
import { migrateWorkoutTablesBackend } from '../../scripts/migrate-workout-tables.mjs';
import { fromAppwriteFormat, toAppwriteFormat } from '../../src/lib/syncMapping';

const tables=['activities','activity_task_links'] as const;
describe('private workout remote schema preflight (no live Appwrite writes)',()=>{
  it('adds owner-secure tables with erasure policy and correct columns',()=>{
    for(const id of tables){
      const t=MOSAIC_TABLES.find(t=>t.id===id)!;
      expect(t.rowSecurity).toBe(true);
      expect(t.permissions).toEqual(['create("users")']);
      expect(ACCOUNT_ERASURE_POLICY.tables[id]).toEqual({kind:'owned',ownerField:'user_id'});
      expect(t.indexes.some(idx=>idx.attributes[0]==='user_id')).toBe(true);
    }
    expect(MOSAIC_TABLES.find(t=>t.id==='activities')!.columns.find(c=>c.key==='distance_meters')?.type).toBe('double');
  });
  it('round-trips only source-cleared private workout fields',()=>{
    const source={id:'wa_synthetic',userId:'owner_A',title:'Run',sport:'Run',localDate:'2026-11-18',
      completedAt:'2026-11-18T07:30:00+08:00',distanceMeters:5000,elapsedSeconds:1740,
      source:'synthetic',fingerprint:'a'.repeat(64),
      createdAt:'2026-11-18T07:30:00Z',updatedAt:'2026-11-18T07:30:00Z',isDeleted:false};
    const remote=toAppwriteFormat(source,'activities',source.userId);
    expect(remote).not.toHaveProperty('visibility');
    expect(remote).not.toHaveProperty('task_id');
    expect(remote.user_id).toBe('owner_A');
    const known=MOSAIC_TABLES.find(t=>t.id==='activities')!;
    expect(Object.keys(remote).filter(k=>!known.columns.some(c=>c.key===k))).toEqual([]);
    expect(fromAppwriteFormat({...remote,$id:source.id},'activities')).toMatchObject(source);
    expect(()=>toAppwriteFormat({...source,source:'ifttt_strava_csv'},'activities',source.userId))
      .toThrow(/Restricted workout source/);
  });
  it('preflights rights and existing schema before touching either table',async()=>{
    const request=vi.fn(async(method,path)=>{
      if(method==='GET'&&path.endsWith('activities'))return {
        $id:'activities',rowSecurity:false,
      };
      throw Object.assign(new Error('404'),{status:404});
    });
    await expect(migrateWorkoutTablesBackend({request,projectId:'6ae94a2100014d01f5ed'}))
      .rejects.toThrow(/permission drift/);
    expect(request.mock.calls.every(([method])=>method==='GET')).toBe(true);
  });
  it('refuses all other environments and performs only additive creates when both absent',async()=>{
    const request=vi.fn(async(method,path)=>{if(method==='GET')throw Object.assign(new Error('404'),{status:404}); return {$id:'created'};});
    await expect(migrateWorkoutTablesBackend({request,projectId:'6ae9599c002ab812f9c3'}))
      .rejects.toThrow(/Preview/);
    expect(request).not.toHaveBeenCalled();
    const result=await migrateWorkoutTablesBackend({request,projectId:'6ae94a2100014d01f5ed'});
    expect(result.created).toEqual([...tables]);
    expect(request.mock.calls.filter(([method])=>method==='POST')).toHaveLength(2);
    for(const [, ,payload] of request.mock.calls.filter(([method])=>method==='POST')){
      expect(payload).toMatchObject({rowSecurity:true,permissions:['create("users")']});
    }
  });
});
