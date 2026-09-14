import {
  createRxDatabase,
  addRxPlugin,
  type RxDatabase,
  type RxCollection,
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import {
  tasksSchema,
  categoriesSchema,
  diarySchema,
  settingsSchema,
  friendshipsSchema,
  messagesSchema,
  type TaskDocument,
  type CategoryDocument,
  type DiaryDocument,
  type SettingsDocument,
  type FriendshipDocument,
  type MessageDocument,
} from './schema';

if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
  console.log('[RxDB] Dev Mode Plugin enabled (v17)');
}
addRxPlugin(RxDBMigrationSchemaPlugin);

const DB_NAME = 'life_tracker_db';
const DEBUG = import.meta.env.DEV;

export interface AppDatabaseCollections {
  tasks: RxCollection<TaskDocument>;
  categories: RxCollection<CategoryDocument>;
  diary: RxCollection<DiaryDocument>;
  settings: RxCollection<SettingsDocument>;
  friendships: RxCollection<FriendshipDocument>;
  messages: RxCollection<MessageDocument>;
}

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
      storage: wrappedValidateAjvStorage({
        storage: getRxStorageDexie(),
      }),
      multiInstance: true,
      eventReduce: true,
      ignoreDuplicate: true,
    });
    if (DEBUG) console.log('[RxDB] Database created successfully');

    await database.addCollections({
      tasks: {
        schema: tasksSchema,
        migrationStrategies: {
          1: (oldDoc) => oldDoc,
        },
      },
      categories: { schema: categoriesSchema },
      diary: { schema: diarySchema },
      settings: { schema: settingsSchema },
      friendships: {
        schema: friendshipsSchema,
        migrationStrategies: {
          1: (oldDoc) => ({ ...oldDoc, friendBio: '' }),
        },
      },
      messages: {
        schema: messagesSchema,
        migrationStrategies: {
          1: (oldDoc) => ({
            ...oldDoc,
            replyToId: '',
            replyToContent: '',
            replyToSenderId: '',
          }),
          2: (oldDoc) => ({
            ...oldDoc,
            isUnsent: false,
          }),
          3: (oldDoc) => ({
            ...oldDoc,
            originalMessageId: '',
            reactions: '',
          }),
        },
      },
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