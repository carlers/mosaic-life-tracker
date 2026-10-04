import { vi } from 'vitest';
import { createRequire } from 'node:module';

export interface MockDb {
  listRows: any;
  getRow: any;
  upsertRow: any;
  updateRow: any;
  deleteRow: any;
  createRow: any;
  createTransaction: any;
  updateTransaction: any;
}

export interface MockStorage {
  listFiles: any;
  deleteFile: any;
}

export interface MockUsers {
  updateStatus: any;
  deleteSessions: any;
  delete: any;
}

export interface MockFunctions {
  createExecution: any;
}

export interface InvokeInput {
  userId?: string;
  body: Record<string, unknown>;
  mockDb: MockDb;
  mockStorage?: MockStorage;
  mockUsers?: MockUsers;
  mockFunctions?: MockFunctions;
  trigger?: 'http' | 'schedule' | 'event';
}

export interface InvokeResult {
  body: any;
  status: number;
  logs: string[];
  errors: string[];
}

// Mutable holder read by MockTablesDB's constructor at handler execution
// time. invoke() sets this immediately before calling the handler, so a
// fresh set of vi.fn()s is plumbed in per test without recreating the mock
// module.
const state: {
  current: MockDb | null;
  storage: MockStorage | null;
  users: MockUsers | null;
  functions: MockFunctions | null;
} = {
  current: null,
  storage: null,
  users: null,
  functions: null,
};

class MockClient {
  setEndpoint(_url: string) {
    return this;
  }
  setProject(_id: string) {
    return this;
  }
  setKey(_key: string) {
    return this;
  }
}

class MockStorageService {
  listFiles: any;
  deleteFile: any;

  constructor(_client: unknown) {
    if (!state.storage) throw new Error('invoke-handler: storage state missing');
    this.listFiles = state.storage.listFiles;
    this.deleteFile = state.storage.deleteFile;
  }
}

class MockUsersService {
  updateStatus: any;
  deleteSessions: any;
  delete: any;

  constructor(_client: unknown) {
    if (!state.users) throw new Error('invoke-handler: users state missing');
    this.updateStatus = state.users.updateStatus;
    this.deleteSessions = state.users.deleteSessions;
    this.delete = state.users.delete;
  }
}

class MockFunctionsService {
  createExecution: any;

  constructor(_client: unknown) {
    if (!state.functions) throw new Error('invoke-handler: functions state missing');
    this.createExecution = state.functions.createExecution;
  }
}

class MockTablesDB {
  listRows: any;
  getRow: any;
  upsertRow: any;
  updateRow: any;
  deleteRow: any;
  createRow: any;
  createTransaction: any;
  updateTransaction: any;

  constructor(_client: unknown) {
    const m = state.current;
    if (!m) {
      throw new Error(
        'invoke-handler: state.current is not set. Call invoke() before the handler constructs a TablesDB.'
      );
    }
    this.listRows = m.listRows;
    this.getRow = m.getRow;
    this.upsertRow = m.upsertRow;
    this.updateRow = m.updateRow;
    this.deleteRow = m.deleteRow;
    this.createRow = m.createRow;
    this.createTransaction = m.createTransaction;
    this.updateTransaction = m.updateTransaction;
  }
}

const MockQuery = {
  equal: (key: string, value: unknown) => ({ op: 'equal', key, value }),
  lessThan: (key: string, value: unknown) => ({ op: 'lessThan', key, value }),
  limit: (n: number) => ({ op: 'limit', n }),
  orderAsc: (field: string) => ({ op: 'orderAsc', field }),
  orderDesc: (field: string) => ({ op: 'orderDesc', field }),
  cursorAfter: (id: string) => ({ op: 'cursorAfter', id }),
  greaterThan: (key: string, value: unknown) => ({
    op: 'greaterThan',
    key,
    value,
  }),
};

const MockPermission = {
  read: (role: string) => `read("${role}")`,
  update: (role: string) => `update("${role}")`,
  delete: (role: string) => `delete("${role}")`,
};

const MockRole = {
  user: (id: string) => `user:${id}`,
};

// main.js is CommonJS and reads `require('node-appwrite')`. vi.mock only
// intercepts ESM imports inside Vite's module graph — it does NOT affect
// Node's native CJS loader, which createRequire uses. So we inject the mock
// straight into Node's require.cache at the resolved path main.js will
// request, BEFORE loading main.js. The cached entry must have loaded:true,
// otherwise Node re-runs the real module's factory.
const requireCjs = createRequire(import.meta.url);
const appwritePath = requireCjs.resolve('node-appwrite');

(requireCjs as unknown as { cache: Record<string, unknown> }).cache[
  appwritePath
] = {
  id: appwritePath,
  path: appwritePath,
  filename: appwritePath,
  loaded: true,
  parent: null,
  children: [],
  paths: [],
  exports: {
    Client: MockClient,
    TablesDB: MockTablesDB,
    Storage: MockStorageService,
    Users: MockUsersService,
    Functions: MockFunctionsService,
    Query: MockQuery,
    Permission: MockPermission,
    Role: MockRole,
  },
};

// Load main.js AFTER the mock is planted so its top-level
// `require('node-appwrite')` picks up the fake.
const handler: any = requireCjs(
  '../../appwrite-functions/message-action/main.js'
);

// Factory returns a fresh, fully-independent mock db. Every test should call
// this in beforeEach so state never leaks between tests.
export function makeMockStorage(): MockStorage {
  return {
    listFiles: vi.fn().mockResolvedValue({ files: [] }),
    deleteFile: vi.fn().mockResolvedValue({}),
  };
}

export function makeMockUsers(): MockUsers {
  return {
    updateStatus: vi.fn().mockResolvedValue({}),
    deleteSessions: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  };
}

export function makeMockFunctions(): MockFunctions {
  return {
    createExecution: vi.fn().mockResolvedValue({
      status: 'completed',
      responseStatusCode: 200,
      responseBody: JSON.stringify({ ok: true }),
    }),
  };
}

export function makeMockDb(): MockDb {
  const notFound = Object.assign(new Error('Not found'), { code: 404 });
  return {
    listRows: vi.fn().mockResolvedValue({ rows: [] }),
    getRow: vi.fn().mockRejectedValue(notFound),
    upsertRow: vi.fn().mockResolvedValue({}),
    updateRow: vi.fn().mockResolvedValue({}),
    deleteRow: vi.fn().mockResolvedValue({}),
    createRow: vi.fn().mockResolvedValue({}),
    createTransaction: vi.fn().mockResolvedValue({ $id: "tx" }),
    updateTransaction: vi.fn().mockResolvedValue({}),
  };
}

export async function invoke(input: InvokeInput): Promise<InvokeResult> {
  state.current = input.mockDb;
  state.storage = input.mockStorage ?? makeMockStorage();
  state.users = input.mockUsers ?? makeMockUsers();
  state.functions = input.mockFunctions ?? makeMockFunctions();

  const log = vi.fn();
  const error = vi.fn();

  let capturedBody: any = undefined;
  let capturedStatus = 200;

  const res = {
    json: (body: any, status?: number) => {
      capturedBody = body;
      if (typeof status === 'number') capturedStatus = status;
      return { body, status: capturedStatus };
    },
  };

  const headers: Record<string, string> = {
    'x-appwrite-key': 'test-key',
    'x-appwrite-trigger': input.trigger || 'http',
  };
  if (input.userId) {
    headers['x-appwrite-user-id'] = input.userId;
  }

  const req = {
    headers,
    body: JSON.stringify(input.body),
  };

  await handler({ req, res, log, error });

  return {
    body: capturedBody,
    status: capturedStatus,
    logs: log.mock.calls.map((args) => String(args[0])),
    errors: error.mock.calls.map((args) => String(args[0])),
  };
}
