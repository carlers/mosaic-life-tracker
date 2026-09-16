// Single source of truth for RxDB migration strategies.
//
// Both the production database (`src/db/database.ts`) and the test helper
// (`tests/helpers/testDb.ts`) import from this module. Prior to this
// extraction the two sites maintained parallel copies of the strategies,
// which meant every schema version bump risked silent drift between
// production and test (see AGENTS.md §12 and §24.5).
//
// When bumping a schema version:
//   1. Bump the `version` field in `src/db/schema.ts` for that collection.
//   2. Add a strategy entry here (one entry per version step).
//   3. Both call sites pick it up automatically — no per-site edit required.
//
// Strategies are typed with `Record<string, unknown>` rather than the schema
// document type. RxDB's own `MigrationStrategies` type treats the incoming
// document as opaque (`any`) because migrations run *before* the new schema
// validation pass. Using `any` here would also work; the explicit
// `Record<string, unknown>` documents that the strategy operates on a raw,
// untyped pre-migration shape.

export const tasksMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => oldDoc,
};

export const friendshipsMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    friendBio: '',
  }),
};

export const messagesMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
  }),
  2: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    isUnsent: false,
  }),
  3: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    originalMessageId: '',
    reactions: '',
  }),
};
