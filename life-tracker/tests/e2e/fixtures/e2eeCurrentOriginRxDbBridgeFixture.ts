/**
 * Actual RxDB 17/Dexie data, not a hand-written mock row source.
 * Dedicated synthetic database and owner, never Mosaic's running database.
 */
import {createRxDatabase} from 'rxdb';
import {getRxStorageDexie} from 'rxdb/plugins/storage-dexie';
import {wrappedValidateAjvStorage} from 'rxdb/plugins/validate-ajv';
import type {RxDatabase} from 'rxdb';
import type {AppDatabaseCollections} from '../../../src/db/database';
import {
  LOCAL_OWNER_COLLECTIONS,
} from '../../../src/lib/e2ee/ownerOfflineRowSnapshot';
import {
  buildScratchCurrentOriginRescueFile,
} from '../../../src/lib/e2ee/ownerCurrentOriginRescueBridge';

export const RXDB_RESCUE_TEST_OWNER='synthetic_real_rxdexie_owner';
export const RXDB_RESCUE_TEST_ROOT=128;
export const RXDB_RESCUE_TEST_KEYID='k_'+'f'.repeat(32);

function schemaFor(name:string){
  const props:Record<string,unknown>={
    id:{type:'string',maxLength:255},
    userId:{type:'string',maxLength:255},
    isDeleted:{type:'boolean'},
  };
  if(name==='tasks'){
    props.title={type:'string'};props.date={type:'string'};
    props.visibility={type:'string'};
  }
  if(name==='diary'){
    props.content={type:'string'};props.date={type:'string'};
    props.visibility={type:'string'};
  }
  return {version:0,primaryKey:'id',type:'object',
    required:['id','userId','isDeleted'],
    properties:props,indexes:[['userId','isDeleted']]};
}

async function ensureImagesDatabase(){
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open('mosaic_pending_images',1);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains('images'))
        req.result.createObjectStore('images',{keyPath:'id'});
    };
    req.onerror=()=>reject(new Error('Synthetic pending image DB unavailable'));
    req.onsuccess=()=>resolve(req.result);
  });
  database.close();
}

export async function runActualRxDbEncryptedRescueFixture(){
  const db=await createRxDatabase({
    name:'mosaic_e2ee_full_rescue_'+crypto.randomUUID().replaceAll('-',''),
    storage:wrappedValidateAjvStorage({storage:getRxStorageDexie()}),multiInstance:false,
  });
  try{
    const collections=await db.addCollections(Object.fromEntries(
      LOCAL_OWNER_COLLECTIONS.map(name=>[name,{schema:schemaFor(name)}])
    ) as never);
    const tasks=collections.tasks,diary=collections.diary;
    const owner=RXDB_RESCUE_TEST_OWNER;
    await tasks.insert({id:'original_alive',userId:owner,isDeleted:false,
      title:'SECRET-RXDB-ALIVE',date:'2045-02-11',visibility:'private'});
    const gone=await tasks.insert({id:'original_deleted',userId:owner,isDeleted:false,
      title:'SECRET-RXDB-DELETED',date:'2045-02-12',visibility:'private'});
    await gone.remove(); // Genuine RxDB internal _deleted:true tombstone.
    await tasks.insert({id:'foreign_task',userId:'synthetic_foreign_account',
      isDeleted:false,title:'SECRET-FOREIGN-OWNER',date:'2045-02-13',
      visibility:'private'});
    await diary.insert({id:'original_diary',userId:owner,isDeleted:false,
      content:'SECRET-RXDB-DIARY',date:'2045-02-12',visibility:'private'});
    await ensureImagesDatabase(); // Existing zero-media store, never fake absence.
    const scope={projectId:'6b00671500279e901846',ownerId:owner};
    const root=new Uint8Array(32).fill(RXDB_RESCUE_TEST_ROOT);
    const keyId=RXDB_RESCUE_TEST_KEYID;
    let gateChecks=0;
    const gate={assertReady:async(o:{ownerId:string;projectId:string})=>{
      if(o.projectId!==scope.projectId||o.ownerId!==scope.ownerId)
        throw new Error('Synthetic unlocked owner/MFA unavailable');
      gateChecks++;
    }};
    const saved=await buildScratchCurrentOriginRescueFile(
      root,scope,keyId,gate,
      db as unknown as RxDatabase<AppDatabaseCollections>);
    const text=await saved.file.text();
    const secrets=['SECRET-RXDB-ALIVE','SECRET-RXDB-DELETED',
      'SECRET-RXDB-DIARY','SECRET-FOREIGN-OWNER','original_alive',
      'original_deleted','original_diary','foreign_task',owner,'2045-02-11'];
    if(saved.rows!==3||saved.media!==0||saved.pending!==0||
       secrets.some(secret=>text.includes(secret))||gateChecks<3)
      throw new Error('Untrusted, incomplete or plaintext synthetic rescue');
    const anchor=document.createElement('a');
    const url=URL.createObjectURL(saved.file);
    anchor.href=url;
    anchor.download=saved.filename;
    anchor.id='rxdb-e2ee-saved-file';
    anchor.textContent='Save real RxDB synthetic encrypted rescue';
    document.body.append(anchor);
    return {rows:saved.rows,media:saved.media,pending:saved.pending,
      name:saved.filename,bytes:saved.file.size,checks:gateChecks};
  }finally{
    await db.remove();
  }
}
