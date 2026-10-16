#!/usr/bin/env node
// Git-only release compatibility preflight. No Appwrite or Vercel access.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { subscribedTableIds, checkConsumerSource } from './check-scratch-client-compat.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const POLICY = fileURLToPath(new URL('../config/backend-client-compatibility.json', import.meta.url));
const SHA = /^[0-9a-f]{40}$/;
const TRIGGERS = [
  /^life-tracker\/infrastructure\/mosaic-backend\.mjs$/,
  /^life-tracker\/scripts\/(?:appwrite-migrate|migrate-[a-z0-9-]+)\.mjs$/,
  /^life-tracker\/src\/(?:lib\/syncMapping|db\/(?:schema|replicationIds))\.ts$/,
  /^life-tracker\/appwrite-functions\//,
  /^life-tracker\/(?:scripts\/check-(?:scratch-client|backend-consumer)-compat\.mjs|config\/backend-client-compatibility\.json)$/,
];

export function needsConsumerCompatibilityCheck(paths) {
  return paths.some(path => TRIGGERS.some(pattern => pattern.test(path)));
}

export function validateConsumerPolicy(policy) {
  if (!policy || policy.version !== 1 || !Array.isArray(policy.consumers) ||
      policy.consumers.length === 0 || !Array.isArray(policy.legacyPendingRetirement)) {
    throw new Error('Compatibility policy must define version=1, nonempty consumers and legacyPendingRetirement');
  }
  const all = [...policy.consumers, ...policy.legacyPendingRetirement];
  const seen = new Set();
  for (const entry of all) {
    if (!entry || typeof entry.label !== 'string' || !entry.label.trim() ||
        typeof entry.sha !== 'string' || !SHA.test(entry.sha) ||
        seen.has(entry.sha)) {
      throw new Error('Compatibility policy requires uniquely pinned 40-character SHAs and labels');
    }
    seen.add(entry.sha);
  }
  for (const entry of policy.legacyPendingRetirement) {
    if (typeof entry.requirement !== 'string' || !entry.requirement.trim()) {
      throw new Error('Unretired historical client needs an explicit release-blocking requirement');
    }
  }
  return policy;
}

export function parseCompatibilityArgs(args) {
  let base = 'HEAD^', all = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      base = args[++i];
    } else if (args[i] === '--all') {
      all = true;
    } else {
      throw new Error('Usage: [--base <Git ref>] [--all]');
    }
  }
  // A Git ref is a revision, not a shell expression. Never use shell execution.
  if (!/^[0-9a-zA-Z_./^-]{1,128}$/.test(base) || base.startsWith('-')) {
    throw new Error('Invalid Git base ref');
  }
  return { base, all };
}

export function checkPinnedConsumers({
  policy,
  readSource,
  checkSource = checkConsumerSource,
  subscriptions = subscribedTableIds,
}) {
  validateConsumerPolicy(policy);
  const failures = [];
  const checked = [];
  for (const entry of policy.consumers) {
    try {
      const tableIds = subscriptions({ sha: entry.sha, readSource });
      const errors = checkSource({ sha: entry.sha, readSource, tableIds });
      checked.push({ label: entry.label, sha: entry.sha, tableIds });
      for (const error of errors) failures.push(entry.label + ': ' + error);
    } catch (error) {
      failures.push(entry.label + ': ' + error.message);
    }
  }
  return { checked, failures };
}

function git(args, opts = {}) {
  return execFileSync('git', ['-C', REPO, ...args], {
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...opts,
  });
}

function historicalSource(sha, path) {
  return git(['show', sha + ':' + path]);
}

function makeHistoryAvailable(sha) {
  try {
    git(['cat-file', '-e', sha + '^{commit}']);
  } catch {
    // Fetch only a single explicitly pinned commit if shallow CI lacks it;
    // no full clone or implicit floating branch ref.
    git(['fetch', '--no-tags', '--depth=1', 'origin', sha], { stdio: 'pipe' });
    git(['cat-file', '-e', sha + '^{commit}']);
  }
}

function main(argv) {
  const { base, all } = parseCompatibilityArgs(argv);
  const policy = validateConsumerPolicy(JSON.parse(readFileSync(POLICY, 'utf8')));
  const changed = git(['diff', '--name-only', base, 'HEAD'])
    .split(/\r?\n/).filter(Boolean);
  if (!all && !needsConsumerCompatibilityCheck(changed)) {
    console.log('Client/backend contract unchanged; historical compatibility preflight skipped.');
    return;
  }
  for (const item of policy.legacyPendingRetirement) {
    console.warn('UNRETIRED (' + item.label + ', ' + item.sha + '): ' + item.requirement);
  }
  for (const item of policy.consumers) makeHistoryAvailable(item.sha);
  const { checked, failures } = checkPinnedConsumers({
    policy, readSource: historicalSource,
  });
  for (const item of checked) {
    console.log('CHECKED ' + item.label + ' (' + item.sha + '), subscriptions: ' +
      item.tableIds.join(', '));
  }
  if (failures.length) {
    for (const failure of failures) console.error('BLOCKED: ' + failure);
    throw new Error('A supported historical client cannot read/write the candidate backend schema');
  }
  console.log('PASS: ' + checked.length + ' pinned historical client contract(s). ' +
    'Not live Appwrite authorization, merge semantics, PWA update or offline acceptance.');
}

const isDirectRun = process.argv[1] &&
  fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]));
if (isDirectRun) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error('Client/backend compatibility preflight failed: ' + error.message);
    process.exitCode = 1;
  }
}
