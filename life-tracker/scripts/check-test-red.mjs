#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFocusedTestArgs,
  classifyRedResult,
  normalizeOverlayPath,
  normalizeTestPath,
} from './lib/check-test-red.mjs';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim();
const projectFromRepo = relative(repoRoot, projectRoot);

function parseOptions(values) {
  const options = { fixtures: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    if (key === 'allow-dirty') options.allowDirty = true;
    else {
      const next = values[index + 1];
      if (!next || next.startsWith('--')) throw new Error(`Missing value for --${key}`);
      if (key === 'fixture') options.fixtures.push(next);
      else options[key] = next;
      index += 1;
    }
  }
  return options;
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function copyOverlay(path, isolatedProject) {
  const normalized = normalizeOverlayPath(path);
  const source = join(projectRoot, normalized);
  if (!existsSync(source)) throw new Error(`Overlay file does not exist: ${normalized}`);
  const realSource = realpathSync(source);
  const fromTests = relative(realpathSync(join(projectRoot, 'tests')), realSource);
  if (!fromTests || fromTests.startsWith('..') || isAbsolute(fromTests)) {
    throw new Error(`Overlay file resolves outside tests/: ${normalized}`);
  }
  const destination = join(isolatedProject, normalized);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return normalized;
}

let temporary;
let worktreeRoot;
let attached = false;

try {
  const options = parseOptions(process.argv.slice(2));
  const base = options.base;
  const testPath = normalizeTestPath(options.test);
  if (!base) throw new Error('Missing value for --base');
  git(['cat-file', '-e', `${base}^{commit}`]);
  const dirty = git(['status', '--short', '--', '.']);
  if (dirty && !options.allowDirty) {
    throw new Error('Active worktree is dirty; rerun with --allow-dirty to copy only declared overlays');
  }

  temporary = mkdtempSync(join(tmpdir(), 'mosaic-test-red-'));
  worktreeRoot = join(temporary, 'worktree');
  git(['worktree', 'add', '--detach', worktreeRoot, base]);
  attached = true;
  const isolatedProject = join(worktreeRoot, projectFromRepo);
  const overlays = [testPath, ...options.fixtures.map(normalizeOverlayPath)];
  overlays.forEach((path) => copyOverlay(path, isolatedProject));
  symlinkSync(join(projectRoot, 'node_modules'), join(isolatedProject, 'node_modules'), 'dir');

  const args = buildFocusedTestArgs(testPath, options.pattern);
  const run = spawnSync('npm', args, {
    cwd: isolatedProject,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
  const output = `${run.stdout || ''}${run.stderr || ''}${run.error ? `\n${run.error}` : ''}`;
  const classification = classifyRedResult({ exitCode: run.status, output });
  const result = {
    base: git(['rev-parse', '--short', base]),
    testPath,
    pattern: options.pattern || null,
    overlays,
    classification,
    exitCode: run.status,
    failureSignature: output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /(?:AssertionError|Error:|FAIL |× )/.test(line)) || '(no normalized failure line)',
  };
  console.log(JSON.stringify(result, null, 2));
  if (classification === 'unexpected-pass' || classification === 'unrelated-red') process.exitCode = 1;
} catch (error) {
  console.error(`Red-test check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (attached && worktreeRoot) {
    try {
      git(['worktree', 'remove', '--force', worktreeRoot]);
    } catch (error) {
      console.error(`Red-test cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
