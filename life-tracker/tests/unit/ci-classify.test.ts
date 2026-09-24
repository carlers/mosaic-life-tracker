import { describe, expect, it } from 'vitest';
import { classifyVerifyMode } from '../../scripts/ci-classify.mjs';

describe('CI branch classification', () => {
  it.each([
    ['main', { mode: 'full', browser: true }],
    ['dev', { mode: 'full', browser: true }],
    ['feature/calendar', { mode: 'full', browser: true }],
  ])('runs canonical verification on %s', (branch, expected) => {
    expect(classifyVerifyMode({
      eventName: 'push',
      ref: `refs/heads/${branch}`,
      changedFiles: ['life-tracker/src/example.ts'],
    })).toEqual(expected);
  });

  it.each(['chatgpt/task', 'codex/task'])('uses focused verification on %s', (branch) => {
    expect(classifyVerifyMode({
      eventName: 'push',
      ref: `refs/heads/${branch}`,
      changedFiles: ['life-tracker/src/example.ts'],
    })).toEqual({ mode: 'focused', browser: false });
  });

  it('allows browser coverage on a focused branch when explicitly requested', () => {
    expect(classifyVerifyMode({
      eventName: 'push',
      ref: 'refs/heads/chatgpt/task',
      commitMessage: '[verify:browser]',
      changedFiles: ['life-tracker/src/example.ts'],
    })).toEqual({ mode: 'focused', browser: true });
  });

  it('keeps docs-only optimization for temporary branches', () => {
    expect(classifyVerifyMode({
      eventName: 'push',
      ref: 'refs/heads/chatgpt/docs',
      changedFiles: ['life-tracker/docs/DELIVERY.md'],
    })).toEqual({ mode: 'docs', browser: false });
  });

  it('lets full verification override focused classification', () => {
    expect(classifyVerifyMode({
      eventName: 'push',
      ref: 'refs/heads/codex/task',
      commitMessage: '[verify:full]',
      changedFiles: ['life-tracker/src/example.ts'],
    })).toEqual({ mode: 'full', browser: true });
  });

  it('classifies AI pull requests by their source branch', () => {
    expect(classifyVerifyMode({
      eventName: 'pull_request',
      ref: 'refs/pull/42/merge',
      headRef: 'chatgpt/task',
      changedFiles: ['life-tracker/src/example.ts'],
    })).toEqual({ mode: 'focused', browser: false });
  });
});
