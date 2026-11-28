/**
 * Source-only, GET-only additive root-generation claim schema planner.
 * DISABLED isolated Scratch table, never a deployed CAS or an installer.
 * No Appwrite SDK, credential, POST, row write, migration registration or CLI.
 * The future signed Oracle worker must separately pin actual host/runtime,
 * approve and apply actions, attest index/ACL readback, then independently
 * prove real two-client transaction exclusivity before any Function wiring.
 */
import {createRequire} from 'node:module';
import {planScratchOwnerV2Schema} from './e2ee-owner-v2-provision-plan.mjs';
const require=createRequire(import.meta.url);
const {SCRATCH_OWNER_ROOT_EPOCH_CLAIMS:expected}=require(
  '../appwrite-functions/message-action/e2ee-root-epoch-claim-schema.js');
const PROJECT='6b00671500279e901846',DATABASE='life_tracker';
const PATH='/tablesdb/'+DATABASE+'/tables/';
const PRIOR=['account_crypto_roots_v2','private_owner_ciphertexts_v1'];
function denied(){throw new Error('Disabled Scratch root claim schema planning blocked.');}
function secureTable(table,id,enabled){
  if(!table||table.$id!==id||table.rowSecurity!==true||
     table.enabled!==enabled||!Array.isArray(table.$permissions)||
     table.$permissions.length!==0)denied();
}
function dictionary(items,expectedItems){
  if(!Array.isArray(items)||items.length>expectedItems.length)denied();
  const names=new Set(expectedItems.map(x=>x.key)),out=new Map();
  for(const item of items){
    if(!item||typeof item.key!=='string'||!names.has(item.key)||
       out.has(item.key)||item.status&&item.status!=='available')denied();
    out.set(item.key,item);
  }
  return out;
}
function matchesColumn(have,want){
  if(have.type!==want.type||have.required!==want.required||
     (want.size===undefined?
       (have.size!==undefined&&have.size!==null):have.size!==want.size))denied();
}
function matchesIndex(have,want){
  if(have.type!==want.type||
     JSON.stringify(have.attributes??have.columns)!==
     JSON.stringify(want.attributes))denied();
}
async function read(request,id,optional=false){
  try{return await request('GET',PATH+id);}
  catch(e){
    if(optional&&(Number(e?.status)===404||Number(e?.code)===404))return null;
    denied();
  }
}
/** No status here ever grants permission to activate a root transaction. */
export async function planScratchRootClaimSchema({
  projectId,databaseId=DATABASE,request,
}){
  if(projectId!==PROJECT||databaseId!==DATABASE||
     typeof request!=='function'||expected.projectId!==PROJECT||
     expected.enabled!==false||expected.rowSecurity!==true||
     expected.permissions.length!==0)denied();
  for(const id of PRIOR)secureTable(await read(request,id),id,true);
  const current=await read(request,expected.id,true);
  if(current)secureTable(current,expected.id,false);
  const columns=current
    ?dictionary(current.columns,expected.columns):new Map();
  const indexes=current
    ?dictionary(current.indexes,expected.indexes):new Map();
  const operations=[];
  if(!current)operations.push(Object.freeze({
    action:'create_table',tableId:expected.id,name:expected.name,
    permissions:Object.freeze([]),rowSecurity:true,enabled:false,
  }));
  for(const column of expected.columns){
    const present=columns.get(column.key);
    if(present){matchesColumn(present,column);continue;}
    operations.push(Object.freeze({
      action:'create_column',tableId:expected.id,
      column:Object.freeze({...column}),
    }));
  }
  for(const index of expected.indexes){
    const present=indexes.get(index.key);
    if(present){matchesIndex(present,index);continue;}
    operations.push(Object.freeze({
      action:'create_index',tableId:expected.id,
      index:Object.freeze({...index,
        attributes:Object.freeze([...index.attributes])}),
    }));
  }
  return Object.freeze({
    projectId:PROJECT,databaseId:DATABASE,tableId:expected.id,
    observed:current?'EXISTING_DISABLED':'ABSENT',
    status:operations.length?
      'REVIEW_REQUIRED_NOT_APPLIED':'SCHEMA_MATCHES_DISABLED_NOT_READY',
    enabled:false,writes:0,operations:Object.freeze(operations),
  });
}
/** One read-only package for the two separate v2 migration tables. */
export async function planScratchV2WithRootClaim(args){
  const [ownerV2,rootClaim]=await Promise.all([
    planScratchOwnerV2Schema(args),planScratchRootClaimSchema(args),
  ]);
  if(ownerV2.projectId!==PROJECT||rootClaim.projectId!==PROJECT||
     ownerV2.databaseId!==DATABASE||rootClaim.databaseId!==DATABASE)denied();
  return Object.freeze({
    projectId:PROJECT,databaseId:DATABASE,
    status:'TWO_SCHEMAS_REVIEW_ONLY_NOT_RUNTIME_READY',
    writes:0,ownerV2,rootClaim,
    operations:Object.freeze([...ownerV2.operations,...rootClaim.operations]),
  });
}
