import { describe, expect, it } from 'vitest';
import { assessPrebuiltReceiverEvent, selectPrebuiltArtifact,
  assessPrebuiltManifest, PREBUILT_CANARY_BRANCH, PREBUILT_PILOT_BRANCH,
  isApprovedPrebuiltBranch, isGenericPrebuiltBranch, isLegacyPrebuiltPilot,
  PREBUILT_ROUTING_SHA256
} from '../../scripts/lib/prebuilt-receiver-gate.mjs';
const sha = 'a'.repeat(40), main = 'b'.repeat(40), suite = 1234;
const run = { id: 4567, run_attempt: 2, check_suite_id: suite, name: 'Quality Gate',
  path: '.github/workflows/quality-gate.yml', event: 'push', status: 'completed',
  conclusion: 'success', head_branch: PREBUILT_CANARY_BRANCH, head_sha: sha,
  head_repository: { full_name: 'carlers/mosaic-life-tracker' },
  repository: { full_name: 'carlers/mosaic-life-tracker' } };
const event = { repository: { full_name: 'carlers/mosaic-life-tracker' }, workflow_run: run };
const check = { name: 'canonical-acceptance', status: 'completed', conclusion: 'success',
  head_sha: sha, app: { slug: 'github-actions' }, check_suite: { id: suite } };
const inputs = { event, repository: 'carlers/mosaic-life-tracker',
  eventName: 'workflow_run', ref: 'refs/heads/main', checkoutSha: main, mainHead: main,
  enabled: 'true', workflowRuns: [run], checkRuns: [check], branchHead: sha };
const artifact = { id: 33,
  name: 'mosaic-ci-build-' + sha + '-' + run.id + '-' + run.run_attempt,
  expired: false, size_in_bytes: 813000, workflow_run: { id: run.id },
  digest: 'sha256:' + 'e'.repeat(64) };
const evidence = { schemaVersion: 1, kind: 'non-deployable-ci-build-evidence',
  deploymentAuthorized: false,
  source: { sha, ref: 'refs/heads/' + PREBUILT_CANARY_BRANCH },
  buildProfile: { environment: 'untrusted-ci-diagnostic', nodeMajor: 24,
    giphy: 'enabled', posthog: 'enabled', vercelEnvironment: 'preview',
    appwriteBackend: 'scratch' },
  inventory: { digest: 'f'.repeat(64), count: 161 },
  jsCssFingerprint: 'c'.repeat(64),
  metrics: { initialClosureGzipBytes: 146064, homeClosureGzipBytes: 368752 } };
const expected = { sha, branch: PREBUILT_CANARY_BRANCH,
  routingSha256: PREBUILT_ROUTING_SHA256 };
describe('main-trusted prebuilt receiver read-only acceptance (#592)', () => {
  it('requires exact completed successful canonical check at latest head and main trust', () => {
    expect(assessPrebuiltReceiverEvent(inputs)).toMatchObject({
      eligible: true, sha, runId: run.id, attempt: 2,
    });
    for (const altered of [
      { enabled: 'false' }, { mainHead: 'c'.repeat(40) },
      { branchHead: 'c'.repeat(40) }, { ref: 'refs/heads/dev' },
      { workflowRuns: [{ ...run, conclusion: 'failure' }] },
      { workflowRuns: [{ ...run, id: run.id + 3 }, run] },
      { checkRuns: [] },
      { event: { ...event, workflow_run: { ...run, head_branch: 'feature/other' } } },
      { event: { ...event, workflow_run: { ...run, event: 'pull_request' } } },
      { event: { ...event, workflow_run: { ...run, run_attempt: undefined } } },
      { event: { ...event, workflow_run: { ...run,
        head_repository: { full_name: 'attacker/repo' } } } },
    ]) expect(assessPrebuiltReceiverEvent({ ...inputs, ...altered }).eligible).toBe(false);
  });
  it('retains two live legacy pilots and validates generic branch shapes', () => {
    expect(isApprovedPrebuiltBranch(PREBUILT_CANARY_BRANCH)).toBe(true);
    expect(isApprovedPrebuiltBranch(PREBUILT_PILOT_BRANCH)).toBe(true);
    for (const branch of ['feature/unreviewed', 'fix/other', 'perf/size',
      'security/hardening', 'refactor/cleanup']) {
      expect(isApprovedPrebuiltBranch(branch)).toBe(true);
      expect(isGenericPrebuiltBranch(branch)).toBe(true);
      expect(isLegacyPrebuiltPilot(branch)).toBe(false);
    }
    for (const branch of ['dev', 'main', 'chatgpt/work', 'codex/work',
      'feature/nested/path', 'fix/a|b', 'feature/a)', 'feature/A',
      'feature/', 'fix/' + 'a'.repeat(74)]) {
      expect(isApprovedPrebuiltBranch(branch)).toBe(false);
    }
    const pilot = { ...run, head_branch: PREBUILT_PILOT_BRANCH };
    const admitted = { ...inputs, event: { ...event, workflow_run: pilot },
      workflowRuns: [pilot] };
    expect(assessPrebuiltReceiverEvent(admitted).eligible).toBe(true);
    expect(assessPrebuiltReceiverEvent({ ...admitted,
      branchHead: 'c'.repeat(40) }).eligible).toBe(false);
    expect(assessPrebuiltReceiverEvent({ ...admitted,
      checkRuns: [{ ...check, conclusion: 'failure' }] }).eligible).toBe(false);
    expect(assessPrebuiltReceiverEvent({ ...admitted,
      workflowRuns: [{ ...pilot, id: pilot.id + 1 }, pilot] }).eligible).toBe(false);
    const pilotEvidence = { ...evidence,
      source: { ...evidence.source, ref: 'refs/heads/' + PREBUILT_PILOT_BRANCH } };
    expect(assessPrebuiltManifest(pilotEvidence,
      { ...expected, branch: PREBUILT_PILOT_BRANCH }).eligible).toBe(true);
    const unreviewedEvidence = { ...pilotEvidence, source: {
      ...pilotEvidence.source, ref: 'refs/heads/feature/unreviewed',
    } };
    expect(assessPrebuiltManifest(unreviewedEvidence,
      { ...expected, branch: 'feature/unreviewed' }).eligible).toBe(true);
    const invalidEvidence = { ...unreviewedEvidence, source: {
      ...unreviewedEvidence.source, ref: 'refs/heads/feature/nested/path',
    } };
    expect(assessPrebuiltManifest(invalidEvidence,
      { ...expected, branch: 'feature/nested/path' }).eligible).toBe(false);
  });

  it('requires exact artifact run attempt and rejects expired, duplicate and oversized', () => {
    const request = { sha, runId: run.id, attempt: 2 };
    expect(selectPrebuiltArtifact([artifact], request)).toMatchObject({ id: 33 });
    for (const entries of [
      [], [artifact, artifact], [{ ...artifact, expired: true }],
      [{ ...artifact, name: 'mosaic-ci-build-' + sha + '-' + run.id + '-1' }],
      [{ ...artifact, workflow_run: { id: 999 } }],
      [{ ...artifact, size_in_bytes: 100000000 }],
      [{ ...artifact, digest: 'sha256:INVALID' }],
      [{ ...artifact, digest: undefined }],
    ]) expect(() => selectPrebuiltArtifact(entries, request)).toThrow();
  });
  it('rejects wrong Scratch/GIPHY/PostHog profile, oversize and source forgery', () => {
    expect(assessPrebuiltManifest(evidence, expected)).toEqual({
      eligible: true, reasons: [], deploymentAuthorized: false,
    });
    for (const altered of [
      { giphy: 'disabled' }, { posthog: 'disabled' },
      { vercelEnvironment: 'production' }, { appwriteBackend: 'production' },
      { nodeMajor: 22 },
    ]) expect(assessPrebuiltManifest({ ...evidence,
      buildProfile: { ...evidence.buildProfile, ...altered } }, expected).eligible).toBe(false);
    expect(assessPrebuiltManifest({ ...evidence, metrics: {
      ...evidence.metrics, initialClosureGzipBytes: 154501 } }, expected).eligible).toBe(false);
    expect(assessPrebuiltManifest(evidence, { ...expected,
      routingSha256: 'f'.repeat(64) }).eligible).toBe(false);
    expect(() => assessPrebuiltManifest({ ...evidence,
      source: { ...evidence.source, sha: 'b'.repeat(40) } }, expected)).toThrow();
    expect(() => assessPrebuiltManifest({ ...evidence,
      deploymentAuthorized: true }, expected)).toThrow();
  });
});
