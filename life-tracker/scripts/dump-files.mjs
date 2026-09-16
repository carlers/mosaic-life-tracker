#!/usr/bin/env node
import { readFileSync } from 'fs';
import { copyToClipboard } from './clipboard.mjs';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: npm run dump -- <path> [<path> ...]');
  process.exit(1);
}

const blocks = [];
for (const p of paths) {
  try {
    const content = readFileSync(p, 'utf8');
    const body = content.endsWith('\n') ? content : `${content}\n`;
    blocks.push(`<file path="${p}">\n${body}</file>`);
  } catch (err) {
    blocks.push(`<file path="${p}">\n<<<ERROR: ${err.message}>>>\n</file>`);
  }
}
const output = `${blocks.join('\n\n')}\n`;

process.stdout.write(output);

const copied = copyToClipboard(output);
if (copied) {
  console.error(`📋 Copied ${paths.length} file(s) to clipboard.`);
} else {
  console.error(
    '⚠️  No clipboard tool available. Content printed to stdout above.'
  );
}
