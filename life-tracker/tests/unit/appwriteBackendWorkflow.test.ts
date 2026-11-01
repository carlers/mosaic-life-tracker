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
  runAppwriteMigrateCli,
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
        ['--confirm-project', 'scratch']¶»§q«^