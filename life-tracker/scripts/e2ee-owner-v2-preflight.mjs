/**
 * Source-only V2 Scratch schema readback preflight; read-only by design.
 * NO registration in normal migrations or invocation from an active Function.
 * Not a compatibility proof for historical PWA, migration or sealed accounts.
 */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {OWNER_PRIVATE_V2_SCRATCH_TABLE: expected}=require(
  '../appwrite-functions/message-action/e2ee-owner-v2-schema.js');
const PROJECT='6b00671500279e901846';
const DATABASE='life_tracker';
const PRIOR=['private_owner_ciphertexts_v1','account_crypto_roots_v2'];
function block(reason){throw new Error('V2 Scratch read-only preflight blocked: '+reason);}
function secureTable(actual,id){
  if(!actual||actual.$id!==id||actual.rowSecurity!==true||
     actual.enabled!==true||!Array.isArray(actual.$permissions)||
     actual.$permissions.length!==0)block('existing owner ACL/schema mismatch');
}
function metadata(actual){
  secureTable(actual,expected.id);
  const cols=actual.columns;
  if(!Array.isArray(cols)||cols.length!==expected.columns.length)
    block('v2 column count mismatch');
  const unique=new Map(cols.map(c=>[c.key,c]));
  if(unique.size!==cols.length)block('duplicate v2 columns');
  for(const want of expected.columns){
    const have=unique.get(want.key);
    if(!have||have.type!==want.type||have.required!==want.required||
       (want.size&&have.size!==want.size))block('v2 private column mismatch');
  }
  const indexes=actual.indexes;
  if(!Array.isArray(indexes)||indexes.length!==expected.indexes.length)
    block('v2 index count mismatch');
  const uniq=new Map(indexes.map(i=>[i.key,i]));
  if(uniq.size!==indexes.length)block('duplicate v2 indexes');
  for(const want of expected.indexes){
    const have=uniq.get(want.key);
    if(!have||have.type!==want.type||
       JSON.stringify(have.attributes??have.columns)!==
       JSON.stringify(want.attributes))block('v2 index mismatch');
  }
}
/**
 * Returns "missing" rather than pretending v2 is ready if not provisioned.
 * Request injection never receives POST/PATCH/DELETE from this function.
 */
export async function inspectOwnerV2ScratchSchema({projectId,request,
    databaseId=DATABASE}){
  if(projectId!==PROJECT||databaseId!==DATABASE||typeof request!=='function')
    block('wrong project/database or missing read-only connector');
  const path='/tablesdb/'+databaseId+'/tables/';
  for(const id of PRIOR){
    let result;
    try{result=await request('GET',path+id);}
    catch{block('v1 owner table/root readback unavailable');}
    secureTable(result,id);
  }
  let v2;
  try{v2=await request('GET',path+expected.id);}
  catch(e){
    if(Number(e?.status)===404||Number(e?.code)===404)
      return Object.freeze({
        projectId:PROJECT,table:expected.id,
        phase:'MISSING',status:'NOT_PROVISIONED',writes:0,
      });
    block('v2 readback unavailable');
  }
  metadata(v2);
  return Object.freeze({
    projectId:PROJECT,table:expected.id,
    phase:'EXISTING',status:'SCHEMA_ACL_VERIFIED',writes:0,
  });
}
