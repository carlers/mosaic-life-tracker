// Regression: TEST_WORKFLOW.md (focused verification handles deleted/renamed tests and version stamps).
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOnlyVersionMetadataChange, planFocusedVerification } from '../../scripts/lib/focused-verification.mjs';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mosaic-focused-'));
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'tests/current.test.ts'), '// existing test\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function plan(changed: string[], verifiedVersionOnly = new Set<string>()) {
  return planFocusedVerification(changed, (path: string) => existsSync(join(root, path)), verifiedVersionOnly);
}

const packageBefore = {
  name: 'life-tracker', version: '0.17.8', private: true,
  scripts: { test: 'vitest run' }, dependencies: { react: '^19.2.8' }, overrides: { safe: '1.0.0' },
};
const lockBefore = {
  name: 'life-tracker', version: '0.17.8', lockfileVersion: 3, requires: true,
  packages: {
    '': { name: 'life-tracker', version: '0.17.8', dependencies: { react: '^19.2.8' } },
    'node_modules/react': { version: '19.2.8', integrity: 'sha512-unchanged' },
  },
};
const stringify = (value: unknown) => JSON.stringify(value, null, 2);
const withVersion = <T extends { version: string }>(value: T, version = '0.17.9'): T =>
  ({ ...value, version });

describe('focused verification selection', () => {
  it('lints existing project code and ignores documentation and outside paths', () => {
    expect(plan(['life-tracker/tests/current.test.ts', 'life-tracker/README.md', '.github/workflows/quality-gate.yml']))
      .toEqual({ lintable: ['tests/current.test.ts'], broad: false, docsContract: true });
  });

  it('excludes deleted code from ESLint without losing broad verification intent', () => {
    expect(plan(['life-tracker/tests/deleted.test.ts', 'life-tracker/vitest.config.ts']))
      .toEqual({ lintable: [], broad: true, docsContract: false });
  });

  it('selects documentation contracts even when no import graph can reach the Markdown', () => {
    expect(plan(['life-tracker/docs/SESSION_STATE.md']).docsContract).toBe(true);
    expect(plan(['AGENTS.md']).docsContract).toBe(true);
    expect(plan(['life-tracker/src/App.tsx']).docsContract).toBe(false);
  });

  it('lints the destination of a rename but not the deleted source', () => {
    expect(plan(['life-tracker/tests/old.test.ts', 'life-tracker/tests/current.test.ts']))
      .toEqual({ lintable: ['tests/current.test.ts'], broad: false, docsContract: false });
  });

  it('recognizes only the package root version change, not configuration edits', () => {
    expect(isOnlyVersionMetadataChange('package.json', stringify(packageBefore), stringify(withVersion(packageBefore)))).toBe(true);
    for (const edited of [
      { ...withVersion(packageBefore), scripts: { test: 'vitest run --coverage' } },
      { ...withVersion(packageBefore), dependencies: { react: '^20.0.0' } },
      { ...withVersion(packageBefore), overrides: { safe: '2.0.0' } },
      { ...packageBefore },
    ]) {
      expect(isOnlyVersionMetadataChange('package.json', stringify(packageBefore), stringify(edited))).toBe(false);
    }
  });

  it('recognizes both lockfile root version stamps while preserving all dependency metadata', () => {
    const versionOnly = { ...lockBefore, version: '0.17.9', packages: {
      ...lockBefore.packages, '': { ...lockBefore.packages[''], version: '0.17.9' },
    } };
    expect(isOnlyVersionMetadataChange('package-lock.json', stringify(lockBefore), stringify(versionOnly))).toBe(true);
    expect(isOnlyVersionMetadataChange('package-lock.json', stringify(lockBefore), stringify({
      ...versionOnly, packages: { ...versionOnly.packages, 'node_modules/react': {
        ...lockBefore.packages['node_modules/react'], integrity: 'sha512-changed',
      } },
    }))).toBe(false);
    expect(isOnlyVersionMetadataChange('package-lock.json', stringify(lockBefore), stringify({
      ...versionOnly, lockfileVersion: 4,
    }))).toBe(false);
    expect(isOnlyVersionMetadataChange('package-lock.json', stringify(lockBefore), stringify({
      ...versionOnly, packages: { ...versionOnly.packages, '': { name: 'life-tracker' } },
    }))).toBe(false);
    expect(isOnlyVersionMetadataChange('package-lock.json', stringify(lockBefore), stringify({
      ...versionOnly, packages: { ...versionOnly.packages, '': { ...versionOnly.packages[''], version: '0.17.7' } },
    }))).toBe(false);
  });

  it('fails closed on missing or malformed package evidence and unknown paths', () => {
    for (const content of ['{bad json', 'null', '[]', '{}', stringify({ name: 'life-tracker' })]) {
      expect(isOnlyVersionMetadataChange('package.json', stringify(packageBefore), content)).toBe(false);
    }
    expect(isOnlyVersionMetadataChange('package.json', undefined as unknown as string, stringify(withVersion(packageBefore)))).toBe(false);
    expect(isOnlyVersionMetadataChange('package-lock.json', stringify(lockBefore), '{bad json')).toBe(false);
    expect(isOnlyVersionMetadataChange('not-package.json', stringify(packageBefore), stringify(withVersion(packageBefore)))).toBe(false);
  });

  it('avoids broad Vitest only for verified version stamps, including the icon-button change shape', () => {
    const paths = [
      'life-tracker/package.json', 'life-tracker/package-lock.json',
      'life-tracker/src/lib/appVersion.ts', 'life-tracker/src/components/home/HomeTaskSearch.tsx',
      'life-tracker/docs/SESSION_STATE.md',
    ];
    expect(plan(paths).broad).toBe(true);
    expect(plan(paths, new Set(['package.json'])).broad).toBe(true);
    expect(plan(paths, new Set(['package.json', 'package-lock.json'])))
      .toEqual({ lintable: [], broad: false, docsContract: true });
    expect(plan([...paths, 'life-tracker/vite.config.ts'], new Set(['package.json', 'package-lock.json'])).broad).toBe(true);
    expect(plan([...paths, 'life-tracker/vitest.config.ts'], new Set(['package.json', 'package-lock.json'])).broad).toBe(true);
  });
});
