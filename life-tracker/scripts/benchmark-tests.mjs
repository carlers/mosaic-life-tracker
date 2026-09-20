#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { availableParallelism } from 'node:os';

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const runs = Number(valueAfter('--runs') || 3);
const requestedSuite = valueAfter('--suite');
const suites = requestedSuite ? [requestedSuite] : ['unit', 'handlers', 'dom', 'full'];
const commands = {
  unit: ['npm', ['run', 'test:unit']],
  handlers: ['npm', ['run', 'test:handlers']],
  dom: ['npm', ['run', 'test:dom']],
  full: ['npm', ['test']],
};

if (!Number.isInteger(runs) || runs < 1) {
  console.error('--runs must be a positive integer.');
  process.exit(1);
}
for (const suite of suites) {
  if (!commands[suite]) {
    console.error(`Unknown suite "${suite}". Expected: ${Object.keys(commands).join(', ')}.`);
    process.exit(1);
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

console.log(`# Test benchmark\n\nNode ${process.version}; CPUs ${availableParallelism()}; runs ${runs}.`);
for (const suite of suites) {
  const [command, commandArgs] = commands[suite];
  const durations = [];
  for (let run = 1; run <= runs; run += 1) {
    const started = performance.now();
    const result = spawnSync(command, commandArgs, {
      encoding: 'utf8',
      env: process.env,
      shell: process.platform === 'win32',
    });
    const elapsed = (performance.now() - started) / 1000;
    durations.push(elapsed);
    if (result.status !== 0) {
      process.stdout.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      process.exit(result.status || 1);
    }
    console.log(`- ${suite} run ${run}: ${elapsed.toFixed(2)}s`);
  }
  console.log(`- ${suite} median: ${median(durations).toFixed(2)}s`);
}
