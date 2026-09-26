import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('verification workflow contracts', () => {
  it('keeps docs, focused, and exact-SHA full verification distinct', () => {
    const workflow = read('../.github/workflows/quality-gate.yml');
    const classifier = read('scripts/ci-classify.mjs');

    expect(workflow).toContain("needs.classify.outputs.mode == 'docs'");
    expect(workflow).toContain("needs.classify.outputs.mode == 'focused'");
    expect(workflow).toContain("needs.classify.outputs.mode == 'full'");
    expect(classifier).toContain('[verify:full]');
    expect(classifier).toContain('[verify:browser]');
    expect(read('docs/DELIVERY.md')).toContain(
      'A focused or docs-only green run is never canonical acceptance'
    );
  });

  it('requires every canonical correctness gate before acceptance', () => {
    const workflow = read('../.github/workflows/quality-gate.yml');
    const acceptance = workflow.split('  canonical_acceptance:')[1] ?? '';

    for (const dependency of [
      'checks',
      'dependency_audit',
      'dom_tests',
      'build_check',
      'browser_contract',
    ]) {
      expect(acceptance).toContain(`- ${dependency}`);
    }
    expect(acceptance).toContain('name: canonical-acceptance');
  });

  it('keeps DOM and browser correctness work sharded with bounded browser workers', () => {
    const workflow = read('../.github/workflows/quality-gate.yml');
    const domJob = (workflow.split('  dom_tests:')[1] ?? '')
      .split('  build_check:')[0];
    const browserJob = (workflow.split('  browser_contract:')[1] ?? '')
      .split('  canonical_acceptance:')[0];
    const playwright = read('playwright.config.mjs');

    for (const job of [domJob, browserJob]) {
      expect(job).toContain('1/2');
      expect(job).toContain('2/2');
    }
    expect(domJob).toContain('npm run test:dom -- --shard=');
    expect(browserJob).toContain('npm run test:browser-contract -- --shard=');
    expect(playwright).toContain('fullyParallel: true');
    expect(playwright).toContain('workers: process.env.CI ? 1 : undefined');
  });

  it('keeps diagnostic performance probing outside browser correctness acceptance', () => {
    const packageJson = JSON.parse(read('package.json'));
    const performanceProbe = read('tests/e2e/performance-probe.spec.mjs');

    expect(packageJson.scripts['test:browser-contract']).toContain(
      '--grep-invert @performance'
    );
    expect(packageJson.scripts['test:performance']).toContain(
      'performance-probe.spec.mjs'
    );
    expect(packageJson.scripts['test:performance']).toContain(
      '--grep @performance'
    );
    expect(performanceProbe).toContain(
      "@performance interaction performance probe"
    );
  });

  it('keeps the documented stable/AI branch model in verification and deployment', () => {
    const workflow = read('../.github/workflows/quality-gate.yml');
    const classifier = read('scripts/ci-classify.mjs');
    const vercel = JSON.parse(read('vercel.json'));

    expect(workflow).toContain('      - main');
    expect(workflow).toContain('      - dev');
    expect(workflow).toContain("      - 'feature/**'");
    expect(workflow).toContain("      - 'refactor/**'");
    expect(workflow).toContain("      - 'chatgpt/**'");
    expect(workflow).toContain("      - 'codex/**'");
    expect(classifier).toContain("branch.startsWith('codex/')");
    expect(classifier).toContain("branch.startsWith('feature/')");
    expect(classifier).toContain("branch.startsWith('refactor/')");

    expect(vercel.git.deploymentEnabled['*']).toBe(false);
    expect(vercel.git.deploymentEnabled.main).toBe(true);
    expect(vercel.git.deploymentEnabled.dev).toBe(true);
    expect(vercel.git.deploymentEnabled['feature/*']).toBe(true);
    expect(vercel.git.deploymentEnabled['refactor/*']).toBe(true);
    expect(vercel.git.deploymentEnabled['chatgpt/*']).toBe(false);
    expect(vercel.git.deploymentEnabled['codex/*']).toBe(false);
  });

  it('keeps the full gate parallel instead of serializing browser work behind logic tests', () => {
    const workflow = read('../.github/workflows/quality-gate.yml');
    const browserJob = (workflow.split('  browser_contract:')[1] ?? '')
      .split('  canonical_acceptance:')[0];

    expect(browserJob).toContain('needs: classify');
    expect(browserJob).not.toContain('needs: checks');
    expect(browserJob).not.toContain('needs: dom_tests');
    expect(browserJob).not.toContain('needs: build_check');
  });
});
