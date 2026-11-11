import assert from 'node:assert/strict';
import test from 'node:test';
import { planFocusedVerification } from '../lib/focused-verification.mjs';

const plan = (...paths) =>
  planFocusedVerification(paths, () => true).forcedProjects;

test('dr-backup Function source and config changes verify both handler and unit security contracts', () => {
  for (const path of [
    'life-tracker/appwrite-functions/dr-backup/main.mjs',
    'life-tracker/appwrite-functions/dr-backup/privacy-deletion.mjs',
    'life-tracker/appwrite-functions/dr-backup/function.config.json',
  ]) {
    assert.deepEqual(
      [...plan(path)].sort(),
      ['handlers', 'unit'],
      `Missing focused DR backup authorization coverage for ${path}`,
    );
  }
});

test('account deletion worker changes select unit erasure-policy parity alongside handler security tests', () => {
  assert.deepEqual(
    plan('life-tracker/appwrite-functions/message-action/account-deletion.js'),
    ['handlers', 'unit'],
  );
  assert.deepEqual(
    plan(
      'life-tracker/appwrite-functions/message-action/main.js',
      'life-tracker/appwrite-functions/message-action/account-deletion.js',
    ),
    ['handlers', 'unit'],
  );
});

test('tombstone GC dispatcher changes verify the documentation inventory unit contract', () => {
  assert.deepEqual(
    plan('life-tracker/appwrite-functions/message-action/tombstone-gc.js'),
    ['handlers', 'unit'],
  );
});

test('combined Function changes do not execute the same test project twice', () => {
  assert.deepEqual(
    [...plan(
      'life-tracker/appwrite-functions/message-action/index.js',
      'life-tracker/appwrite-functions/dr-backup/function.config.json',
    )].sort(),
    ['handlers', 'unit'],
  );
});

for (const path of [
  'appwrite-functions/message-action/chat-photo-auth.js',
  'appwrite-functions/message-action/chat-photo-orphans.js',
  'appwrite-functions/message-action/main.js',
]) {
  test(`${path} changes select CommonJS-backed unit security contracts`, () => {
    assert.deepEqual(
      plan(`life-tracker/${path}`),
      ['handlers', 'unit'],
    );
  });
}

test('subprocess-only CLI owner changes run their unit regression project', () => {
  for (const path of [
    'life-tracker/scripts/check-test-discovery.mjs',
    'life-tracker/scripts/create-handoff.mjs',
  ]) {
    assert.deepEqual(plan(path), ['unit'], 'Missing subprocess CLI unit ownership for ' + path);
  }
});

test('unrelated app changes do not force server Function projects', () => {
  assert.deepEqual(plan('life-tracker/src/lib/taskDate.ts'), []);
});
