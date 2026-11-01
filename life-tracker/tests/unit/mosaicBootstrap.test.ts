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
  it('requires an explicit target project and t¶»§q«^