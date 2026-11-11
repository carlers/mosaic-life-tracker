import { isAbsolute, posix } from 'node:path';

export const RED_RESULTS = [
  'behavioral-red',
  'structural-red',
  'unrelated-red',
  'unexpected-pass',
];

export function normalizeOverlayPath(input) {
  const normalized = String(input || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || isAbsolute(normalized) || /^[a-z]:\//i.test(normalized) || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Overlay path must be project-relative: ${input || '<empty>'}`);
  }
  if (!normalized.startsWith('tests/')) {
    throw new Error(`Overlay path must stay under tests/: ${input}`);
  }
  const result = posix.normalize(normalized);
  if (!/\.(?:test\.)?[cm]?[jt]sx?$/.test(result)) {
    throw new Error(`Overlay path must be a test or test fixture source file: ${input}`);
  }
  return result;
}

export function buildFocusedTestArgs(testPath, pattern) {
  const args = ['test', '--', normalizeTestPath(testPath)];
  if (pattern) args.push('-t', pattern);
  return args;
}

export function normalizeTestPath(input) {
  const normalized = normalizeOverlayPath(input);
  if (!/\.test\.[cm]?[jt]sx?$/.test(normalized)) {
    throw new Error(`Test path must name a *.test source file: ${input}`);
  }
  return normalized;
}

const ASSERTION_FAILURE = /\bAssertionError\b|Assertion failed|Expected:\s*[\s\S]*Received:/i;

// A red exit from one test is not evidence that the requested test failed.
// Vitest's failure summary names the file and complete test title.
function hasRequestedAssertionFailure(output, testPath, pattern) {
  let namePattern;
  if (pattern) {
    try {
      namePattern = new RegExp(pattern);
    } catch {
      return false;
    }
  }
  const clean = output.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const blocks = clean.split(/(?=^\s*FAIL\s+)/m);
  return blocks.some((block) => {
    const header = block.match(
      /^\s*FAIL\s+(?:(?:unit|dom|handlers)\s+)?(\S+\.test\.[cm]?[jt]sx?)\s+>\s+([^\r\n]+)/
    );
    if (!header || header[1].replaceAll('\\', '/') !== testPath) return false;
    if (namePattern && !namePattern.test(header[2])) return false;
    return ASSERTION_FAILURE.test(block.slice(header[0].length));
  });
}

export function classifyRedResult({ exitCode, output, testPath, pattern }) {
  if (exitCode === 0) return 'unexpected-pass';
  if (exitCode == null) return 'unrelated-red';
  if (/cannot find (?:module|package)|failed to load url|does not provide an export|module not found|TS2307|SyntaxError|failed to parse|transform failed/i.test(output)) {
    return 'structural-red';
  }
  if (/ECONN(?:REFUSED|RESET)|ENETUNREACH|EAI_AGAIN|out of memory|ENOMEM|ENOSPC|EACCES|timed out|timeout|network error|failed to fetch|socket hang up|worker exited unexpectedly/i.test(output)) {
    return 'unrelated-red';
  }
  // A nonzero exit alone is not proof that the intended assertion ran. Be
  // conservative: unknown exceptions and fixture/setup failures need review.
  if (ASSERTION_FAILURE.test(output)) {
    return testPath && hasRequestedAssertionFailure(output, testPath, pattern)
      ? 'behavioral-red' : 'unrelated-red';
  }
  return 'unrelated-red';
}
