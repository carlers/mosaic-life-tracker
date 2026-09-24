import { describe, expect, it } from 'vitest';
import {
  classifyVerifyMode,
  isDocsOnlyPath,
} from '../../scripts/ci-classify.mjs';

describe('CI verification mode classifier', () => {
  it('treats project markdown and docs tree changes as documentation-only', () => {
    expect(isDocsOnlyPath('AGENTS.md')).toBe(true);
    expect(isDocsOnlyPath('life-tracker/AGENTS.md')).toBe(true);
    expect(isDocsOnlyPath('life-tracker/docs/SESSION_STATE.md')).toBe(true);
    expect(isDocsOnlyPath('life-tracker/docs/DELIVERY.md')).toBe(true);
    expect(isDocsOnlyPath('life-tracker/src/App.tsx')).toBe(false);
    expect(isDocsOnlyPath('.github/workflows/quality-gate.yml')).toBe(false);
  });

  it('uses the lightweight docs gate for ordinary docs-only task pushes', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/docs',
        changedFiles: [
          'life-tracker/AGENTS.md',
          'life-tracker/docs/DELIVERY.md',
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
        changedFiles: ['life-tracker/docs/SESSION_STATE.md'],
      })
    ).toEqual({ mode: 'full', browser: true });
  });

  it('keeps stable branch pull requests on the full canonical gate', () => {
    expect(
      classifyVerifyMode({
        eventName: 'pull_request',
        ref: 'refs/pull/1/merge',
        headRef: 'feature/calendar',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'full', browser: true });
  });

  it('keeps docs-only optimization and browser overrides on AI branches', () => {
    expect(
      classifyVerifyMode({
        eventName: 'pull_request',
        ref: 'refs/pull/1/merge',
        headRef: 'chatgpt/docs',
        changedFiles: ['life-tracker/docs/TEST_WORKFLOW.md'],
      })
    ).toEqual({ mode: 'docs', browser: false });

    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/runtime',
        commitMessage: 'test: interaction [verify:browser]',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'focused', browser: true });
  });

  it('uses focused verification for both AI branch families', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/codex/runtime',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'focused', browser: false });
  });
});
