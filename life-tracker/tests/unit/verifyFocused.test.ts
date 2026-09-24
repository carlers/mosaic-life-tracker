// Regression: task acceptance — deleting or renaming tests must not break focused CI lint.
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planFocusedVerification } from '../../scripts/lib/focused-verification.mjs';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mosaic-focused-'));
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'tests/current.test.ts'), '// existing test\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function plan(changed: string[]) {
  return planFocusedVerification(changed, (path: string) => existsSync(join(root, path)));
}

describe('focused verification selection', () => {
  it('lints existing project code and ignores documentation and outside paths', () => {
    expect(plan(['life-tracker/tests/current.test.ts', 'life-tracker/README.md', '.github/workflows/quality-gate.yml']))
      .toEqual({ lintable: ['tests/current.test.ts'], broad: false });
  });

  it('excludes deleted code from ESLint without losing broad verification intent', () => {
    expect(plan(['life-tracker/tests/deleted.test.ts', 'life-tracker/vitest.config.ts']))
      .toEqual({ lintable: [], broad: true });
  });

  it('lints the destination of a rename but not the deleted source', () => {
    expect(plan(['life-tracker/tests/old.test.ts', 'life-tracker/tests/current.test.ts']))
      .toEqual({ lintable: ['tests/current.test.ts'], broad: false });
  });
});
