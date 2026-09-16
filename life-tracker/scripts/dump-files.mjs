#!/usr/bin/env node
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: npm run dump -- <path> [<path> ...]');
  process.exit(1);
}

const chunks = [];
for (const p of paths) {
  try {
    const content = readFileSync(p, 'utf8');
    chunks.push(`===FILE:${p}===\n${content}`);
  } catch (err) {
    chunks.push(`===FILE:${p}===\n<<<ERROR: ${err.message}>>>`);
  }
}
const output = chunks.join('\n\n');

process.stdout.write(output);
if (!output.endsWith('\n')) process.stdout.write('\n');

function tryClipboard() {
  const attempts = [];
  if (process.platform === 'darwin') {
    attempts.push(['pbcopy', []]);
  } else if (process.platform === 'win32') {
    attempts.push(['clip', []]);
  } else {
    if (process.env.WAYLAND_DISPLAY) attempts.push(['wl-copy', []]);
    attempts.push(['xclip', ['-selection', 'clipboard']]);
    attempts.push(['xsel', ['--clipboard', '--input']]);
  }
  for (const [cmd, args] of attempts) {
    const res = spawnSync(cmd, args, {
      input: output,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    if (res.status === 0) return cmd;
  }
  return null;
}

const used = tryClipboard();
if (used) {
  console.error(`📋 Copied ${paths.length} file(s) to clipboard via ${used}.`);
} else {
  console.error(
    '⚠️  No clipboard tool available. Content printed to stdout above.'
  );
}
