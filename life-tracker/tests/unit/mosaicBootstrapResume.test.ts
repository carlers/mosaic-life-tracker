import { describe, expect, it, vi } from 'vitest';
import {
  assertPrecreatedEmptyMosaicDatabase,
  bootstrapMosaicProject,
  parseBootstrapArgs,
} from '../../scripts/lib/mosaic-bootstrap.mjs';

const gitDb = { $id: 'life_tracker', name: 'Life Tracker', enabled: true };
function mockServices({
  databases = [{ $id: gitDb.$id }],
  users = [],
  buckets = [],
  functions = [],
  tables = [],
  database = gitDb,
} = {}) {
  return {
    tablesDB: {
      list: vi.fn(async () => ({ databases })),
      get: vi.fn(async () => database),
      listTables: vi.fn(async () => ({ tables })),
      create: vi.fn(),
      createTable: vi.fn(),
    },
    users: { list: vi.fn(async () => ({ users })) },
    storage: { listBuckets: vi.fn(async () => ({ buckets })) },
    functions: { list: vi.fn(async () => ({ functions })) },
  };
}

describe('isolated Oracle precreated database resume safety', () => {
  it('requires an explicit flag, never silently altering normal bootstrap', async () => {
    const standard = parseBootstrapArgs(
      ['--project', 'oracle_test', '--endpoint', 'http://localhost/v1'],
      { APPWRITE_API_KEY: 'test-only' },
    );
    const resume = parseBootstrapArgs(
      ['--project', 'oracle_test', '--endpoint', 'http://localhost/v1',
        '--resume-precreated-database'],
      { APPWRITE_API_KEY: 'test-only' },
    );
    expect(standard.resumePrecreatedDatabase).toBe(false);
    expect(resume.resumePrecreatedDatabase).toBe(true);
    expect(() => parseBootstrapArgs([
      '--project', 'oracle_test', '--endpoint', 'http://localhost/v1',
      '--platform-only', '--resume-precreated-database',
    ], { APPWRITE_API_KEY: 'test-only' })).toThrow('mutually exclusive');

    const services = mockServices();
    await expect(bootstrapMosaicProject(
      { ...standard, platformOnly: false },
      { services },
    )).rejects.toThrow('Refusing to bootstrap a non-empty');
    expect(services.tablesDB.create).not.toHaveBeenCalled();
    expect(services.tablesDB.createTable).not.toHaveBeenCalled();
  });

  it('accepts only the exact Git-owned empty database and does not create it', async () => {
    const services = mockServices();
    await expect(assertPrecreatedEmptyMosaicDatabase(services)).resolves.toBeDefined();
    expect(services.tablesDB.create).not.toHaveBeenCalled();
    expect(services.tablesDB.get).toHaveBeenCalledWith({ databaseId: 'life_tracker' });
    expect(services.tablesDB.listTables).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing database', { databases: [] }],
    ['foreign database', { databases: [{ $id: 'foreign' }] }],
    ['extra database', { databases: [{ $id: 'life_tracker' }, { $id: 'extra' }] }],
    ['existing user', { users: [{ $id: 'someone' }] }],
    ['existing bucket', { buckets: [{ $id: 'bucket' }] }],
    ['existing Function', { functions: [{ $id: 'function' }] }],
  ])('rejects %s before any metadata write', async (_label, fixture) => {
    const services = mockServices(fixture);
    await expect(assertPrecreatedEmptyMosaicDatabase(services)).rejects.toThrow(
      'target must contain only',
    );
    expect(services.tablesDB.createTable).not.toHaveBeenCalled();
    expect(services.tablesDB.get).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong name', { $id: 'life_tracker', name: 'Other', enabled: true }],
    ['disabled database', { $id: 'life_tracker', name: 'Life Tracker', enabled: false }],
    ['wrong ID', { $id: 'other', name: 'Life Tracker', enabled: true }],
  ])('rejects %s metadata mismatch', async (_label, database) => {
    const services = mockServices({ database });
    await expect(assertPrecreatedEmptyMosaicDatabase(services)).rejects.toThrow(
      'database metadata differs',
    );
    expect(services.tablesDB.createTable).not.toHaveBeenCalled();
  });

  it('rejects existing tables and malformed table-list response', async () => {
    const services = mockServices({ tables: [{ $id: 'tasks' }] });
    await expect(assertPrecreatedEmptyMosaicDatabase(services)).rejects.toThrow(
      'expected an empty table list',
    );
    expect(services.tablesDB.createTable).not.toHaveBeenCalled();

    const invalid = mockServices();
    invalid.tablesDB.listTables.mockResolvedValue({});
    await expect(assertPrecreatedEmptyMosaicDatabase(invalid)).rejects.toThrow(
      'expected an empty table list',
    );
  });
});
