import { 
  createRxDatabase, 
  addRxPlugin, 
  type RxDatabase, 
  type RxCollection 
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'; // <-- NEW IMPORT
import { 
  tasksSchema, 
  categoriesSchema, 
  diarySchema, 
  settingsSchema,
  type TaskDocument,
  type CategoryDocument,
  type DiaryDocument,
  type SettingsDocument,
} from './schema';

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
  console.log('[RxDB] Dev Mode Plugin enabled (v17)');
}

const DB_NAME = 'life_tracker_db';
const DEBUG = import.meta.env.DEV;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AppDatabaseCollections {
  tasks: RxCollection<TaskDocument>;
  categories: RxCollection<CategoryDocument>;
  diary: RxCollection<DiaryDocument>;
  settings: RxCollection<SettingsDocument>;
}

// ============================================================================
// DATABASE INSTANCE
// ============================================================================

let dbInstance: RxDatabase<AppDatabaseCollections> | null = null;

export async function initializeDatabase(): Promise<RxDatabase<AppDatabaseCollections>> {
  if (dbInstance) {
    if (DEBUG) console.log('[RxDB] Using existing database instance');
    return dbInstance;
  }

  try {
    if (DEBUG) console.log('[RxDB] Initializing database:', DB_NAME);

    const database = await createRxDatabase<AppDatabaseCollections>({
      name: DB_NAME,
      // FIX: Wrap storage with Ajv validator to satisfy dev-mode requirements
      storage: wrappedValidateAjvStorage({
        storage: getRxStorageDexie()
      }),
      multiInstance: true,
      eventReduce: true,
      ignoreDuplicate: true,
    });

    if (DEBUG) console.log('[RxDB] Database created successfully');

    await database.addCollections({
      tasks: { schema: tasksSchema },
      categories: { schema: categoriesSchema },
      diary: { schema: diarySchema },
      settings: { schema: settingsSchema },
    });

    if (DEBUG) {
      console.log('[RxDB] Collections added successfully');
      const stats = await getDatabaseStats(database);
      console.log('[RxDB] Initial stats:', stats);
    }

    dbInstance = database;
    return dbInstance;

  } catch (error) {
    console.error('[RxDB] FATAL: Database initialization failed', error);
    throw error;
  }
}

export function getDatabase(): RxDatabase<AppDatabaseCollections> {
  if (!dbInstance) {
    throw new Error('Database not initialized! Call initializeDatabase() first.');
  }
  return dbInstance;
}

export async function destroyDatabase(): Promise<void> {
  if (!dbInstance) return;
  try {
    if (DEBUG) console.log('[RxDB] Destroying database instance');
    await dbInstance.remove();
    dbInstance = null;
  } catch (error) {
    console.error('[RxDB] Error destroying database', error);
    throw error;
  }
}

export async function getDatabaseStats(db?: RxDatabase<AppDatabaseCollections>) {
  const database = db || getDatabase();
  const [tasks, categories, diary, settings] = await Promise.all([
    database.tasks.count().exec(),
    database.categories.count().exec(),
    database.diary.count().exec(),
    database.settings.count().exec(),
  ]);
  return { tasks, categories, diary, settings };
}