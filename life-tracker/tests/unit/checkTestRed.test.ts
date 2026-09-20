import {
  buildFocusedTestArgs,
  classifyRedResult,
  normalizeOverlayPath,
} from '../../scripts/lib/check-test-red.mjs';

describe('isolated red-test helper', () => {
  // Regression: AGENTS.md — Definition of done
  it('classifies expected assertion, structural, unrelated, and unexpected-pass results', () => {
    expect(classifyRedResult({ exitCode: 1, output: 'AssertionError: expected false to be true' }))
      .toBe('behavioral-red');
    expect(classifyRedResult({ exitCode: 1, output: "Cannot find module './new-helper'" }))
      .toBe('structural-red');
    expect(classifyRedResult({ exitCode: 1, output: 'Error: connect ECONNREFUSED 127.0.0.1' }))
      .toBe('unrelated-red');
    expect(classifyRedResult({ exitCode: null, output: 'spawn npm failed' })).toBe('unrelated-red');
    expect(classifyRedResult({ exitCode: 0, output: '1 passed' })).toBe('unexpected-pass');
  });

  it('builds one narrow Vitest command and rejects escaping overlay paths', () => {
    expect(buildFocusedTestArgs('tests/unit/example.test.ts', 'rejects invalid input')).toEqual([
      'test', '--', 'tests/unit/example.test.ts', '-t', 'rejects invalid input',
    ]);
    expect(normalizeOverlayPath('tests/unit/example.test.ts')).toBe('tests/unit/example.test.ts');
    expect(() => normalizeOverlayPath('../secret.test.ts')).toThrow(/project-relative/);
    expect(() => normalizeOverlayPath('/tmp/secret.test.ts')).toThrow(/project-relative/);
    expect(() => normalizeOverlayPath('C:\\tmp\\secret.test.ts')).toThrow(/project-relative/);
    expect(() => normalizeOverlayPath('src/example.ts')).toThrow(/tests\//);
    expect(() => normalizeOverlayPath('tests/fixture.json')).toThrow(/source file/);
    expect(() => buildFocusedTestArgs('tests/helpers/fixture.ts')).toThrow(/\*\.test/);
  });
});
