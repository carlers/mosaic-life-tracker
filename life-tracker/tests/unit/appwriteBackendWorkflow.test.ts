import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  assertConfirmedProject,
  diffFunction,
  diffFunctionVariables,
  diffLocalFunctionConfig,
  diffTable,
  diffTableInventory,
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
  configureFunctionDefinition,
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
    expect(definitions.functions['message-action'].config.events).toEqual([
      'tablesdb.life_tracker.tables.tasks.rows.*.create',
      'tablesdb.life_tracker.tables.tasks.rows.*.update',
    ]);
    expect(
      definitions.functions['message-action'].config.optionalNonSecretVariables
    ).toContain('NOTIFICATIONS_LAUNCH_AT');
  });


  it('keeps executable scripts free of an implicit production project target', () => {
    const scriptsRoot = fileURLToPath(
      new URL('../../scripts/', import.meta.url)
    );
    const pending = [scriptsRoot];
    const offenders: string[] = [];
    while (pending.length) {
      const directory = pending.pop()!;
      for (const entry of readdirSync(directory, {
        withFileTypes: true,
      })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          pending.push(path);
        } else if (
          entry.isFile() &&
          entry.name.endsWith('.mjs') &&
          readFileSync(path, 'utf8').includes(
            '6a9703c50016b37110ff'
          )
        ) {
          offenders.push(path);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Appwrite managed-state drift checks', () => {
  it('accepts a table matching the manifest and rejects structural drift', () => {
    const table = MOSAIC_TABLES.find(
      (item) => item.id === 'diary'
    )!;
    const actual = {
      $id: table.id,
      name: table.name,
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

    expect(
      diffTable(
        {
          ...actual,
          columns: [
            ...actual.columns,
            {
              key: 'manual_console_field',
              type: 'varchar',
              size: 20,
              required: false,
            },
          ],
        },
        table
      )
    ).toContain(
      'table diary.manual_console_field: unexpected column'
    );
    expect(
      diffTable(
        {
          ...actual,
          indexes: [
            ...actual.indexes,
            {
              key: 'manual_console_index',
              type: 'key',
              columns: ['date'],
            },
          ],
        },
        table
      )
    ).toContain(
      'table diary.manual_console_index: unexpected index'
    );
  });

  it('checks Function structure but intentionally ignores operational schedule state', () => {
    const expected = {
      name: 'dr-backup',
      enabled: true,
      logging: true,
      runtime: 'node-22',
      timeout: 900,
      entrypoint: 'main.mjs',
      commands: 'npm install',
      deploymentRetention: 7,
      execute: [],
      scopes: ['users.read'],
      events: [],
    };
    expect(
      diffFunction(
        {
          ...expected,
          execute: [],
          scopes: ['users.read'],
          schedule: '0 11 * * *',
        },
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
    expect(
      diffFunction(
        { ...expected, events: ['databases.*.tables.*.rows.*.create'] },
        expected
      )
    ).toContain('function dr-backup events differ');
  });

  it('treats declared Function variables as managed state without reading secret values', async () => {
    const definitions = await readBackendDefinitions();
    const expected = definitions.functions['dr-backup'].config;
    const actual = {
      vars: [
        ...Object.entries(expected.nonSecretVariables).map(
          ([key, value]) => ({ key, value, secret: false })
        ),
        { key: 'R2_ACCOUNT_ID', value: 'account', secret: false },
        { key: 'R2_BUCKET', value: 'bucket', secret: false },
        { key: 'R2_ACCESS_KEY_ID', value: '', secret: true },
        { key: 'R2_SECRET_ACCESS_KEY', value: '', secret: true },
        { key: 'DR_ENCRYPTION_KEY_B64', value: '', secret: true },
      ],
    };
    expect(diffFunctionVariables(actual, expected)).toEqual([]);
    const recoveryActual = {
      vars: Object.entries(expected.nonSecretVariables).map(
        ([key, value]) => ({ key, value, secret: false })
      ),
    };
    expect(
      diffFunctionVariables(recoveryActual, expected, {
        allowMissingRequired: true,
      })
    ).toEqual([]);
    expect(
      diffFunctionVariables(recoveryActual, expected)
    ).toContain('function dr-backup variable R2_ACCOUNT_ID: missing');
    expect(
      diffFunctionVariables(
        {
          ...actual,
          vars: actual.vars.map((item) =>
            item.key === 'R2_ACCESS_KEY_ID'
              ? { ...item, secret: false }
              : item
          ),
        },
        expected
      )
    ).toContain(
      'function dr-backup variable R2_ACCESS_KEY_ID: expected secret'
    );
    expect(
      diffFunctionVariables(
        {
          ...actual,
          vars: [
            ...actual.vars,
            { key: 'MANUAL_CONSOLE_VAR', value: 'x', secret: false },
          ],
        },
        expected
      )
    ).toContain(
      'function dr-backup variable MANUAL_CONSOLE_VAR: unexpected'
    );
  });

  it('tolerates only the declared pre-foundation table placeholders', () => {
    expect(
      diffTableInventory({
        total: 4,
        tables: [
          { $id: 'tasks' },
          { $id: 'routines' },
          { $id: 'stickers' },
          { $id: 'analytics_events' },
        ],
      })
    ).toEqual({
      diffs: [],
      legacyTables: [
        'analytics_events',
        'routines',
        'stickers',
      ],
    });
    expect(
      diffTableInventory({
        total: 2,
        tables: [{ $id: 'tasks' }, { $id: 'console_test' }],
      }).diffs
    ).toContain('table console_test: unexpected unmanaged table');
  });
});

describe('ordered idempotent Appwrite migration runner', () => {
  it('keeps migrations in a stable numbered order and supports a single migration selector', () => {
    expect(
      APPWRITE_MIGRATIONS.map((item) => item.id)
    ).toEqual([
      '001-account-deletion',
      '002-diary-created-at',
      '003-task-images-bucket-permissions',
      '004-notifications',
      '005-notification-retention',
      '006-push-details',
      '007-task-shares',
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

  it('reconciles managed event triggers without changing the live schedule', async () => {
    const definitions = await readBackendDefinitions();
    const definition = definitions.functions['message-action'];
    const updated = {
      ...definition.config,
      schedule: '',
    };
    const functions = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          ...definition.config,
          events: [],
          schedule: '',
        })
        .mockResolvedValueOnce(updated),
      update: vi.fn(async () => ({})),
    };
    await expect(
      configureFunctionDefinition({
        functions: functions as any,
        definition,
        functionId: definition.config.$id,
      })
    ).resolves.toEqual({
      functionId: definition.config.$id,
      events: definition.config.events,
      schedule: '',
    });
    expect(functions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        functionId: definition.config.$id,
        events: definition.config.events,
        schedule: '',
      })
    );
  });

  it('can build compatible code before newly-declared event triggers are enabled', async () => {
    const definitions = await readBackendDefinitions();
    const definition = definitions.functions['message-action'];
    const functions = {
      get: vi.fn(async () => ({
        ...definition.config,
        events: [],
      })),
      createDeployment: vi.fn(async () => ({ $id: 'dep_events' })),
      getDeployment: vi.fn(async () => ({
        $id: 'dep_events',
        status: 'ready',
      })),
    };
    await expect(
      deployFunctionVersion({
        functions: functions as any,
        definition,
        functionId: definition.config.$id,
        gitSha: 'abcdef1',
        verifyGit: vi.fn(async () => {}),
        packageDirectory: vi.fn(async () => Buffer.from('archive')),
        sleep: async () => {},
      })
    ).resolves.toMatchObject({ deploymentId: 'dep_events' });
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
