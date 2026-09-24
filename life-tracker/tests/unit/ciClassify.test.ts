import { describe, expect, it } from 'vitest';
import {
  classifyVerifyMode,
  isDocsOnlyPath,
} from '../../scripts/ci-classify.mjs';

describe('CI verification mode classifier', () => {
  it('treats project markdown and docs tree changes as documentation-only', () => {
    expect(isDocsOnlyPath('life-tracker/AGENTS.md')).toBe(true);
    expect(isDocsOnlyPath('life-tracker/SESSION_STATE.md')).toBe(true);
    expect(isDocsOnlyPath('life-tracker/docs/REMOTE_VERIFY.md')).toBe(true);
    expect(isDocsOnlyPath('life-tracker/src/App.tsx')).toBe(false);
    expect(isDocsOnlyPath('.github/workflows/verify.yml')).toBe(false);
  });

  it('uses the lightweight docs gate for ordinary docs-only task pushes', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/docs',
        changedFiles: [
          'life-tracker/AGENTS.md',
          'life-tracker/docs/REMOTE_VERIFY.md',
        ],
      })
    ).toEqual({ mode: 'docs', browser: false });
  });

  it('uses focused verification for ordinary runtime task pushes', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/runtime',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'focused', browser: false });
  });

  it('never downgrades an explicit exact-SHA full acceptance commit', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/docs',
        commitMessage: 'docs: close task [verify:full]',
        changedFiles: ['life-tracker/SESSION_STATE.md'],
      })
    ).toEqual({ mode: 'full', browser: true });
  });

  it('keeps pull requests full unless every changed path is documentation-only', () => {
    expect(
      classifyVerifyMode({
        eventName: 'pull_request',
        ref: 'refs/pull/1/merge',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'full', browser: true });

    expect(
      classifyVerifyMode({
        eventName: 'pull_request',
        ref: 'refs/pull/1/merge',
        changedFiles: ['life-tracker/docs/TEST_WORKFLOW.md'],
      })
    ).toEqual({ mode: 'docs', browser: false });
  });

  it('turns preview pushes into a guard-only run and preserves explicit browser checks', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/preview',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'preview', browser: false });

    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/runtime',
        commitMessage: 'test: interaction [verify:browser]',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'focused', browser: true });
  });
});
