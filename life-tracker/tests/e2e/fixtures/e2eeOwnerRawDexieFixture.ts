/**
 * Synthetic ONLY: temporary separate Dexie database in a localhost browser.
 * No Appwrite calls, real Mosaic account data or durable restore/import.
 */
import {createRxDatabase} from 'rxdb';
import {getRxStorageDexie} from 'rxdb/plugins/storage-dexie';
import {readOwnerRawStorageRows} from '../../../src/lib/e2ee/ownerRawStorageRead';

export async function runOwnerRawDexieFixture(){
    const name='mosaic_e2ee_raw_'+crypto.randomUUID().replaceAll('-','');
    const db=await createRxDatabase({name,storage:getRxStorageDexie(),multiInstance:false});
    try{
      const schema={version:0,primaryKey:'id',type:'object',
        properties:{id:{type:'string',maxLength:80},
          userId:{type:'string'},isDeleted:{type:'boolean'},
          title:{type:'string'}},
        required:['id','userId','isDeleted'],indexes:[['userId','isDeleted']]};
      const collections=await db.addCollections({items:{schema}});
      const items=collections.items;
      await items.insert({id:'alive',userId:'synthetic_A',
        isDeleted:false,title:'SECRET-ALIVE'});
      const gone=await items.insert({id:'gone',userId:'synthetic_A',
        isDeleted:false,title:'SECRET-GONE'});
      await gone.remove();
      await items.insert({id:'other',userId:'synthetic_B',
        isDeleted:false,title:'SECRET-FOREIGN'});
      const local=await readOwnerRawStorageRows(items.storageInstance,'synthetic_A');
      const foreign=await readOwnerRawStorageRows(items.storageInstance,'synthetic_B');
      return {rows:local.map(x=>({id:x.id,deleted:x._deleted,rev:!!x._rev,
        meta:!!x._meta&&typeof x._meta.lwt==='number',title:x.title})),
        foreign:foreign.map(x=>x.id)};
    }finally{await db.remove();}
}
