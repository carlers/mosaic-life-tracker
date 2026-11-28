/**
 * READ-ONLY, pure planning for a separately approved, source-pinned,
 * isolated Scratch owner v2 additive schema migration.
 *
 * No Appwrite client/API key, POST/PATCH/DELETE, CLI, default migration
 * registration or automatic apply exists here. The privileged Oracle
 * operator must later attest installed runtime and revalidate each planned
 * action against exact reviewed Git SHA, ACL, CI and trusted project ID.
 */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {OWNER_PRIVATE_V2_SCRATCH_TABLE:expected}=require(
  '../appwrite-functions/message-action/e2ee-owner-v2-schema.js');
const PROJECT='6b00671500279e901846';
const DB='life_tracker';
const PRIOR=['account_crypto_roots_v2','private_owner_ciphertexts_v1'];
const PATH='/tablesdb/'+DB+'/tables/';
const BLOCK='Scratch owner-v2 schema provisioning plan denied: ';
function denied(reason){throw new Error(BLOCK+reason);}
function exactTable(table,id){
  if(!table||table.$id!==id||table.rowSecurity!==true||
     table.enabled!==true||!Array.isArray(table.$permissions)||
     table.$permissions.length!==0)denied('owner-only table ACL or metadata drift');
}
function compareColumn(have,want){
  if(!have||have.key!==want.key||have.type!==want.type||
     have.required!==want.required||
     (want.size!==undefined&&have.size!==want.size)||
     (want.size===undefined&&have.size!==undefined&&have.size!==null)||
     (have.status!==undefined&&have.status!=='available'))
    denied('existing column mismatch or not yet available');
}
function compareIndex(have,want){
  if(!have||have.key!==want.key||have.type!==want.type||
     JSON.stringify(have.attributes??have.columns)!==
       JSON.stringify(want.attributes)||
     (have.status!==undefined&&have.status!=='available'))
    denied('existing index drift or not yet available');
}
function expectedOnly(actual,allowed,kind){
  if(!Array.isArray(actual))denied(kind+' inventory missing');
  const mapped=new Map();
  for(const item of actual){
    if(!item||typeof item.key!=='string'||mapped.has(item.key)||
       !allowed.some(want=>want.key===item.key))
      denied(kind+' has extra or duplicate entry');
    mapped.set(item.key,item);
  }
  return mapped;
}
async function get(request,path){
  try{return await request('GET',path);}
  catch(err){
    if(Number(err?.status)===404||Number(err?.code)===404)return null;
    denied('read-only backend inventory unavailable');
  }
}
/**
 * Handles absent and compatible partially provisioned v2 tables as plans.
 * Malformed, unexpectedly public, differently typed, extra or still-processing
 * state MUST be resolved through review, never auto-deleted or "fixed".
 *
 * Return value is data only. It is NOT permission to apply or activate a
 * Function; operations MUST be applied by an independently gated operator.
 */
export async function planScratchOwnerV2Schema({projectId,databaseId=DB,request}){
  if(projectId!==PROJECT||databaseId!==DB||typeof request!=='function')
    denied('wrong isolated target or missing read-only capability');
  for(const id of PRIOR){
    const table=await get(request,PATH+id);
    exactTable(table,id);
  }
  const current=await get(request,PATH+expected.id);
  if(current)exactTable(current,expected.id);
  const existingCols=current
    ?expectedOnly(current.columns,expected.columns,'columns'):new Map();
  const existingIndexes=current
    ?expectedOnly(current.indexes,expected.indexes,'indexes'):new Map();
  const ops=[];
  if(!current)ops.push(Object.freeze({
    action:'create_table',tableId:expected.id,name:expected.name,
    rowSecurity:true,enabled:true,permissions:Object.freeze([]),
  }));
  for(const column of expected.columns){
    const old=existingCols.get(column.key);
    if(old){compareColumn(old,column);continue;}
    ops.push(Object.freeze({
      action:'create_column',tableId:expected.id,
      column:Object.freeze({...column}),
    }));
  }
  for(const index of expected.indexes){
    const old=existingIndexes.get(index.key);
    if(old){compareIndex(old,index);continue;}
    // No index may be applied while the preceding column operations have not
    // completed and been read back as available. This ordering is a plan only.
    ops.push(Object.freeze({
      action:'create_index',tableId:expected.id,
      index:Object.freeze({...index,attributes:Object.freeze([...index.attributes])}),
    }));
  }
  return Object.freeze({
    projectId:PROJECT,databaseId:DB,tableId:expected.id,
    observed:current?'EXISTING':'ABSENT',
    state:ops.length?'REVIEW_REQUIRED_NOT_APPLIED':'SCHEMA_MATCHES_READ_ONLY',
    writes:0,operations:Object.freeze(ops),
  });
}
