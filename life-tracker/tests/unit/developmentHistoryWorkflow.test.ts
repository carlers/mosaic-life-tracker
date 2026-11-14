import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const trustedPreview = readFileSync(new URL('../../../.github/workflows/trusted-preview-delivery.yml', import.meta.url), 'utf8');
const devDelivery = readFileSync(new URL('../../../.github/workflows/dev-stable-alias-delivery.yml', import.meta.url), 'utf8');
const devHistory = readFileSync(new URL('../../../.github/workflows/publish-development-history.yml', import.meta.url), 'utf8');
const productionPublisher = readFileSync(new URL('../../../.github/workflows/publish-production-release.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../../scripts/publish-development-history.mjs', import.meta.url), 'utf8');

describe('release history publication security boundaries', () => {
  it('is Main-owned and requires the existing exact Preview and Dev deliveries', () => {
    expect(devHistory).toContain('workflows: [Quality Gate, Dev Stable PWA Alias Delivery]');
    expect(devHistory).toContain("github.event.workflow_run.name == 'Quality Gate'");
    expect(devHistory).toContain("github.event.workflow_run.name == 'Dev Stable PWA Alias Delivery'");
    expect(devHistory).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(trustedPreview).not.toContain('scripts/publish-development-history.mjs');
    expect(devHistory).not.toContain('MOSAIC_RELEASE_HISTORY_PUBLISH_ENABLED');
    expect(devHistory).toContain('scripts/publish-development-history.mjs');
    // Production lineage publishing remains independently gated.
    expect(productionPublisher).toContain("vars.MOSAIC_RELEASE_HISTORY_PUBLISH_ENABLED == 'true'");
    expect(productionPublisher).toContain('scripts/publish-development-history.mjs');
  });

  it('reconciles only current Dev from trusted Main after release activation', () => {
    expect(devHistory).toContain('      - main');
    expect(devHistory).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(devHistory).toContain('github.event.workflow_run.head_sha == github.sha');
    expect(script).toContain('acceptedMainQualityGate');

    expect(devHistory).toContain('workflow_dispatch:');
    expect(devHistory).toContain('schedule:');
    expect(devHistory).toContain('name: Reconcile current verified Dev history');
    expect(devHistory).toContain("github.event_name == 'workflow_dispatch'");
    expect(devHistory).toContain("github.event_name == 'schedule'");
    expect(script).toContain("STAGE === 'dev' && SHA === ''");
    expect(script).toContain("process.env.GITHUB_REF === 'refs/heads/main'");
    expect(script).toContain('SHA = latestDev.object.sha;');
    expect(script).toContain('await assertLiveBranch();');
    expect(script).toContain('await assertDeployment();');
    expect(script).toContain('shouldRecordDevHistoryEvent(tag, previousDevTag, current.value.events)');
  });

  it('recovers only active verified Preview refs via trusted Main on schedule', () => {
    const reconciler = readFileSync(new URL('../../scripts/reconcile-preview-history.mjs', import.meta.url), 'utf8');
    expect(devHistory).toContain('reconcile_preview_history:');
    expect(devHistory).toContain('node scripts/reconcile-preview-history.mjs');
    expect(script).toContain('recoveringActivePreview');
    expect(script).toContain("process.env.HISTORY_RECONCILE_PREVIEW === 'true'");
    expect(reconciler).toContain("process.env.GITHUB_REF !== 'refs/heads/main'");
    expect(reconciler).toContain('selectPendingPreviewCandidates(');
    expect(reconciler).toContain('acceptedMainQualityGate');
    expect(reconciler).toContain('spawnSync(');
  });

  it('confines Vercel evidence token to the existing protected delivery environment', () => {
    expect(devDelivery).toContain('environment: mosaic-preview-auto');
    expect(trustedPreview).toContain('environment: mosaic-preview-auto');
    const jobNames = ['record_dev_history:', 'record_preview_history:',
      'reconcile_dev_history:', 'reconcile_preview_history:'];
    for (const name of jobNames) {
      const part = devHistory.split('  ' + name)[1]?.split(/\n  (?=(?:record_|reconcile_)[a-z_]+:)/)[0] ?? '';
      expect(part).toContain('environment: mosaic-preview-auto');
      expect(part).toContain('secrets.MOSAIC_PREVIEW_AUTO_VERCEL_TOKEN');
      expect(part).toContain('ref: ${{ github.sha }}');
    }
    expect(devHistory.match(/environment: mosaic-preview-auto/g)).toHaveLength(4);
  });

  it('checks out trusted Main instead of executing unreviewed Preview candidate scripts', () => {
    expect(devHistory).toContain('ref: ${{ github.sha }}');
    expect(trustedPreview).toContain('persist-credentials: false');
    expect(devHistory).toContain('persist-credentials: false');
    expect(devDelivery).not.toContain('actions/checkout@');
    expect(script).toContain('await assertLiveBranch();');
    expect(script).toContain("latest.conclusion !== 'success'");
    expect(script).toContain("alias.deploymentId");
    expect(script).toContain("ref?.object?.sha !== SHA");
    expect(script).not.toContain('force: true');
    expect(script).not.toContain('execSync(');
  });

  it('only writes the dedicated metadata branch, never app branches or release tags', () => {
    expect(script).toContain("const HISTORY_REF = 'mosaic-release-history'");
    expect(script).toContain("ref: 'refs/heads/' + HISTORY_REF");
    expect(script).not.toContain("'/releases', { method: 'POST'");
    expect(script).not.toContain("'/git/refs/tags/'");
    expect(script).not.toContain("'refs/heads/dev', sha:");
  });
});
