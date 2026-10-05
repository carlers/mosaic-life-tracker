import { describe, expect, it, vi } from 'vitest';
import {
  assertConfirmedProject,
  diffFunction,
  diffLocalFunctionConfig,
  diffTable,
  parseBackendTarget,
  readBackendDefinitions,
} from '../../scripts/lib/appwrite-backend.mjs';
import {
  APPWRITE_MIGRATIONS,
  runAppwriteMigrations,
  selectMigrations,
} from '../../scripts/appwrite-migrate.mjs';
import {
  activateFunctionVersion,
  assertSourceMatchesGit,
  deployFunctionVersion,
  parseFunctionCommand,
} from '../../scripts/appwrite-function.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

describe('Appwrite backend target safety', () => {
  it('requires explicit endpoint, project and API key', () => {
    expect(() => parseBackendTarget([], {})).toThrow(/endpoint/i);
    expect(() =>
      parseBackendTarget(
        [
          '--endpoint',
          'https://sgp.cloud.appwrite.io',
          '--project',
          'scratch',
        ],
        {}
      )
    ).toThrow(/APPWRITE_API_KEY/);
  });

  it('requires mutating commands to confirm the exact target project', () => {
    expect(() =>
      assertConfirmedProject([], 'prod')
    ).toThrow(/confirm-project/);
    expect(() =>
      assertConfirmedProject(
        ['--confirm-project', 'scratch'],
        'prod'
      )
    ).toThrow(/does not match/);
    expect(() =>
      assertConfirmedProject(
        ['--confirm-project', 'prod'],
        'prod'
      )
    ).not.toThrow();
  });

  it('keeps portable Function config aligned with the production CLI overlay', async () => {
    const definitions = await readBackendDefinitions();
    expect(
      diffLocalFunctionConfig(
        definitions.cliConfig,
        definitions.functions
      )
    ).toEqual([]);
  });
});

describe('Appwrite managed-state drift checks', () => {
  it('accepts a table matching the manifest and rejects structural drift', () => {
    const table = MOSAIC_TABLES.find(
      (item) => item.id === 'diary'
    )!;
    const actual = {
      $id: table.id,
      $permissions: table.permissions,
      rowSecurity: table.rowSecurity,
      enabled: table.enabled,
      columns: table.columns.map((column) => ({
        ...column,
        status: 'available',
      })),
      indexes: table.indexes,
    };
    expect(diffTable(actual, table)).toEqual([]);
    expect(
      diffTable(
        {
          ...actual,
          columns: actual.columns.map((column) =>
            column.key === 'created_at'
              ? { ...column, size: 36 }
              : column
          ),
        },
        table
      )
    ).toContain(
      'table diary.created_at size: expected 50, got 36'
    );
  });

  it('checks Function structure but intentionally ignores operational schedule state', () => {
    const expected = {
      name: 'dr-backup',
      runtime: 'node-22',
      timeout: 900,
      entrypoint: 'main.mjs',
      commands: 'npm install',
      deploymentRetention: 7,
      execute: [],
      scopes: ['users.read'],
    };
    expect(
      diffFunction(
        { ...expected, schedule: '0 11 * * *' },
        expected
      )
    ).toEqual([]);
    expect(
      diffFunction(
        { ...expected, runtime: 'node-18.0' },
        expected
      )
    ).toContain(
      'function dr-backup runtime: expected "node-22", got "node-18.0"'
    );
  });
});

describe('ordered idempotent Appwrite migration runner', () => {
  it('keeps migrations in a stable numbered order and supports a single migration selector', () => {
    expect(
      APPWRITE_MIGRATIONS.map((item) => item.id)
    ).toEqual([
      '001-account-deletion',
      '002-diary-created-at',
    ]);
    expect(
      selectMigrations(['--only', '002-diary-created-at'])
    ).toEqual([APPWRITE_MIGRATIONS[1]]);
    expect(() =>
      selectMigrations(['--only', '999-nope'])
    ).toThrow(/Unknown/);
  });

  it('runs migrations sequentially', async () => {
    const order: string[] = [];
    const migrations = [
      {
        id: '001-a',
        description: 'a',
        run: vi.fn(async () => {
          order.push('a');
        }),
      },
      {
        id: '002-b',
        description: 'b',
        run: vi.fn(async () => {
          order.push('b');
        }),
      },
    ];
    await expect(
      runAppwriteMigrations({
        request: vi.fn(),
        migrations,
        log: () => {},
      })
    ).resolves.toEqual(['001-a', '002-b']);
    expect(order).toEqual(['a', 'b']);
  });
});

describe('controlled Appwrite Function deployments', () => {
  it('requires project confirmation and a Git SHA before creating a deployment', () => {
    expect(() =>
      parseFunctionCommand(
        [
          'deploy',
          '--function',
          'message-action',
          '--endpoint',
          'https://sgp.cloud.appwrite.io',
          '--project',
          'scratch',
          '--confirm-project',
          'scratch',
        ],
        { APPWRITE_API_KEY: 'key' }
      )
    ).toThrow(/git-sha/);
  });

  it('rejects mismatched or dirty source provenance', () => {
    expect(() =>
      assertSourceMatchesGit({
        gitSha: 'abcdef1',
        headSha: '1234567',
        dirtyOutput: '',
      })
    ).toThrow(/does not match HEAD/);
    expect(() =>
      assertSourceMatchesGit({
        gitSha: 'abcdef1',
        headSha: 'abcdef1',
        dirtyOutput:
          ' M appwrite-functions/message-action/main.js',
      })
    ).toThrow(/uncommitted/);
  });

  it('builds a ready deployment without activating it', async () => {
    const definitions = await readBackendDefinitions();
    const definition =
      definitions.functions['message-action'];
    const functions = {
      get: vi.fn(async () => ({ ...definition.config })),
      createDeployment: vi.fn(async () => ({
        $id: 'dep_ready',
      })),
      getDeployment: vi.fn(async () => ({
        $id: 'dep_ready',
        status: 'ready',
      })),
    };
    const result = await deployFunctionVersion({
      functions: functions as any,
      definition,
      functionId: definition.config.$id,
      gitSha: 'abcdef1',
      verifyGit: vi.fn(async () => {}),
      packageDirectory: vi.fn(async () =>
        Buffer.from('archive')
      ),
      sleep: async () => {},
    });
    expect(result).toEqual({
      deploymentId: 'dep_ready',
      gitSha: 'abcdef1',
      status: 'ready',
    });
    expect(
      functions.createDeployment
    ).toHaveBeenCalledWith(
      expect.objectContaining({ activate: false })
    );
  });

  it('activates only a ready deployment and verifies the active ID', async () => {
    const functions = {
      getDeployment: vi.fn(async () => ({
        $id: 'dep_ready',
        status: 'ready',
      })),
      updateFunctionDeployment: vi.fn(async () => ({})),
      get: vi.fn(async () => ({
        deploymentId: 'dep_ready',
      })),
    };
    await expect(
      activateFunctionVersion({
        functions: functions as any,
        functionId: 'message_action',
        deploymentId: 'dep_ready',
      })
    ).resolves.toEqual({
      deploymentId: 'dep_ready',
      status: 'active',
    });
    expect(
      functions.updateFunctionDeployment
    ).toHaveBeenCalledWith({
      functionId: 'message_action',
      deploymentId: 'dep_ready',
    });
  });
});
