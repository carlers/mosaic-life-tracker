/**
 * Isolated Scratch synthetic-only negative check of old Function action paths.
 * Checks authoritative HTTP 409 + exact error from the *active* Function
 * before any obsolete handler. No valid old-write payload is supplied: if
 * the fence is missing, the historical handlers must fail validation.
 *
 * Never convert an ambiguous error (including 409 with a different body)
 * into PASS. Stop immediately and do not retry an unexpected success.
 */
import { sendAppAction } from '../appAction';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../appwriteConfig';
import type { Owner } from './coreCrypto';
import type { FullyAuthenticatedSessionGate } from './accountRootLifecycle';

const PROJECT='6b00671500279e901846';
const ENDPOINT='https://129-221-244-67.sslip.io/v1';
const ERROR='Legacy action unavailable during encryption';
const ACTIONS=[
  'create_owner_row','compare_and_set_owner_row','reserve_media_upload',
] as const;
type Action=(typeof ACTIONS)[number];
export type LegacyFunctionProbeResult=Readonly<{
  outcome:'denied'|'unsafe'|'inconclusive';
  checked:number;total:3;action:Action|null;status:number|null;
}>;
function httpCode(err:unknown):number|null {
  if(!err || typeof err!=='object' || !('code' in err))return null;
  const code=(err as {code?:unknown}).code;
  return typeof code==='number' && Number.isSafeInteger(code) &&
    code>=400 && code<=599 ? code : null;
}
function exactDenial(err:unknown):boolean {
  if(!err || typeof err!=='object' || !('result' in err))return false;
  const body=(err as {result?:unknown}).result;
  return !!body && typeof body==='object' && !Array.isArray(body) &&
    Object.keys(body).length===1 && 'error' in body &&
    (body as {error?:unknown}).error===ERROR;
}
export async function probeLegacyFunctionActions(
  owner:Owner,gate:FullyAuthenticatedSessionGate,
):Promise<LegacyFunctionProbeResult> {
  if(APPWRITE_PROJECT_ID!==PROJECT || APPWRITE_ENDPOINT!==ENDPOINT ||
      owner?.projectId!==PROJECT || !owner.ownerId) {
    return {outcome:'inconclusive',checked:0,total:3,action:null,status:null};
  }
  let checked=0;
  for(const action of ACTIONS){
    await gate.assertReady(owner);
    try {
      // No tableId, rowId, file metadata, mutation body or valid old intent.
      // The old route would reject validation, not silently write canary data.
      await sendAppAction({action,ownerId:owner.ownerId},15000);
      return {outcome:'unsafe',checked,total:3,action,status:null};
    } catch(err) {
      const status=httpCode(err);
      if(status!==409 || !exactDenial(err)) {
        return {outcome:'inconclusive',checked,total:3,action,status};
      }
      checked++;
    }
  }
  return {outcome:'denied',checked:3,total:3,action:null,status:null};
}
