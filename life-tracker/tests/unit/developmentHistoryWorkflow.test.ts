import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const trustedPreview = readFileSync(new URL('../../../.github/workflows/trusted-preview-delivery.yml', import.meta.url), 'utf8');
const devDelivery = readFileSync(new URL('../../../.github/workflows/dev-stable-alias-delivery.yml', import.meta.url), 'utf8');
const devHistory = readFileSync(new URL('../../../.github/workflows/publish-development-history.yml', import.meta.url), 'utf8');
const productionPublisher = readFileSync(new URL('../../../.github/workflows/publish-production-release.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../../scripts/publish-development-history.mjs', import.meta.url), 'utf8');

describe('release history publication security boundaries', () => {
  it('is disabled by default and depends on the existing exact Preview and Dev deliveries', () => {
    expect(devHistory).toContain('workflows: [Quality Gate, Dev Stable PWA Alias Delivery]');
    expect(devHistory).toContain("github.event.workflow_run.name == 'Quality Gate'");
    expect(devHistory).toContain("github.event.workflow_run.name == 'Dev Stable PWA Alias Delivery'");
    expect(devHistory).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(trustedPreview).not.toContain('scripts/publish-development-history.mjs');
    for (const workflow of [devHistory, productionPublisher]) {
      expect(workflow).toContain("vars.MOSAIC_RELEASE_HISTORY_PUBLISH_ENABLED == 'true'");
      expect(workflow).toContain('scripts/publish-development-history.mjs');
    }
  });

  it('reconciles only current Dev from trusted Main without bypassing publisher activation', () => {
    expect(devHistory).toContain('workflow_dispatch:');
    expect(devHistory).toContain('schedule:');
    expect(devHistory).toContain('name: Reconcile current verified Dev history');
    expect(devHistory).toContain("(github.event_name == 'workflow_dispatch' || github.event_name == 'schedule')");
    expect(devHistory).toContain("vars.MOSAIC_RELEASE_HISTORY_PUBLISH_ENABLED == 'true'");
    expect(script).toContain("STAGE === 'dev' && SHA === ''");
    expect(script).toContain("process.env.GITHUB_REF === 'refs/heads/main'");
    expect(script).toContain('SHA = latestDev.object.sha;');
    expect(script).toContain('await assertLiveBranch();');
    expect(script).toContain('await assertDeployment();');
    expect(script).toContain('shouldRecordDevHistoryEvent(tag, previousDevTag, current.value.events)');
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
