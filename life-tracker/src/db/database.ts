import {
  createRxDatabase,
  addRxPlugin,
  type RxDatabase,
  type RxCollection,
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import {
  tasksSchema,
  categoriesSchema,
  diarySchema,
  settingsSchema,
  friendshipsSchema,
  messagesSchema,
  syncMetaSchema,
  type TaskDocument,
  type CategoryDocument,
  type DiaryDocument,
  type SettingsDocument,
  type FriendshipDocument,
  type MessageDocument,
  type SyncMetaDocument,
} from './schema';
import { markStartup } from '../lib/startupMetrics';
import {
  tasksMigrationStrategies,
  friendshipsMigrationStrategies,
  messagesMigrationStrategies,
  categoriesMigrationStrategies,
  settingsMigrationStrategies,
  syncMetaMigrationStrategies,
} from './migrations';
addRxPlugin(RxDBMigrationSchemaPlugin);

let devModePluginPromise: Promise<void> | null = null;

async function ensureDevModePlugin(): Promise<void> {
  if (!import.meta.env.DEV) return;
  devModePluginPromise ??= import('rxdb/plugins/dev-mode').then(
    ({ RxDBDevModePlugin }) => {
      addRxPlugin(RxDBDevModePlugin);
      console.log('[RxDB] Dev Mode Plugin enabled (v17)');
    }
  );
  await devModePluginPromise;
}
const DB_NAME = 'life_tracker_db';
const DEBUG = import.meta.env.DEV;
export interface AppDatabaseCollections {
  tasks: RxCollection<TaskDocument>;
  categories: RxCollection<CategoryDocument>;
  diary: RxCollection<DiaryDocument>;
  settings: RxCollection<SettingsDocument>;
  friendships: RxCollection<FriendshipDocument>;
  messages: RxCollection<MessageDocument>;
  syncMeta: RxCollection<SyncMetaDocument>;
}
let dbInstance: RxDatabase<AppDatabaseCollections> | null = null;
let dbInitPromise: Promise<RxDatabase<AppDatabaseCollections>> | null = null;

async function createDatabaseInstance(): Promise<RxDatabase<AppDatabaseCollections>> {
  let database: RxDatabase<AppDatabaseCollections> | null = null;
  try {
    if (DEBUG) console.log('[RxDB] Initializing database:', DB_NAME);
    await ensureDevModePlugin();
    markStartup('database:create-start');
    database = await createRxDatabase<AppDatabaseCollections>({
      name: DB_NAME,
      storage: wrappedValidateAjvStorage({
        storage: getRxStorageDexie(),
      }),
      multiInstance: true,
      eventReduce: true,
      ignoreDuplicate: import.meta.env.DEV,
    });
    markStartup('database:create-ready');
    if (DEBUG) console.log('[RxDB] Database created successfully');
    markStartup('database:collections-start');
    await database.addCollections({
      tasks: {
        schema: tasksSchema,
        migrationStrategies: tasksMigrationStrategies,
      },
      categories: {
        schema: categoriesSchema,
        migrationStrategies: categoriesMigrationStrategies,
      },
      diary: { schema: diarySchema },
      settings: {
        schema: settingsSchema,
        migrationStrategies: settingsMigrationStrategies,
      },
      friendships: {
        schema: friendshipsSchema,
        migrationStrategies: friendshipsMigrationStrategies,
      },
      messages: {
        schema: messagesSchema,
        migrationStrategies: messagesMigrationStrategies,
      },
      syncMeta: {
        schema: syncMetaSchema,
        migrationStrategies: syncMetaMigrationStrategies,
      },
    });
    markStartup('database:collections-ready');
    if (DEBUG) console.log('[RxDB] Collections added successfully');
    if (DEBUG) {
      const stats = await getDatabaseStats(database);
      console.log('[RxDB] Initial stats:', stats);
    }
    dbInstance = database;
    return database;
  } catch (error) {
    if (database) {
      try {
        await database.close();
      } catch (closeError) {
        console.warn('[RxDB] Failed to close partial database instance', closeError);
      }
    }
    console.error('[RxDB] FATAL: Database initialization failed', error);
    throw error;
  }
}

export async function initializeDatabase(): Promise<RxDatabase<AppDatabaseCollections>> {
  if (dbInstance) {
    if (DEBUG) console.log('[RxDB] Using existing database instance');
    return dbInstance;
  }
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = createDatabaseInstance();
  try {
    return await dbInitPromise;
  } finally {
    dbInitPromise = null;
  }
}

interface DatabaseRetryOptions {
  attempts?: number;
  delayMs?: number;
  initialize?: () => Promise<RxDatabase<AppDatabaseCollections>>;
  sleep?: (ms: number) => Promise<void>;
}

export async function initializeDatabaseWithRetry({
  attempts = 3,
  delayMs = 300,
  initialize = initializeDatabase,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: DatabaseRetryOptions = {}): Promise<RxDatabase<AppDatabaseCollections>> {
  let lastError: unknown;
  const maxAttempts = Math.max(1, attempts);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await initialize();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await sleep(delayMs * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Database initialization failed');
}

export function getDatabase(): RxDatabase<AppDatabaseCollections> {
  if (!dbInstance) {
    throw new Error('Database not initialized! Call initializeDatabase() first.');
  }
  return dbInstance;
}
export async function purgeAccountFromDatabase(
  userId: string,
  database: RxDatabase<AppDatabaseCollections> = getDatabase()
): Promise<void> {
  if (!userId) return;
  const collections = [
    database.tasks,
    database.categories,
    database.diary,
    database.settings,
    database.friendships,
    database.messages,
    database.syncMeta,
  ] as const;

  for (const collection of collections) {
    const docs = await collection.find({ selector: { userId } }).exec();
    await Promise.all(docs.map((doc) => doc.remove()));
  }
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
  const [tasks, categories, diary, settings, friendships, messages] = await Promise.all([
    database.tasks.count().exec(),
    database.categories.count().exec(),
    database.diary.count().exec(),
    database.settings.count().exec(),
    database.friendships.count().exec(),
    database.messages.count().exec(),
  ]);
  return { tasks, categories, diary, settings, friendships, messages };
}
