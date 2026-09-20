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
