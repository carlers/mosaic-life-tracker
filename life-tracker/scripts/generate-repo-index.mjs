#!/usr/bin/env node
import { checkComponentIndex, writeComponentIndex } from './lib/repo-component-index.mjs';

const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode) || process.argv.length > 3) {
  console.error('Usage: node scripts/generate-repo-index.mjs [--check|--write]');
  process.exitCode = 2;
} else if (mode === '--write') {
  writeComponentIndex();
  console.log('Updated docs/COMPONENT_INDEX.md');
} else {
  const errors = checkComponentIndex();
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
  if (!errors.length) console.log('Component inventory is current.');
}
