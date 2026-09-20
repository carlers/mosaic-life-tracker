#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { copyToClipboard } from './clipboard.mjs';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const stages = ['contracts:check', 'lint', 'test', 'build'];
const chunks = [];

function emit(stream, chunk) {
  const text = chunk.toString();
  chunks.push(text);
  stream.write(text);
}

async function runStage(stage) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ['run', stage], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => emit(process.stdout, chunk));
    child.stderr.on('data', (chunk) => emit(process.stderr, chunk));

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        resolve({ code: 1, signal });
        return;
      }
      resolve({ code: code ?? 1, signal: null });
    });
  });
}

let exitCode = 0;

try {
  for (const stage of stages) {
    const result = await runStage(stage);
    if (result.code !== 0) {
      exitCode = result.code;
      break;
    }
  }
} catch (error) {
  const message = `Verify runner failed: ${error instanceof Error ? error.message : String(error)}\n`;
  emit(process.stderr, message);
  exitCode = 1;
}

const output = chunks.join('');
const clipboardOutput = output
  .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/\r(?!\n)/g, '\n');
if (copyToClipboard(clipboardOutput)) {
  process.stderr.write('📋 Verify output copied to clipboard.\n');
} else {
  process.stderr.write(
    '⚠️  Verify finished, but no clipboard tool was available. Output remains in the terminal.\n'
  );
}

process.exitCode = exitCode;
