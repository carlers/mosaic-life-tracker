/**
 * Isolated Scratch M2-only negative SDK access, dynamically reached through
 * the hidden E2EE test page. Normal sdk.ts remains byte-identical to dev;
 * this separate SDK adapter prevents 401-as-permission-denial from triggering
 * the global auth:unauthorized event. Never import in normal app sync.
 *
 * Strict client/project/endpoint/table/file/opaque-ID/permission allowlists;
 * a successful direct legacy write is always a TEST FAILURE, not a feature.
 */
import { Storage, TablesDB } from 'appwrite';
import { client } from './appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './appwriteConfig';

const tables=new TablesDB(client);
const storage=new Storage(client);
const ALLOWED=new Set([
  'tasks','categories','diary','settings','bucket_list_items','bucket_task_links',
]);
function validId(id:string):boolean {
  return APPWRITE_PROJECT_ID==='6b00671500279e901846' &&
    APPWRITE_ENDPOINT==='https://129-221-244-67.sslip.io/v1' &&
    /^m2canary_[a-f0-9]{24}$/.test(id);
}
type SyntheticRow = {
  databaseId:string;tableId:string;rowId:string;
  data:Record<string,unknown>;permissions:string[];
};
type SyntheticFile = {
  bucketId:string;fileId:string;file:File;permissions:string[];
};
function deny():never {
  throw new Error('Isolated synthetic legacy ACL probe rejected.');
}
export const scratchLegacyAclProbe={
  createRow: async(p:SyntheticRow) => {
    if(p.databaseId!=='life_tracker' || !ALLOWED.has(p.tableId) ||
       !validId(p.rowId) || !Array.isArray(p.permissions) ||
       p.permissions.length!==0 || typeof p.data.user_id!=='string' ||
       !p.data.user_id || Object.keys(p.data).length>8) deny();
    return tables.createRow(p as never);
  },
  createFile: async(p:SyntheticFile) => {
    if(p.bucketId!=='task_images' || !validId(p.fileId) ||
       !Array.isArray(p.permissions) || p.permissions.length!==0 ||
       p.file.name!=='m2-synthetic-denial.png' ||
       p.file.type!=='image/png' || p.file.size>1024) deny();
    return storage.createFile(p as never);
  },
};
