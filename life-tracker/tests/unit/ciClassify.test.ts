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

  it('skips ordinary AI task pushes until an explicit verification checkpoint', () => {
    for (const ref of [
      'refs/heads/chatgpt/runtime',
      'refs/heads/chatgpt/docs',
      'refs/heads/codex/runtime',
    ]) {
      expect(
        classifyVerifyMode({
          eventName: 'push',
          ref,
          changedFiles: ['life-tracker/src/App.tsx'],
        })
      ).toEqual({ mode: 'skip', browser: false });
    }
  });

  it('runs focused verification only when an AI task checkpoint requests it', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/runtime',
        commitMessage: 'fix: finish task [verify:focused]',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'focused', browser: false });

    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/codex/runtime',
        commitMessage: 'fix: browser behavior [verify:browser]',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'focused', browser: true });
  });

  it('keeps the explicit full marker as a manual escape hatch', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/chatgpt/runtime',
        commitMessage: 'test: force full gate [verify:full]',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'full', browser: true });
  });

  it('runs one full canonical gate on stable Preview branches', () => {
    for (const ref of [
      'refs/heads/feature/calendar',
      'refs/heads/fix/sync',
      'refs/heads/perf/animation',
      'refs/heads/security/backups',
      'refs/heads/refactor/data',
    ]) {
      expect(
        classifyVerifyMode({
          eventName: 'push',
          ref,
          changedFiles: ['life-tracker/src/App.tsx'],
        })
      ).toEqual({ mode: 'full', browser: true });
    }
  });

  it('routes dev pushes through promotion evidence before deciding on a full fallback', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/dev',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'promotion', browser: false });
  });

  it('keeps main and manual dispatches on the full gate', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/main',
        changedFiles: ['life-tracker/src/App.tsx'],
      })
    ).toEqual({ mode: 'full', browser: true });

    expect(
      classifyVerifyMode({
        eventName: 'workflow_dispatch',
        ref: 'refs/heads/chatgpt/runtime',
      })
    ).toEqual({ mode: 'full', browser: true });
  });

  it('retains the lightweight docs mode for non-AI miscellaneous branches', () => {
    expect(
      classifyVerifyMode({
        eventName: 'push',
        ref: 'refs/heads/task/docs',
        changedFiles: [
          'life-tracker/AGENTS.md',
          'life-tracker/docs/DELIVERY.md',
        ],
      })
    ).toEqual({ mode: 'docs', browser: false });
  });
});
