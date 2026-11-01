import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { categoriesMigrationStrategies, tasksMigrationStrategies } from '../db/migrations';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { tasksSchema, categoriesSchema, type TaskDocument, type CategoryDocument } from '../db/schema';
import { DEMO_DB_NAME, DEMO_OWNER, makeDemoFixtures } from './fixtures';

addRxPlugin(RxDBMigrationSchemaPlugin);

const metaSchema = {
  title:'Demo metadata',version:0,primaryKey:'id',type:'object',
  required:['id','anchor'],properties:{id:{type:'string',maxLength:40},anchor:{type:'string',maxLength:30}},
} as const;
interface Meta {id:string;anchor:string}
export interface DemoCollections {
  tasks: RxCollection<TaskDocument>;
  categories: RxCollection<CategoryDocument>;
  metadata: RxCollection<Meta>;
}
export type DemoDatabase = RxDatabase<DemoCollections>;
let connection:Promise<DemoDatabase>|null=null;
function anchorToday():string {
  const date = new Date();
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function anchorDate(key:string):Date {
  const [y,m,d]=key.split('-').map(Number);
  return new Date(y,m-1,d);
}
async function populate(db:DemoDatabase,anchor:string) {
  const {tasks,categories}=makeDemoFixtures(anchorDate(anchor));
  await db.categories.bulkInsert(categories);
  await db.tasks.bulkInsert(tasks);
}
async function initialize():Promise<DemoDatabase> {
  const db=await createRxDatabase<DemoCollections>({name:DEMO_DB_NAME,storage:getRxStorageDexie(),multiInstance:true,eventReduce:true});
  try {
    await db.addCollections({
      tasks:{schema:tasksSchema,migrationStrategies:tasksMigrationStrategies},
      categories:{schema:categoriesSchema,migrationStrategies:categoriesMigrationStrategies},
      metadata:{schema:metaSchema},
    });
    // The metadata row survives user deletions. An existing demo is never automatically reseeded.
    const initialized=await db.metadata.findOne('initial').exec();
    if(!initialized){
      const anchor=anchorToday();
      await populate(db,anchor);
      await db.metadata.insert({id:'initial',anchor});
    }
    return db;
  } catch(e){await db.close();throw e;}
}
export function getDemoDatabase() {
  connection ??= initialize().catch(e=>{connection=null;throw e;});
  return connection;
}
export async function resetDemo(db:DemoDatabase) {
  // Strictly limited to demo DB. No origin-wide deletion or SW cache changes.
  await db.tasks.find().remove();
  await db.categories.find().remove();
  const anchor=anchorToday();
  await populate(db,anchor);
  const row=await db.metadata.findOne('initial').exec();
  if(row)await row.patch({anchor});
  else await db.metadata.insert({id:'initial',anchor});
}
export function newDemoTask(title:string,date:string,categoryId:string,order:number):TaskDocument {
  const timestamp=new Date().toISOString();
  return {id:'demo_user_'+crypto.randomUUID().replaceAll('-',''),userId:DEMO_OWNER,
    title,date,categoryId,completed:false,completedAt:'',order,
    isDeleted:false,visibility:'private',createdAt:timestamp,updatedAt:timestamp};
}
