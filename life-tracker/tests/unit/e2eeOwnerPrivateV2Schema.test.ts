import {createRequire} from 'node:module';
import {describe,expect,it} from 'vitest';
const require=createRequire(import.meta.url);
const {OWNER_PRIVATE_V2_SCRATCH_TABLE:table}=require(
  '../../appwrite-functions/message-action/e2ee-owner-v2-schema.js'
) as {OWNER_PRIVATE_V2_SCRATCH_TABLE:{
  projectId:string;id:string;name:string;policy:string;
  permissions:readonly string[];rowSecurity:boolean;enabled:boolean;
  columns:readonly {key:string;type:string;required:boolean;size?:number}[];
  indexes:readonly {key:string;type:string;attributes:readonly string[]}[];
}};
describe('Unwired isolated owner v2 backend table design (zero migrations)',()=>{
  it('pins only the real isolated Scratch project and a distinct table from existing v1',()=>{
    expect(table.projectId).toBe('6b00671500279e901846');
    expect(table.id).toBe('private_owner_ciphertexts_v2');
    expect(table.id).not.toBe('private_owner_ciphertexts_v1');
    expect(table.policy).toBe('owner-private-v2');
    expect(table.id.length).toBeLessThanOrEqual(36);
  });
  it('requires server-owned ACL and refuses all direct browser table permissions',()=>{
    expect(table.permissions).toEqual([]);
    expect(table.rowSecurity).toBe(true);
    expect(table.enabled).toBe(true);
    expect(table.columns.every(c=>c.required)).toBe(true);
    const allowed=['user_id','collection','key_id','key_generation','revision',
      'policy_version','envelope','routing_json','op_id',
      'created_at','updated_at','deleted'];
    expect(table.columns.map(c=>c.key)).toEqual(allowed);
    for(const plaintext of ['visibility','date','title','reminder_time',
      'sport','local_date','memo','recipient_id','message','mime'])
      expect(allowed).not.toContain(plaintext);
    expect(table.indexes).toEqual([{
      key:'idx_e2ee_owner_v2_cursor',type:'key',
      attributes:['user_id','collection','updated_at'],
    }]);
  });
  it('is frozen and is a schema proposal, not an executable migrator',()=>{
    expect(Object.isFrozen(table)).toBe(true);
    expect(Object.isFrozen(table.columns)).toBe(true);
    expect(Object.keys(table).sort()).toEqual([
      'projectId','id','name','permissions','rowSecurity','enabled',
      'columns','indexes','policy',
    ].sort());
  });
});
