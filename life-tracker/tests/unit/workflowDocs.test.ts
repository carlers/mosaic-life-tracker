import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('test-evidence workflow documentation', () => {
  // Regression: AGENTS.md — Definition of done
  it('requires the evidence review before the acceptance gate without judging adequacy', () => {
    const agents = read('AGENTS.md');
    expect(agents).toContain('Before the acceptance gate, run a test-evidence review');
    expect(agents).toContain('No judgment of overall suite sufficiency is made here.');
  });

  it('documents coverage statuses, red classifications, and manual exceptions', () => {
    const workflow = read('docs/TEST_WORKFLOW.md');
    for (const value of [
      'existing-direct',
      'existing-indirect',
      'added-red-green',
      'behavioral-red',
      'structural-red',
      'unrelated-red',
      'manual',
      'skipped',
      'not-applicable',
    ]) {
      expect(workflow).toContain(`\`${value}\``);
    }
    expect(workflow.replace(/\s+/g, ' ')).toContain('does not decide whether coverage is adequate');
  });
});

describe('GitHub verification latency contract', () => {
  // Regression: task acceptance — browser contracts must fan out with the other canonical gates.
  it('runs browser verification in parallel and caches prepared browser dependencies plus Chromium', () => {
    const verify = read('../.github/workflows/verify.yml');
    const browserJob = (verify.split('  browser_contract:')[1] ?? '')
      .split('  canonical_acceptance:')[0];

    expect(browserJob).toContain('needs: classify');
    expect(browserJob).not.toContain('static_checks');
    expect(browserJob).not.toContain('unit_tests');
    expect(browserJob).not.toContain('dom_tests');
    expect(browserJob).toContain('Cache prepared browser test dependencies');
    expect(browserJob).toContain('life-tracker/node_modules');
    expect(browserJob).toContain('~/.cache/ms-playwright');
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
    expect(read('docs/REMOTE_VERIFY.md')).toContain(
      'A focused or docs-only green run is never acceptance'
    );
  });

  it('fans canonical work out and aggregates it into one acceptance check', () => {
    const verify = read('../.github/workflows/verify.yml');
    for (const job of [
      'static_checks',
      'unit_tests',
      'handler_tests',
      'dom_tests',
      'build_check',
      'browser_contract',
    ]) {
      const section = verify.split(`  ${job}:`)[1] ?? '';
      expect(section).toContain('needs: classify');
    }

    const acceptance = verify.split('  canonical_acceptance:')[1] ?? '';
    for (const dependency of [
      'static_checks',
      'unit_tests',
      'handler_tests',
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
  it('runs Playwright tests fully parallel with a bounded CI worker pool', () => {
    const config = read('playwright.config.mjs');

    expect(config).toContain('fullyParallel: true');
    expect(config).toContain('workers: process.env.CI ? 2 : undefined');
  });
});
