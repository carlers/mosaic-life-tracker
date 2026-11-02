/** Separate local-only RxDB facade for production Mosaic UI in Demo Mode. */
import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { tasksSchema, categoriesSchema, diarySchema, settingsSchema, bucketListSchema, bucketTaskLinksSchema, friendshipsSchema, messagesSchema, syncMetaSchema,
 type TaskDocument, type CategoryDocument, type DiaryDocument, type SettingsDocument, type BucketListDocument, type BucketTaskLinkDocument, type FriendshipDocument, type MessageDocument, type SyncMetaDocument } from '../db/schema';
import { tasksMigrationStrategies, categoriesMigrationStrategies, diaryMigrationStrategies, settingsMigrationStrategies, friendshipsMigrationStrategies, messagesMigrationStrategies, syncMetaMigrationStrategies } from '../db/migrations';
import { DEMO_DB_NAME, DEMO_OWNER, makeDemoFixtures } from './fixtures';
import { makeThreadId } from '../lib/threads';
addRxPlugin(RxDBMigrationSchemaPlugin);
export interface AppDatabaseCollections {
 tasks:RxCollection<TaskDocument>;categories:RxCollection<CategoryDocument>;
 diary:RxCollection<DiaryDocument>;settings:RxCollection<SettingsDocument>;
 bucketList:RxCollection<BucketListDocument>;bucketTaskLinks:RxCollection<BucketTaskLinkDocument>;
 friendships:RxCollection<FriendshipDocument>;messages:RxCollection<MessageDocument>;syncMeta:RxCollection<SyncMetaDocument>;
}
interface DemoMeta {id:string;anchor:string}
const metaSchema={title:'Local demo initialization',version:0,primaryKey:'id',type:'object',required:['id','anchor'],properties:{id:{type:'string',maxLength:40},anchor:{type:'string',maxLength:35}}} as const;
type DemoDatabase=RxDatabase<AppDatabaseCollections & {demoMeta:RxCollection<DemoMeta>}>;
let database:DemoDatabase|null=null;
let opening:Promise<RxDatabase<AppDatabaseCollections>>|null=null;
const localDateKey=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
async function seed(db:DemoDatabase, anchor:Date) {
 const {tasks,categories}=makeDemoFixtures(anchor);
 const date=localDateKey(anchor),now=new Date().toISOString();
 await db.categories.bulkInsert(categories);await db.tasks.bulkInsert(tasks);
 await db.diary.insert({id:'demo_diary_today',userId:DEMO_OWNER,date,content:'A few notes from a fictional day in Mosaic.',
 visibility:'private',isDeleted:false,createdAt:now,updatedAt:now,emoji:'📓',photos:'[]'});
 await db.bucketList.insert({id:'demo_bucket_one',userId:DEMO_OWNER,title:'Explore a new place',description:'A fictional goal to try the bucket list.',
 achieved:false,achievedAt:'',isDeleted:false,createdAt:now,updatedAt:now});
 const friends=[
  {id:'demo_friendship_ava',friendId:'demo_friend_ava',friendUsername:'ava-demo',friendDisplayName:'Ava (demo)',friendBio:'Fictional classmate and study buddy'},
  {id:'demo_friendship_lee',friendId:'demo_friend_lee',friendUsername:'lee-demo',friendDisplayName:'Lee (demo)',friendBio:'Fictional developer and project collaborator'},
 ];
 await db.friendships.bulkInsert(friends.map(f=>({
  ...f,userId:DEMO_OWNER,friendAvatarFileId:'',status:'accepted' as const,
  createdAt:now,updatedAt:now,isDeleted:false,
 })));
 const messages=[
  {id:'demo_message_ava_in',friendId:'demo_friend_ava',threadId:'demo_thread_ava',direction:'incoming' as const,
   content:'Want to review our fictional physics notes together?',minutes:16},
  {id:'demo_message_ava_out',friendId:'demo_friend_ava',threadId:'demo_thread_ava',direction:'outgoing' as const,
   content:'Sure! I will put a study session on my calendar.',minutes:13},
  {id:'demo_message_lee_in',friendId:'demo_friend_lee',threadId:'demo_thread_lee',direction:'incoming' as const,
   content:'The demo UI is looking good. Shall we check the task flow?',minutes:9},
 ];
 const threadIds=new Map(await Promise.all(
  friends.map(async f=>[f.friendId,await makeThreadId(DEMO_OWNER,f.friendId)] as const)
 ));
 await db.messages.bulkInsert(messages.map(m=>{
  const timestamp=new Date(anchor.getTime()-m.minutes*60_000).toISOString();
  return {
   id:m.id,userId:DEMO_OWNER,threadId:threadIds.get(m.friendId)!,
   senderId:m.direction==='incoming'?m.friendId:DEMO_OWNER,
   recipientId:m.direction==='incoming'?DEMO_OWNER:m.friendId,
   direction:m.direction,content:m.content,taskRefId:'',taskRefTitle:'',taskRefDate:'',taskRefColor:'',
   replyToId:'',replyToContent:'',replyToSenderId:'',isUnsent:false,originalMessageId:'',reactions:'',
   readAt:timestamp,deliveryStatus:'delivered' as const,createdAt:timestamp,updatedAt:timestamp,isDeleted:false,
  };
 }));
}
async function open():Promise<RxDatabase<AppDatabaseCollections>>{
 const db=await createRxDatabase<AppDatabaseCollections & {demoMeta:RxCollection<DemoMeta>}>({name:DEMO_DB_NAME,storage:getRxStorageDexie(),multiInstance:true,eventReduce:true});
 try {
 await db.addCollections({
 tasks:{schema:tasksSchema,migrationStrategies:tasksMigrationStrategies},
 categories:{schema:categoriesSchema,migrationStrategies:categoriesMigrationStrategies},
 diary:{schema:diarySchema,migrationStrategies:diaryMigrationStrategies},
 settings:{schema:settingsSchema,migrationStrategies:settingsMigrationStrategies},
 bucketList:{schema:bucketListSchema},bucketTaskLinks:{schema:bucketTaskLinksSchema},
 friendships:{schema:friendshipsSchema,migrationStrategies:friendshipsMigrationStrategies},
 messages:{schema:messagesSchema,migrationStrategies:messagesMigrationStrategies},
 syncMeta:{schema:syncMetaSchema,migrationStrategies:syncMetaMigrationStrategies},
 demoMeta:{schema:metaSchema},
 });
 if(!(await db.demoMeta.findOne('seed').exec())){
  const today=new Date();await seed(db,today);await db.demoMeta.insert({id:'seed',anchor:localDateKey(today)});
 }
 database=db;return db as unknown as RxDatabase<AppDatabaseCollections>;
 }catch(e){await db.close();throw e;}
}
export function initializeDatabase():Promise<RxDatabase<AppDatabaseCollections>>{
 opening ??= open().catch(e=>{opening=null;throw e;});return opening;
}
export function initializeDatabaseWithRetry():Promise<RxDatabase<AppDatabaseCollections>>{return initializeDatabase();}
export function getDatabase():RxDatabase<AppDatabaseCollections>{
 if(!database)throw Error('Demo database not ready');return database as unknown as RxDatabase<AppDatabaseCollections>;
}
export async function resetDemoDatabase(){
 const db=await initializeDatabase() as unknown as DemoDatabase;
 for(const key of ['tasks','categories','diary','settings','bucketList','bucketTaskLinks','friendships','messages','syncMeta'] as const){
  await db[key].find().remove();
 }
 const now=new Date();try{localStorage.clear();}catch{/* RxDB reset still proceeds. */}await seed(db,now);
 const meta=await db.demoMeta.findOne('seed').exec();if(meta)await meta.patch({anchor:localDateKey(now)});
}
export async function purgeAccountFromDatabase(userId:string) {if(userId===DEMO_OWNER)await resetDemoDatabase();}
export async function destroyDatabase() {if(database){await database.close();database=null;opening=null;}}
export async function getDatabaseStats(){
 if(!database)return null;
 const [tasks,categories,diary,settings]=await Promise.all([database.tasks,database.categories,database.diary,database.settings].map(c=>c.find().exec().then(a=>a.length)));
 return {tasks,categories,diary,settings};
}
