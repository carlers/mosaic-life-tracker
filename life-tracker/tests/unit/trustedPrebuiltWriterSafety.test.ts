import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('protected main prebuilt writer remains optional and restricted (#592)', () => {
  it('keeps read-only receiver independent of Vercel credentials and gates uploads behind explicit flag', async () => {
    const workflow = await readFile(
      resolve(process.cwd(), '../.github/workflows/trusted-preview-delivery.yml'), 'utf8');
    const [shadow, writer] = workflow.split('\n  trusted_prebuilt_deploy:\n');
    expect(shadow).toContain('run: node life-tracker/scripts/run-trusted-prebuilt-receiver.mjs');
    expect(shadow).not.toContain('VERCEL_TOKEN');
    expect(shadow).not.toContain('environment: mosaic-preview-auto');
    expect(writer).toContain("vars.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED == 'true'");
    expect(writer).toContain('needs: trusted_preview');
    expect(writer).toContain('environment: mosaic-preview-auto');
    expect(writer).toContain('cancel-in-progress: false');
    expect(writer).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(writer).toContain("github.event.workflow_run.head_branch == 'fix/592-trusted-archive-20261014'");
    expect(writer).toContain("github.event.workflow_run.head_branch == 'feature/592-prebuilt-pilot-20261014'");
    for (const category of ['feature', 'fix', 'perf', 'security', 'refactor']) {
      expect(workflow).toContain("      - '" + category + "/**'");
    }
    expect(shadow).toContain("vars.MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED == 'true'");
    expect(shadow).toContain('steps.read_only_admission.outputs.admitted');
    expect(writer).toContain("needs.trusted_preview.outputs.admitted == 'true'");
    expect(writer).toContain("vars.MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED == 'true'");
    expect(writer).toContain('npm install --global vercel@62.7.0');
    expect(writer.indexOf('npm install --global vercel@62.7.0')).toBeLessThan(
      writer.indexOf('VERCEL_TOKEN:'));
    expect(writer).toContain("MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED: 'false'");
    expect(writer).toContain('run: node life-tracker/scripts/run-trusted-prebuilt-writer.mjs');
    expect(writer).not.toContain('vercel build');
    expect(writer).not.toContain('npm ci');
  });

  it('privileged upload stage never executes the untrusted candidate application', async () => {
    const body = await readFile(
      resolve(process.cwd(), 'scripts/run-trusted-prebuilt-writer.mjs'), 'utf8');
    expect(body).toContain('loadAcceptedArtifact');
    expect(body).toContain('assembleVerifiedCandidateStatic');
    expect(body).toContain('addUniquePrebuiltDeploymentId');
    // Presentation fields must originate from the authenticated exact-SHA
    // GitHub readback, never candidate-controlled env variables or source.
    expect(body).toContain('verifiedPrebuiltGitMetadata(commit, plan)');
    expect(body).toContain('prebuiltCliArguments(plan, gitMetadata)');
    expect(body).toContain('Object.entries(gitMetadata)');

    expect(body).toContain('await accepted(event)');
    expect(body).toContain('assessKnownPrebuiltDeployments');
    expect(body).toContain('prebuiltCliArguments');
    expect(body).not.toMatch(/execFileSync\(\s*['"](?:npm|node|git|bash|sh)['"]/);
    expect(body).not.toContain('vercel build');
    expect(body).not.toContain('--prod');
    expect(body).not.toContain("method: 'POST'");
    expect(body).not.toContain('alias set');
  });
});
