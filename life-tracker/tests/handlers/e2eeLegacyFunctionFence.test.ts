import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { invoke, makeMockDb } from '../helpers/invoke-handler';

const cjs = createRequire(import.meta.url);
const {
  scratchM2CutoverEnabled,
  denyScratchLegacyAction,
  denyScratchLegacyEvent,
} = cjs('../../appwrite-functions/message-action/e2ee-legacy-function-fence.js') as {
  scratchM2CutoverEnabled: (env: Record<string,string|undefined>) => boolean;
  denyScratchLegacyAction: (action: string,env:Record<string,string|undefined>) => boolean;
  denyScratchLegacyEvent: (env: Record<string,string|undefined>) => boolean;
};
const scratch='6b00671500279e901846';
const legacyActions=[
  'create_owner_row','compare_and_set_owner_row','bulk_create_todomate_tasks',
  'reserve_media_upload','confirm_media_upload','run_category_lifecycle',
  'recover_deleted_category','send','deliver','friendship',
  'task_shares','get_friend_calendar','submit_bug_report',
  'harden_category_owner_acls','list_reclaimable_media',
];

describe('M2 Scratch legacy Function write barrier (NOT direct Appwrite ACL)',()=>{
  afterEach(()=>vi.unstubAllEnvs());

  it('enforces a hard Scratch project + separate general-owner flag boundary',()=>{
    for(const project of [
      '6ae94a2100014d01f5ed','6ae9599c002ab812f9c3',
      '6ae1bf2e00034572451b','',undefined,
    ]) {
      const env={APPWRITE_FUNCTION_PROJECT_ID:project,MOSAIC_E2EE_OWNER_ENABLED:'true'};
      expect(scratchM2CutoverEnabled(env)).toBe(false);
      expect(denyScratchLegacyAction('create_owner_row',env)).toBe(false);
      expect(denyScratchLegacyEvent(env)).toBe(false);
    }
    for(const flag of [undefined,'false','TRUE','1','']) {
      const env={APPWRITE_FUNCTION_PROJECT_ID:scratch,MOSAIC_E2EE_OWNER_ENABLED:flag};
      expect(denyScratchLegacyAction('compare_and_set_owner_row',env)).toBe(false);
    }
  });

  it('denies every old plaintext Function action while preserving encrypted and erasure routes',()=>{
    const env={APPWRITE_FUNCTION_PROJECT_ID:scratch,MOSAIC_E2EE_OWNER_ENABLED:'true'};
    expect(scratchM2CutoverEnabled(env)).toBe(true);
    for(const action of legacyActions) {
      expect(denyScratchLegacyAction(action,env)).toBe(true);
    }
    for(const action of [
      'e2ee_owner_v1','e2ee_diary_pilot','delete_account',
      'resume_account_deletion',
    ]) {
      expect(denyScratchLegacyAction(action,env)).toBe(false);
    }
    expect(denyScratchLegacyAction('',env)).toBe(true);
    expect(denyScratchLegacyAction('unknown_future_action',env)).toBe(true);
    expect(denyScratchLegacyEvent(env)).toBe(true);
  });

  it('rejects old authenticated actions before any legacy row, Function or Storage write',async()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',scratch);
    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','true');
    for(const action of [
      'create_owner_row','compare_and_set_owner_row',
      'bulk_create_todomate_tasks','reserve_media_upload',
      'send','friendship','submit_bug_report',
    ]) {
      const db=makeMockDb();
      const answer=await invoke({userId:'synthetic_owner',body:{
        action,ownerId:'synthetic_owner',tableId:'tasks',
        rowId:'task_old',data:{user_id:'synthetic_owner',title:'canary-private-content'},
      },mockDb:db});
      expect(answer.status).toBe(409);
      expect(answer.body).toEqual({error:'Legacy action unavailable during encryption'});
      expect(db.createRow).not.toHaveBeenCalled();
      expect(db.updateRow).not.toHaveBeenCalled();
      expect(db.updateRows).not.toHaveBeenCalled();
      expect(db.deleteRow).not.toHaveBeenCalled();
    }
  });

  it('retains pre-cutover behavior and old pilot functionality when general owner flag is OFF',async()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',scratch);
    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','false');
    const result=await invoke({userId:'synthetic_owner',body:{
      action:'compare_and_set_owner_row',tableId:'tasks',rowId:'task_old',
      expectedUpdatedAt:'2026-11-22T00:00:00.000Z',
      data:{user_id:'synthetic_owner',title:'private'},
    },mockDb:makeMockDb()});
    expect(result.body).not.toEqual({error:'Legacy action unavailable during encryption'});

    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','true');
    vi.stubEnv('MOSAIC_E2EE_OWNER_ALLOWED_OWNER_IDS','');
    const ownerAction=await invoke({userId:'synthetic_owner',body:{
      action:'e2ee_owner_v1',operation:'read_root',
    },mockDb:makeMockDb()});
    expect(ownerAction.status).toBe(403);
    expect(ownerAction.body).not.toHaveProperty('error','Legacy action unavailable during encryption');
  });

  it('denies source events before task-derived plaintext side effects',async()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID',scratch);
    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','true');
    const db=makeMockDb();
    const response=await invoke({userId:'synthetic_owner',
      trigger:'event',body:{user_id:'synthetic_owner',title:'canary'},
      mockDb:db});
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error:'Legacy event unavailable during encryption',
    });
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.updateRows).not.toHaveBeenCalled();
  });
});
