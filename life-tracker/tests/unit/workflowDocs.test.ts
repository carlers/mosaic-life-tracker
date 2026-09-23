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
  // Regression: task acceptance — browser contracts must not serialize behind the canonical gate.
  it('runs browser verification in parallel and caches prepared browser dependencies plus Chromium', () => {
    const verify = read('../.github/workflows/verify.yml');
    const browserJob = verify.split('  browser-contract:')[1] ?? '';

    expect(browserJob).not.toMatch(/^\s+needs:\s*verify/m);
    expect(browserJob).toContain('Cache prepared browser test dependencies');
    expect(browserJob).toContain('life-tracker/node_modules');
    expect(browserJob).toContain('~/.cache/ms-playwright');
    expect(browserJob).not.toContain('playwright install --with-deps chromium');
  });

  it('keeps focused chatgpt pushes separate from final full verification', () => {
    const verify = read('../.github/workflows/verify.yml');
    expect(verify).toContain('Cache focused task dependencies');
    expect(verify).toContain('node scripts/verify-focused.mjs HEAD^');
    expect(verify).toContain('[verify:full]');
    expect(verify).toContain('[verify:browser]');
    expect(read('docs/REMOTE_VERIFY.md')).toContain('A focused green run is never acceptance');
  });

  it('does not retain the completed one-time hygiene job in the steady-state workflow', () => {
    const verify = read('../.github/workflows/verify.yml');
    expect(verify).not.toContain('\n  hygiene:');
  });
});
