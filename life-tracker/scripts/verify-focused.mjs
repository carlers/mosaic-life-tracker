#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { planFocusedVerification } from './lib/focused-verification.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const base = process.argv[2] ?? 'HEAD^';

function run(command, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    let output = '';
    if (capture) child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal || code !== 0) reject(new Error(`${command} exited with ${signal ?? code}`));
      else resolve(output);
    });
  });
}

await run(npm, ['run', 'contracts:check']);
await run(npm, ['run', 'test:discovery']);

const diff = await run('git', ['-C', '..', 'diff', '--name-only', base, 'HEAD'], true);
const changed = diff.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
const { lintable, broad } = planFocusedVerification(changed);

if (lintable.length > 0) {
  await run(npx, ['--no-install', 'eslint', ...lintable]);
}

if (broad) {
  await run(npm, ['test', '--', '--passWithNoTests']);
} else {
  await run(npx, ['--no-install', 'vitest', 'run', '--changed', base, '--passWithNoTests']);
}

process.stdout.write(
  `Focused verification passed for ${changed.length} changed file(s). Full canonical acceptance runs after squash on the stable Preview branch.\n`
);
