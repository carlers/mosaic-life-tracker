'use strict';

// Source-only M2 protection for older Function action routes in *isolated*
// E2EE Scratch. This is NOT the direct Appwrite TablesDB/Storage permission
// fence: old PWAs can bypass Functions until project ACLs are migrated.
//
// Only the separate, guarded M2 feature flag can activate this policy.
// Never enable it through the synthetic M1 Diary pilot flag.
const SCRATCH_PROJECT='6b00671500279e901846';
const CIPHERTEXT_OR_ERASURE_ACTIONS=new Set([
  'e2ee_owner_v1',
  'e2ee_diary_pilot',
  'delete_account',
  'resume_account_deletion',
]);

function scratchM2CutoverEnabled(env=process.env) {
  return env.APPWRITE_FUNCTION_PROJECT_ID===SCRATCH_PROJECT &&
    env.MOSAIC_E2EE_OWNER_ENABLED==='true';
}

function denyScratchLegacyAction(action,env=process.env) {
  return scratchM2CutoverEnabled(env) &&
    !CIPHERTEXT_OR_ERASURE_ACTIONS.has(action);
}

function denyScratchLegacyEvent(env=process.env) {
  return scratchM2CutoverEnabled(env);
}

module.exports={
  scratchM2CutoverEnabled,
  denyScratchLegacyAction,
  denyScratchLegacyEvent,
};
