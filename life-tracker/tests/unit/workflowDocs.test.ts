import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('GitHub verification latency contract', () => {
  // Regression: task acceptance — browser contracts must fan out with the other canonical gates.
  it('runs browser verification in parallel and reuses app dependencies while isolating browser packages', () => {
    const verify = read('../.github/workflows/verify.yml');
    const browserJob = (verify.split('  browser_contract:')[1] ?? '')
      .split('  canonical_acceptance:')[0];

    expect(browserJob).toContain('needs: classify');
    expect(browserJob).toContain('shard:');
    expect(browserJob).toContain('1/2');
    expect(browserJob).toContain('2/2');
    expect(browserJob).toContain('Restore app dependencies from focused cache');
    expect(browserJob).toContain('focused-modules-');
    expect(browserJob).toContain('life-tracker/tests/e2e/node_modules');
    expect(browserJob).toContain('~/.cache/ms-playwright');
    expect(browserJob).toContain('npm run test:browser-contract -- --shard=');
    expect(browserJob).not.toContain('playwright install --with-deps chromium');
  });

  it('keeps docs, focused, and exact-SHA full verification distinct', () => {
    const verify = read('../.github/workflows/verify.yml');
    const classifier = read('scripts/ci-classify.mjs');

    expect(verify).toContain("needs.classify.outputs.mode == 'docs'");
    expect(verify).toContain("needs.classify.outputs.mode == 'focused'");
    expect(verify).toContain("needs.classify.outputs.mode == 'full'");
    expect(verify).toContain('Cache focused task dependencies');
    expect(verify).toContain('node scripts/verify-focused.mjs "$BASE"');
    expect(classifier).toContain('[verify:full]');
    expect(classifier).toContain('[verify:browser]');
    expect(read('docs/DELIVERY.md')).toContain(
      'A focused or docs-only green run is never acceptance'
    );
  });

  it('fans canonical work out and aggregates it into one acceptance check', () => {
    const verify = read('../.github/workflows/verify.yml');
    for (const job of [
      'checks',
      'dom_tests',
      'build_check',
      'browser_contract',
    ]) {
      const section = verify.split(`  ${job}:`)[1] ?? '';
      expect(section).toContain('needs: classify');
    }

    const acceptance = verify.split('  canonical_acceptance:')[1] ?? '';
    for (const dependency of [
      'checks',
      'dom_tests',
      'build_check',
      'browser_contract',
    ]) {
      expect(acceptance).toContain(`- ${dependency}`);
    }
    expect(acceptance).toContain('name: canonical-acceptance');
  });

  it('guards Preview with prior exact-SHA canonical acceptance instead of rerunning it', () => {
    const verify = read('../.github/workflows/verify.yml');
    const previewJob = (verify.split('  preview_verified:')[1] ?? '')
      .split('  docs_checks:')[0];

    expect(previewJob).toContain("github.ref == 'refs/heads/preview'");
    expect(previewJob).toContain('check-runs?filter=all');
    expect(previewJob).toContain('.name == "canonical-acceptance"');
    expect(previewJob).not.toContain('npm ci');
    expect(previewJob).not.toContain('npm run build');
  });

  it('does not retain the completed one-time hygiene job in the steady-state workflow', () => {
    const verify = read('../.github/workflows/verify.yml');
    expect(verify).not.toContain('\n  hygiene:');
  });
});


describe('DOM and browser runtime optimization contract', () => {
  // Regression: task acceptance — preserve the complete DOM suite while splitting its CI wall time.
  it('runs the DOM project as two canonical Vitest shards', () => {
    const verify = read('../.github/workflows/verify.yml');
    const domJob = (verify.split('  dom_tests:')[1] ?? '')
      .split('  build_check:')[0];

    expect(domJob).toContain('strategy:');
    expect(domJob).toContain('shard:');
    expect(domJob).toContain('1/2');
    expect(domJob).toContain('2/2');
    expect(domJob).toContain('npm run test:dom -- --shard="${{ matrix.shard }}"');
  });

  // Regression: task acceptance — browser contracts are isolated and may run concurrently,
  // but the worker pool stays bounded so Vite/Chromium do not oversubscribe the CI host.
  it('runs Playwright tests fully parallel across two one-worker CI shards', () => {
    const config = read('playwright.config.mjs');
    const verify = read('../.github/workflows/verify.yml');
    const browserJob = (verify.split('  browser_contract:')[1] ?? '')
      .split('  canonical_acceptance:')[0];

    expect(config).toContain('fullyParallel: true');
    expect(config).toContain('workers: process.env.CI ? 1 : undefined');
    expect(browserJob).toContain('1/2');
    expect(browserJob).toContain('2/2');
  });

  it('combines short static and logic gates so DOM/browser shards are not runner-starved', () => {
    const verify = read('../.github/workflows/verify.yml');
    const checksJob = (verify.split('\n  checks:\n')[1] ?? '')
      .split('\n  dom_tests:')[0];

    expect(checksJob).toContain('npm run lint');
    expect(checksJob).toContain('npm run test:unit');
    expect(checksJob).toContain('npm run test:handlers');
    expect(verify).not.toContain('\n  static_checks:');
    expect(verify).not.toContain('\n  unit_tests:');
    expect(verify).not.toContain('\n  handler_tests:');
  });
});


describe('canonical startup optimization contract', () => {
  // Regression: task acceptance — exact full commits should avoid the repository
  // checkout inside the classifier when their verification intent is already explicit.
  it('short-circuits classifier checkout for explicit full verification intent', () => {
    const verify = read('../.github/workflows/verify.yml');
    const classifyJob = (verify.split('\n  classify:\n')[1] ?? '')
      .split('\n  preview_verified:')[0];

    expect(classifyJob).toContain('Detect immediate verification intent');
    expect(classifyJob).toContain("steps.immediate.outputs.immediate != 'true'");
    expect(classifyJob).toContain('[verify:full]');
  });

  // Regression: task acceptance — only one canonical job needs to prove a fresh
  // lockfile install. The build owns that proof while checks/DOM reuse the exact tree.
  it('keeps one fresh npm install while checks and DOM restore app dependencies', () => {
    const verify = read('../.github/workflows/verify.yml');
    const checksJob = (verify.split('\n  checks:\n')[1] ?? '')
      .split('\n  dom_tests:')[0];
    const domJob = (verify.split('\n  dom_tests:\n')[1] ?? '')
      .split('\n  build_check:')[0];
    const buildJob = (verify.split('\n  build_check:\n')[1] ?? '')
      .split('\n  browser_contract:')[0];

    expect(buildJob).toContain('Install dependencies');
    expect(buildJob).toContain('npm ci --prefer-offline --no-audit');
    expect(buildJob).not.toContain('Restore app dependencies from focused cache');

    for (const job of [checksJob, domJob]) {
      expect(job).toContain('Restore app dependencies from focused cache');
      expect(job).toContain('focused-modules-');
      expect(job).toContain('Install app dependencies on cache miss');
      expect(job).toContain("outputs.cache-hit != 'true'");
    }
  });

  it('avoids restoring the npm download cache when node_modules is already restored', () => {
    const verify = read('../.github/workflows/verify.yml');
    const checksJob = (verify.split('\n  checks:\n')[1] ?? '')
      .split('\n  dom_tests:')[0];
    const domJob = (verify.split('\n  dom_tests:\n')[1] ?? '')
      .split('\n  build_check:')[0];
    const buildJob = (verify.split('\n  build_check:\n')[1] ?? '')
      .split('\n  browser_contract:')[0];
    const browserJob = (verify.split('\n  browser_contract:\n')[1] ?? '')
      .split('\n  canonical_acceptance:')[0];

    for (const job of [checksJob, domJob, browserJob]) {
      expect(job).not.toContain('cache: npm');
    }
  });
});
