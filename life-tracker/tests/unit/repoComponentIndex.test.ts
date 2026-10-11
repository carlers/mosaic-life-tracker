import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkComponentIndex, eligibleModulePath, expectedComponentIndex,
  listSourceModules, renderComponentIndex, writeComponentIndex,
} from '../../scripts/lib/repo-component-index.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mosaic-repo-index-'));
  const add = (path: string) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'export const value = 1;\n');
  };
  mkdirSync(join(root, 'docs'));
  return { root, add };
}

describe('repository module inventory', () => {
  it('covers real components, page modules, helper modules and route entrypoints without guessing render edges', () => {
    const paths = listSourceModules();
    expect(paths).toContain('src/App.tsx');
    expect(paths).toContain('src/lib/protectedRoutes.ts');
    expect(paths).toContain('src/components/home/views/DayViewSheet.tsx');
    expect(paths).toContain('src/components/home/views/taskReorder.ts');
    expect(paths).toContain('src/pages/BucketListDetailPage.tsx');
    expect(paths.every(eligibleModulePath)).toBe(true);
    expect(checkComponentIndex()).toEqual([]);
  });

  it('is byte-for-byte deterministic and detects additions, moves and deletions', () => {
    const { root, add } = fixture();
    try {
      add('src/components/home/Widget.tsx');
      add('src/pages/HomePage.tsx');
      add('src/App.tsx');
      add('src/lib/protectedRoutes.ts');
      add('src/components/home/widget.test.tsx');
      add('src/components/.scratch/Hidden.tsx');
      writeComponentIndex(root);
      const first = readFileSync(join(root, 'docs/COMPONENT_INDEX.md'), 'utf8');
      writeComponentIndex(root);
      expect(readFileSync(join(root, 'docs/COMPONENT_INDEX.md'), 'utf8')).toBe(first);
      expect(first).toContain('src/components/home/Widget.tsx');
      expect(first).not.toContain('widget.test.tsx');
      expect(first).not.toContain('Hidden.tsx');
      expect(checkComponentIndex(root)).toEqual([]);

      add('src/components/home/New.ts');
      expect(checkComponentIndex(root)).toHaveLength(1);
      writeComponentIndex(root);
      expect(checkComponentIndex(root)).toEqual([]);

      mkdirSync(join(root, 'src/components/ui'), { recursive: true });
      renameSync(join(root, 'src/components/home/Widget.tsx'), join(root, 'src/components/ui/Widget.tsx'));
      expect(checkComponentIndex(root)).toHaveLength(1);
      writeComponentIndex(root);
      const afterMove = expectedComponentIndex(root);
      expect(afterMove).toContain('components/ui');
      expect(afterMove).not.toContain('src/components/home/Widget.tsx');
      unlinkSync(join(root, 'src/components/ui/Widget.tsx'));
      expect(checkComponentIndex(root)).toHaveLength(1);
      writeComponentIndex(root);
      expect(checkComponentIndex(root)).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('escapes potentially hostile filenames in markdown tables and source links', () => {
    const { root, add } = fixture();
    try {
      add('src/components/ui/Bad]|#<name>(v1).tsx');
      add('src/pages/A|B.tsx');
      const output = renderComponentIndex(listSourceModules(root));
      expect(output).toContain('A\\|B');
      expect(output).toContain('Bad\\]\\|#&lt;name&gt;(v1)');
      expect(output).toContain('Bad%5D%7C%23%3Cname%3E%28v1%29.tsx');
      expect(output).not.toContain('](../src/components/ui/Bad]|');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('fails closed if the output file is missing or manually modified', () => {
    const { root, add } = fixture();
    try {
      add('src/pages/SettingsPage.tsx');
      expect(checkComponentIndex(root)[0]).toMatch(/missing/);
      writeComponentIndex(root);
      writeFileSync(join(root, 'docs/COMPONENT_INDEX.md'), 'stale');
      expect(checkComponentIndex(root)[0]).toMatch(/stale/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
