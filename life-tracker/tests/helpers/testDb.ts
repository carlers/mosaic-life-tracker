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
  type TaskDocument,
  type CategoryDocument,
  type DiaryDocument,
  type SettingsDocument,
  type FriendshipDocument,
  type MessageDocument,
} from '../../src/db/schema';
import {
  tasksMigrationStrategies,
  friendshipsMigrationStrategies,
  messagesMigrationStrategies,
} from '../../src/db/migrations';

export interface TestDatabaseCollections {
  tasks: RxCollection<TaskDocument>;
  categories: RxCollection<CategoryDocument>;
  diary: RxCollection<DiaryDocument>;
  settings: RxCollection<SettingsDocument>;
  friendships: RxCollection<FriendshipDocument>;
  messages: RxCollection<MessageDocument>;
}

// ---------------------------------------------------------------------------
// RxDB plugin registration
//
// Production `src/db/database.ts` registers `RxDBDevModePlugin` behind an
// `import.meta.env.DEV` guard and `RxDBMigrationSchemaPlugin` unconditionally.
//
// The test helper deliberately does NOT register `RxDBDevModePlugin`.
// Rationale:
//   - The dev-mode plugin loads a remote iframe from
//     `https://rxdb.info/html/dev-mode-iframe.html` on first DB creation.
//     The iframe's script constructs a `BroadcastChannel`, which happy-dom
//     does not implement, producing an unhandled `ReferenceError` that fails
//     the Vitest run even when every assertion passes.
//   - The dev-mode plugin's three concrete checks (DB9 `ignoreDuplicate`,
//     DVM1 storage-validator requirement, COL12 migration-strategy count)
//     are all dev-mode-only. None of them protect against a real bug in a
//     test environment where every DB is freshly created with a unique name
//     and never migrated.
//   - The valuable dev-mode behavior — schema validation on every write —
//     still runs, because `wrappedValidateAjvStorage` is retained below.
//
// `RxDBMigrationSchemaPlugin` is retained for production parity: it is
// required for `migrationStrategies` to be honored at all, and keeping it
// forces any future schema bump to add a strategy in `src/db/migrations.ts`,
// which both this file and `src/db/database.ts` import from.
//
// The module-level guard prevents `addRxPlugin`'s PL3 ("plugin already
// added") error when the same worker reuses this module across test files
// (relevant under non-default `poolOptions` where isolation is relaxed).
// ---------------------------------------------------------------------------

let pluginsRegistered = false;

function registerRxdbPluginsOnce(): void {
  if (pluginsRegistered) return;
  addRxPlugin(RxDBMigrationSchemaPlugin);
  pluginsRegistered = true;
}

/**
 * Builds a fresh in-memory RxDB instance with the real production schemas.
 *
 * Do NOT import `getDatabase` from `src/db/database.ts` here — that module is
 * mocked by the hook test files and importing it would defeat the mock.
 * Schemas come from `src/db/schema.ts` (source of truth). Migration
 * strategies come from `src/db/migrations.ts` (shared with production).
 *
 * Each call produces a unique database name so parallel test files (Vitest
 * runs them in separate workers) never collide.
 */
export async function createTestDb(): Promise<RxDatabase<TestDatabaseCollections>> {
  registerRxdbPluginsOnce();
  const name = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const db = await createRxDatabase<TestDatabaseCollections>({
    name,
    storage: wrappedValidateAjvStorage({
      storage: getRxStorageMemory(),
    }),
    multiInstance: false,
  });
  await db.addCollections({
    tasks: {
      schema: tasksSchema,
      migrationStrategies: tasksMigrationStrategies,
    },
    categories: { schema: categoriesSchema },
    diary: { schema: diarySchema },
    settings: { schema: settingsSchema },
    friendships: {
      schema: friendshipsSchema,
      migrationStrategies: friendshipsMigrationStrategies,
    },
    messages: {
      schema: messagesSchema,
      migrationStrategies: messagesMigrationStrategies,
    },
  });
  return db;
}

export async function destroyTestDb(
  db: RxDatabase<TestDatabaseCollections>
): Promise<void> {
  try {
    await db.remove();
  } catch {
    // Swallow — RxDB `remove()` can throw if the DB was already torn down
    // by an earlier cleanup. Tests do not care.
  }
}
