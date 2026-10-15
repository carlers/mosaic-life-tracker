#!/usr/bin/env node
// Read-only, point-in-time old-client check before changing shared Scratch schema.
// This validates remote rows against actual historical mapping and strict RxDB
// schemas. It is not a replacement for Function authorization or live UI tests.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import Ajv from 'ajv';
import ts from 'typescript';
import { MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

export const SYNCED_TABLE_IDS = {
  bucket_task_links: 'bucketTaskLinks',
  bucket_list_items: 'bucketList',
  tasks: 'tasks',
  categories: 'categories',
  diary: 'diary',
  settings: 'settings',
  friendships: 'friendships',
  messages: 'messages',
};
const TIME = '2026-01-01T00:00:00.000Z';
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function sourceAt(sha, path) {
  return execFileSync('git', ['-C', REPO_ROOT, 'show', sha + ':' + path], {
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
}

function evaluateTypeScript(source, filename) {
  // Source is taken only from explicitly selected, reviewed Git commits.
  // No imports/runtime filesystem/API capability is supplied to old modules.
  // A new runtime dependency fails closed rather than being silently mocked.
  const js = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, console: { warn() {} } }, {
    filename,
    timeout: 2000,
  });
  return exports;
}

export function sampleRemoteRow(table) {
  const row = {
    $id: 'compat_row_1',
    $createdAt: TIME,
    $updatedAt: TIME,
    $permissions: [],
  };
  for (const column of table.columns) {
    const key = column.key;
    if (key === 'visibility') row[key] = 'private';
    else if (key === 'status') row[key] = 'accepted';
    else if (key === 'direction') row[key] = 'incoming';
    else if (key === 'delivery_status') row[key] = 'delivered';
    else if (key === 'created_at' || key === 'updated_at') row[key] = TIME;
    else if (key === 'date') row[key] = '2026-01-01';
    else if (column.type === 'boolean') row[key] = false;
    else if (column.type === 'integer') row[key] = 0;
    else if (['varchar', 'text', 'longtext'].includes(column.type)) row[key] = 'compat';
    else throw new Error('Unsupported test column type: ' + table.id + '.' + key + ' (' + column.type + ')');
  }
  // Verify future additive columns are ignored locally, not just the columns
  // already checked into this source manifest.
  row.future_scratch_column = 'server-only';
  return row;
}

export function checkConsumerRows({ fromAppwriteFormat, schemas, tables = MOSAIC_TABLES }) {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const failures = [];
  for (const [tableId, collection] of Object.entries(SYNCED_TABLE_IDS)) {
    const table = tables.find((t) => t.id === tableId);
    const schema = schemas[collection + 'Schema'];
    if (!table || !schema || typeof fromAppwriteFormat !== 'function') {
      failures.push(tableId + ': missing table, mapper or local schema');
      continue;
    }
    try {
      const remote = sampleRemoteRow(table);
      const local = fromAppwriteFormat(remote, collection);
      const validate = ajv.compile({
        type: 'object',
        properties: schema.properties,
        required: schema.required,
        additionalProperties: false,
      });
      if (!validate(local)) {
        failures.push(tableId + ': ' + ajv.errorsText(validate.errors, { separator: '; ' }));
      }
      if ('future_scratch_column' in local) {
        failures.push(tableId + ': new server-only column reached local RxDB');
      }
      if (!('future_scratch_column' in remote)) {
        failures.push(tableId + ': old client mutated remote input');
      }
    } catch (error) {
      failures.push(tableId + ': ' + error.message);
    }
  }
  return failures;
}

// Read-only dry run of the historical client's outgoing payload. This verifies
// schema shape, NOT old-client server authorization or non-destructive merge behavior.
export function checkConsumerWrites({ fromAppwriteFormat, toAppwriteFormat, tables = MOSAIC_TABLES }) {
  const failures = [];
  for (const [tableId, collection] of Object.entries(SYNCED_TABLE_IDS)) {
    const table = tables.find((item) => item.id === tableId);
    if (!table || typeof fromAppwriteFormat !== 'function' || typeof toAppwriteFormat !== 'function') {
      failures.push(tableId + ': missing table or writer');
      continue;
    }
    try {
      const remote = sampleRemoteRow(table);
      const local = fromAppwriteFormat(remote, collection);
      const payload = toAppwriteFormat(local, collection, 'compat_owner');
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        failures.push(tableId + ': writer returned a non-object payload');
        continue;
      }
      const columns = new Map(table.columns.map((column) => [column.key, column]));
      for (const [key, value] of Object.entries(payload)) {
        const column = columns.get(key);
        if (!column) {
          failures.push(tableId + ': writer emits undeclared column ' + key);
          continue;
        }
        if (value === undefined || value === null) {
          failures.push(tableId + ': writer emits nullish column ' + key);
        } else if (column.type === 'boolean' && typeof value !== 'boolean') {
          failures.push(tableId + ': writer emits non-boolean column ' + key);
        } else if (column.type === 'integer' && (!Number.isInteger(value))) {
          failures.push(tableId + ': writer emits non-integer column ' + key);
        } else if (['varchar', 'text', 'longtext'].includes(column.type) && typeof value !== 'string') {
          failures.push(tableId + ': writer emits non-string column ' + key);
        } else if (column.type === 'varchar' && typeof value === 'string' && value.length > column.size) {
          failures.push(tableId + ': writer exceeds varchar size for ' + key);
        }
      }
      for (const column of table.columns.filter((item) => item.required)) {
        if (!(column.key in payload)) {
          failures.push(tableId + ': writer omits required column ' + column.key);
        }
      }
      if (payload.user_id !== 'compat_owner') {
        failures.push(tableId + ': writer does not enforce the authenticated owner');
      }
      if ('future_scratch_column' in payload) {
        failures.push(tableId + ': writer echoed unknown remote column');
      }
    } catch (error) {
      failures.push(tableId + ': writer evaluation failed: ' + error.message);
    }
  }
  return failures;
}

export function checkConsumerSource({ sha, readSource = sourceAt, tables = MOSAIC_TABLES }) {
  const mapper = evaluateTypeScript(
    readSource(sha, 'life-tracker/src/lib/syncMapping.ts'),
    sha + '/syncMapping.ts'
  );
  const schemas = evaluateTypeScript(
    readSource(sha, 'life-tracker/src/db/schema.ts'),
    sha + '/schema.ts'
  );
  return [
    ...checkConsumerRows({ fromAppwriteFormat: mapper.fromAppwriteFormat, schemas, tables }),
    ...checkConsumerWrites({
      fromAppwriteFormat: mapper.fromAppwriteFormat,
      toAppwriteFormat: mapper.toAppwriteFormat,
      tables,
    }),
  ];
}

function main(argv) {
  if (!argv.length || argv.length % 2 !== 0) {
    throw new Error('Usage: npm run appwrite:preview:compat -- --consumer-sha <40-character-commit-sha> [--consumer-sha ...]');
  }
  const commits = [];
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] !== '--consumer-sha' || !/^[a-f0-9]{40}$/.test(argv[i + 1])) {
      throw new Error('Each consumer must be an explicitly selected immutable 40-character SHA');
    }
    commits.push(argv[i + 1]);
  }
  for (const sha of new Set(commits)) {
    const failures = checkConsumerSource({ sha });
    if (failures.length) {
      console.error('BLOCKED: consumer ' + sha + ' cannot read candidate Scratch rows:');
      for (const failure of failures) console.error('  ' + failure);
      process.exitCode = 1;
    } else {
      console.log('PASS: consumer ' + sha + ' accepts candidate Scratch row and write shapes in all eight synced collections');
    }
  }
  if (process.exitCode) {
    console.error('Do not apply a shared schema change. Upgrade/reaccept affected consumers or resolve the compatibility gap. Writer shape alone does not prove server authorization or update merge safety.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]))) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error('Scratch consumer compatibility preflight failed: ' + error.message);
    process.exitCode = 1;
  }
}
