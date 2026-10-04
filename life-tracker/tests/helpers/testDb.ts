import {
  addRxPlugin,
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
} from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
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
} from '../../src/db/schema';
import {
  tasksMigrationStrategies,
  friendshipsMigrationStrategies,
  messagesMigrationStrategies,
  categoriesMigrationStrategies,
  settingsMigrationStrategies,
  syncMetaMigrationStrategies,
} from '../../src/db/migrations';
export interface TestDatabaseCollections {
  tasks: RxCollection<TaskDocument>;
  categories: RxCollection<CategoryDocument>;
  diary: RxCollection<DiaryDocument>;
  settings: RxCollection<SettingsDocument>;
  friendships: RxCollection<FriendshipDocument>;
  messages: RxCollection<MessageDocument>;
  syncMeta: RxCollection<SyncMetaDocument>;
}
let pluginsRegistered = false;
export type TestDbProfile = 'all' | 'messages' | 'friendships';

const collectionDefinitions = {
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
};

const profileCollections: Record<TestDbProfile, Array<keyof TestDatabaseCollections>> = {
  all: [
    'tasks',
    'categories',
    'diary',
    'settings',
    'friendships',
    'messages',
    'syncMeta',
  ],
  messages: ['messages'],
  friendships: ['friendships'],
};

function registerRxdbPluginsOnce(): void {
  if (pluginsRegistered) return;
  addRxPlugin(RxDBMigrationSchemaPlugin);
  pluginsRegistered = true;
}
export async function createTestDb(
  profile: TestDbProfile = 'all'
): Promise<RxDatabase<TestDatabaseCollections>> {
  registerRxdbPluginsOnce();
  const name = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const db = await createRxDatabase<TestDatabaseCollections>({
    name,
    storage: wrappedValidateAjvStorage({
      storage: getRxStorageMemory(),
    }),
    multiInstance: false,
  });
  const selectedCollections = Object.fromEntries(
    profileCollections[profile].map((name) => [name, collectionDefinitions[name]])
  );
  await db.addCollections(selectedCollections);
  return db;
}
export async function destroyTestDb(
  db: RxDatabase<TestDatabaseCollections>
): Promise<void> {
  try {
    await db.remove();
  } catch {
  }
}
