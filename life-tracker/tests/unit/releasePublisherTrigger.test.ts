import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const workflow = readFileSync(new URL('../../../.github/workflows/publish-production-release.yml', import.meta.url), 'utf8');
describe('Production Release publisher trigger policy', () => {
  it('limits workflow_run arrivals to main while preserving recovery events', () => {
    expect(workflow).toMatch(/workflow_run:\s*\n\s*workflows:\s*\['Quality Gate'\]\s*\n\s*types:\s*\[completed\]\s*\n\s*branches:\s*\[main\]/);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/cron:\s*'17 \*\/6 \* \* \*'/);
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });
});
