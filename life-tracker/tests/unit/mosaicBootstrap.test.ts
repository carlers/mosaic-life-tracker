import { describe, expect, it, vi } from 'vitest';
import { parseDrFunctionDeployArgs } from '../../scripts/dr-deploy-functions.mjs';
import {
  assertEmptyTarget,
  bootstrapMosaicProject,
  deployRecoveredProjectFunctions,
  ensureWebPlatforms,
  parseBootstrapArgs,
  renderBrowserEnv,
  writeBrowserEnvFile,
} from '../../scripts/lib/mosaic-bootstrap.mjs';

function emptyServices() {
  return {
    tablesDB: {
      list: vi.fn(async () => ({ databases: [] })),
      create: vi.fn(async () => ({ $id: 'life_tracker' })),
      createTable: vi.fn(async (input) => ({ $id: input.tableId })),
    },
    storage: {
      listBuckets: vi.fn(async () => ({ buckets: [] })),
      createBucket: vi.fn(async (input) => ({ $id: input.bucketId })),
    },
    functions: {
      list: vi.fn(async () => ({ functions: [] })),
      create: vi.fn(async (input) => ({ $id: input.functionId })),
      createVariable: vi.fn(async () => ({})),
      createDeployment: vi.fn(async () => ({ $id: 'dep_1' })),
      getDeployment: vi.fn(async () => ({ $id: 'dep_1', status: 'ready' })),
      get: vi.fn(async ({ functionId }) => ({ $id: functionId, schedule: '' })),
    },
    users: {
      list: vi.fn(async () => ({ users: [] })),
    },
    project: {
      listPlatforms: vi.fn(async () => ({ platforms: [] })),
      createWebPlatform: vi.fn(async (input) => ({ $id: input.platformId })),
    },
  };
}

describe('Mosaic bootstrap configuration', () => {
  it('requires an explicit target project and temporary API key', () => {
    expect(() => parseBootstrapArgs([], {})).toThrow(/project ID/);
    expect(() =>
      parseBootstrapArgs(['--project', 'fresh_project'], {})
    ).toThrow(/APPWRITE_API_KEY/);
  });

  it('renders browser config for the fork rather than the production project', () => {
    const config = parseBootstrapArgs(
      [
        '--project',
        'fork_project',
        '--endpoint',
        'https://fra.cloud.appwrite.io/v1',
        '--message-function-id',
        'message_action',
      ],
      { APPWRITE_API_KEY: 'temporary-key' }
    );
    const rendered = renderBrowserEnv(config);

    expect(rendered).toContain('VITE_APPWRITE_PROJECT_ID=fork_project');
    expect(rendered).toContain(
      'VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1'
    );
    expect(rendered).toContain(
      'VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID=message_action'
    );
    expect(rendered).toContain('VITE_APPWRITE_TABLE_MESSAGES=messages');
    expect(rendered).not.toContain('6a9703c50016b37110ff');
  });

  it('requires all recovery secrets before optional DR provisioning', () => {
    expect(() =>
      parseBootstrapArgs(
        [
          '--project',
          'fork_project',
          '--endpoint',
          'https://fra.cloud.appwrite.io/v1',
          '--with-dr',
        ],
        { APPWRITE_API_KEY: 'temporary-key' }
      )
    ).toThrow(/R2_ACCOUNT_ID/);
  });

  it('refuses to overwrite any project that already has community state', async () => {
    const services = emptyServices();
    services.users.list.mockResolvedValueOnce({
      users: [{ $id: 'existing_user' }],
    });

    await expect(assertEmptyTarget(services)).rejects.toThrow(
      /Refusing to bootstrap a non-empty Appwrite project/
    );
    expect(services.tablesDB.create).not.toHaveBeenCalled();
  });

  it('writes browser env only when the destination file is absent unless overwrite is explicit', async () => {
    const config = parseBootstrapArgs(
      [
        '--project',
        'fork_project',
        '--endpoint',
        'https://fra.cloud.appwrite.io/v1',
      ],
      { APPWRITE_API_KEY: 'temporary-key' }
    );
    await expect(
      writeBrowserEnvFile(config, {
        fileExists: async () => true,
        write: vi.fn(),
      })
    ).rejects.toThrow(/already exists/);

    const write = vi.fn(async () => {});
    await writeBrowserEnvFile(
      { ...config, overwriteEnv: true },
      {
        fileExists: async () => true,
        write,
      }
    );
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][1]).toContain(
      'VITE_APPWRITE_PROJECT_ID=fork_project'
    );
  });
});

describe('DR Function deployment CLI configuration', () => {
  it('requires only the restored-project API key and endpoint', () => {
    const config = parseDrFunctionDeployArgs(
      ['--target-project', 'restored_project'],
      {
        APPWRITE_TARGET_API_KEY: 'temporary-function-key',
        APPWRITE_TARGET_ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
      }
    );

    expect(config).toEqual({
      projectId: 'restored_project',
      endpoint: 'https://fra.cloud.appwrite.io/v1',
      apiKey: 'temporary-function-key',
      messageFunctionId: undefined,
      drFunctionId: undefined,
    });
  });

  it('fails before deployment when the target API key is missing', () => {
    expect(() =>
      parseDrFunctionDeployArgs(
        ['--target-project', 'restored_project'],
        { APPWRITE_TARGET_ENDPOINT: 'https://fra.cloud.appwrite.io/v1' }
      )
    ).toThrow(/APPWRITE_TARGET_API_KEY/);
  });
});

describe('Mosaic bootstrap operations', () => {
  it('adds only missing web platforms', async () => {
    const project = {
      listPlatforms: vi.fn(async () => ({
        platforms: [{ type: 'web', hostname: 'localhost' }],
      })),
      createWebPlatform: vi.fn(async () => ({})),
    };

    await expect(
      ensureWebPlatforms(project, ['localhost', 'mosaic.example.com'])
    ).resolves.toEqual(['mosaic.example.com']);
    expect(project.createWebPlatform).toHaveBeenCalledOnce();
    expect(project.createWebPlatform).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'mosaic.example.com' })
    );
  });

  it('provisions the complete fresh backend and only the app Function by default', async () => {
    const services = emptyServices();
    const config = parseBootstrapArgs(
      [
        '--project',
        'fork_project',
        '--endpoint',
        'https://fra.cloud.appwrite.io/v1',
        '--web-hostname',
        'localhost',
      ],
      { APPWRITE_API_KEY: 'temporary-key' }
    );

    const result = await bootstrapMosaicProject(config, {
      services,
      sleep: async () => {},
    });

    expect(services.tablesDB.create).toHaveBeenCalledWith({
      databaseId: 'life_tracker',
      name: 'Life Tracker',
      enabled: true,
    });
    expect(services.tablesDB.createTable).toHaveBeenCalledTimes(8);
    expect(
      services.tablesDB.createTable.mock.calls.map(([input]) => input.tableId)
    ).toEqual([
      'tasks',
      'categories',
      'diary',
      'settings',
      'friendships',
      'profiles',
      'messages',
      'account_deletions',
    ]);
    expect(services.storage.createBucket).toHaveBeenCalledWith(
      expect.objectContaining({ bucketId: 'task_images', fileSecurity: true })
    );
    expect(services.functions.create).toHaveBeenCalledTimes(1);
    expect(services.functions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        functionId: 'message_action',
        execute: ['users'],
        scopes: expect.arrayContaining([
          'rows.write',
          'users.write',
          'files.write',
          'execution.write',
        ]),
      })
    );
    expect(services.functions.createVariable).toHaveBeenCalledWith(
      expect.objectContaining({
        functionId: 'message_action',
        key: 'APPWRITE_DATABASE_ID',
        value: 'life_tracker',
        secret: false,
      })
    );
    expect(services.functions.createDeployment).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      databaseId: 'life_tracker',
      bucketId: 'task_images',
      messageFunctionId: 'message_action',
      drFunctionId: null,
    });
  });

  it('deploys both recovery Functions with schedules forcibly disabled', async () => {
    const services = emptyServices();
    const result = await deployRecoveredProjectFunctions(
      {
        endpoint: 'https://fra.cloud.appwrite.io/v1',
        projectId: 'restored_project',
        apiKey: 'temporary-key',
      },
      { services, sleep: async () => {} }
    );

    expect(services.functions.create).toHaveBeenCalledTimes(2);
    expect(services.functions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'message-action',
        schedule: '',
        execute: ['users'],
      })
    );
    expect(services.functions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'dr-backup',
        schedule: '',
        execute: [],
      })
    );
    expect(
      services.functions.createVariable.mock.calls.some(
        ([input]) => input.secret === true
      )
    ).toBe(false);
    expect(services.functions.get).toHaveBeenCalledTimes(2);
    expect(result.messageFunctionId).toBe('6aa8057f002a4c306fdd');
    expect(result.drFunctionId).toBe('dr_backup');
  });

  it('platform-only mode never inspects or creates backend data', async () => {
    const services = emptyServices();
    const config = parseBootstrapArgs(
      [
        '--project',
        'existing_project',
        '--endpoint',
        'https://fra.cloud.appwrite.io/v1',
        '--platform-only',
        '--web-hostname',
        'mosaic.example.com',
      ],
      { APPWRITE_API_KEY: 'temporary-key' }
    );

    await bootstrapMosaicProject(config, { services });

    expect(services.users.list).not.toHaveBeenCalled();
    expect(services.tablesDB.list).not.toHaveBeenCalled();
    expect(services.tablesDB.create).not.toHaveBeenCalled();
    expect(services.project.createWebPlatform).toHaveBeenCalledOnce();
  });
});
