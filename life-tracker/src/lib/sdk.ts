import { Functions, Storage, TablesDB } from 'appwrite';
import { client, account } from './appwrite';
import { guardedCall, makeUnauthorizedError } from './authEvents';

const rawTablesDB = new TablesDB(client);
const rawStorage = new Storage(client);
const rawFunctions = new Functions(client);
const rawAccount = account;

// Param shapes are defined explicitly. Appwrite's SDK methods are overloaded,
// and TypeScript's `Parameters<T>` utility picks the LAST overload, which for
// these methods is a deprecated string-arg form. Relying on `Parameters<>`
// produced `params: string` and broke every call site. The shapes below match
// the current (object-arg) overloads. See §6.

type ListRowsParams = {
  databaseId: string;
  tableId: string;
  queries?: string[];
  transactionId?: string;
  total?: boolean;
  ttl?: number;
};

type GetRowParams = {
  databaseId: string;
  tableId: string;
  rowId: string;
  queries?: string[];
  transactionId?: string;
};

type UpdateRowParams = {
  databaseId: string;
  tableId: string;
  rowId: string;
  data?: Record<string, unknown>;
  permissions?: string[];
  transactionId?: string;
};

type UpsertRowParams = {
  databaseId: string;
  tableId: string;
  rowId: string;
  data?: Record<string, unknown>;
  permissions?: string[];
  transactionId?: string;
};

type CreateRowParams = {
  databaseId: string;
  tableId: string;
  rowId: string;
  data: Record<string, unknown>;
  permissions?: string[];
  transactionId?: string;
};

type DeleteRowParams = {
  databaseId: string;
  tableId: string;
  rowId: string;
  transactionId?: string;
};

type CreateFileParams = {
  bucketId: string;
  fileId: string;
  file: File;
  permissions?: string[];
  onProgress?: (progress: unknown) => void;
};

type DeleteFileParams = {
  bucketId: string;
  fileId: string;
};

type GetFileParams = {
  bucketId: string;
  fileId: string;
};

type GetFileViewParams = {
  bucketId: string;
  fileId: string;
  token?: string;
};

type GetFilePreviewParams = {
  bucketId: string;
  fileId: string;
  width?: number;
  height?: number;
  gravity?: string;
  quality?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  opacity?: number;
  rotation?: number;
  background?: string;
  output?: string;
  token?: string;
};

type CreateExecutionParams = {
  functionId: string;
  body?: string;
  async?: boolean;
  xpath?: string;
  method?: string;
  headers?: Record<string, string>;
  scheduledAt?: string;
};

type ListRowsResult = Awaited<ReturnType<typeof rawTablesDB.listRows>>;
type GetRowResult = Awaited<ReturnType<typeof rawTablesDB.getRow>>;
type UpdateRowResult = Awaited<ReturnType<typeof rawTablesDB.updateRow>>;
type UpsertRowResult = Awaited<ReturnType<typeof rawTablesDB.upsertRow>>;
type CreateRowResult = Awaited<ReturnType<typeof rawTablesDB.createRow>>;
type DeleteRowResult = Awaited<ReturnType<typeof rawTablesDB.deleteRow>>;

type CreateFileResult = Awaited<ReturnType<typeof rawStorage.createFile>>;
type DeleteFileResult = Awaited<ReturnType<typeof rawStorage.deleteFile>>;
type GetFileResult = Awaited<ReturnType<typeof rawStorage.getFile>>;
type GetFileViewResult = ReturnType<typeof rawStorage.getFileView>;
type GetFilePreviewResult = ReturnType<typeof rawStorage.getFilePreview>;

type CreateExecutionResult = Awaited<
  ReturnType<typeof rawFunctions.createExecution>
>;

type AccountGetResult = Awaited<ReturnType<typeof rawAccount.get>>;

export const guardedTablesDB = {
  listRows: (params: ListRowsParams): Promise<ListRowsResult> =>
    guardedCall(() => rawTablesDB.listRows(params as never)),
  getRow: (params: GetRowParams): Promise<GetRowResult> =>
    guardedCall(() => rawTablesDB.getRow(params as never)),
  updateRow: (params: UpdateRowParams): Promise<UpdateRowResult> =>
    guardedCall(() => rawTablesDB.updateRow(params as never)),
  upsertRow: (params: UpsertRowParams): Promise<UpsertRowResult> =>
    guardedCall(() => rawTablesDB.upsertRow(params as never)),
  createRow: (params: CreateRowParams): Promise<CreateRowResult> =>
    guardedCall(() => rawTablesDB.createRow(params as never)),
  deleteRow: (params: DeleteRowParams): Promise<DeleteRowResult> =>
    guardedCall(() => rawTablesDB.deleteRow(params as never)),
};

export const guardedStorage = {
  createFile: (params: CreateFileParams): Promise<CreateFileResult> =>
    guardedCall(() => rawStorage.createFile(params as never)),
  deleteFile: (params: DeleteFileParams): Promise<DeleteFileResult> =>
    guardedCall(() => rawStorage.deleteFile(params as never)),
  getFile: (params: GetFileParams): Promise<GetFileResult> =>
    guardedCall(() => rawStorage.getFile(params as never)),
  // URL builders are synchronous — no network call, no guardedCall needed.
  getFileView: (params: GetFileViewParams): GetFileViewResult =>
    rawStorage.getFileView(params as never),
  getFilePreview: (params: GetFilePreviewParams): GetFilePreviewResult =>
    rawStorage.getFilePreview(params as never),
};

export const guardedFunctions = {
  createExecution: (
    params: CreateExecutionParams
  ): Promise<CreateExecutionResult> =>
    guardedCall(async () => {
      const execution = await rawFunctions.createExecution(params as never);
      // The SDK returns an Execution with responseStatusCode 401 instead of
      // throwing. Normalize that into an error so guardedCall dispatches the
      // global auth:unauthorized event.
      if (execution.responseStatusCode === 401) {
        throw makeUnauthorizedError('Function call unauthorized');
      }
      return execution;
    }),
};

export const guardedAccount = {
  get: (): Promise<AccountGetResult> => guardedCall(() => rawAccount.get()),
};

// Appwrite Realtime. The SDK exposes a single callback-style `subscribe`
// on the raw Client. We wrap it so:
//   1. every subscription returns an unsubscribe function (the SDK's own
//      return value in this SDK version is already a plain `() => void`,
//      but the guard keeps the ESLint `no-restricted-imports` boundary
//      clean: no file outside `sdk.ts` needs to touch `client` directly);
//   2. errors thrown synchronously by `subscribe` (bad channel format,
//      no session) are caught and logged rather than crashing the caller.
// Realtime `subscribe` never throws on 401 — the socket just fails to
// authorize and the subscription silently never fires. There is therefore
// no 401 normalization here; auth:unauthorized is not dispatched from
// realtime. Session loss is detected by the next guarded HTTP call.
export type RealtimePayload = {
  events: string[];
  channels: string[];
  timestamp: string;
  payload: Record<string, unknown>;
};

export type RealtimeUnsubscribe = () => void;

export const guardedRealtime = {
  subscribe: (
    channels: string | string[],
    callback: (payload: RealtimePayload) => void
  ): RealtimeUnsubscribe => {
    try {
      const unsubscribe = client.subscribe(channels as never, (raw) => {
        callback(raw as unknown as RealtimePayload);
      });
      return () => {
        try {
          unsubscribe();
        } catch (err) {
          console.error('[guardedRealtime] unsubscribe failed:', err);
        }
      };
    } catch (err) {
      console.error('[guardedRealtime] subscribe failed:', err);
      return () => {};
    }
  },
};
