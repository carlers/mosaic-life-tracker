import { describe, expect, it } from 'vitest';
import { assertPreviewDeployGate, assessPreviewDeployGate, isStablePreviewBranch } from '../../scripts/lib/preview-deploy-gate.mjs';

const sha = 'b70de6daf1c824edb9297fc5af4d13117dc38dde';
const branch = 'fix/workflow-build-parity-592-20261012';
const suite = 103696025983;
const accepted = {
  repository: 'carlers/mosaic-life-tracker',
  branch,
  sha,
  headSha: sha,
  workflowRuns: [{
    id: 38272929905, check_suite_id: suite,
    name: 'Quality Gate', path: '.github/workflows/quality-gate.yml',
    event: 'push', head_sha: sha, head_branch: branch,
    status: 'completed', conclusion: 'success',
  }],
  checkRuns: [{
    name: 'canonical-acceptance', check_suite: { id: suite },
    status: 'completed', conclusion: 'success', head_sha: sha,
    app: { slug: 'github-actions' },
  }],
};

describe('Preview deploy eligibility (#592)', () => {
  it('accepts the actual verified stable SHA only when the entire canonical check suite passed', () => {
    expect(assertPreviewDeployGate(accepted)).toEqual({ eligible: true, reasons: [], acceptedRunId: 38272929905 });
  });

  it('does not permit production/dev, AI branches, or malformed branch refs', () => {
    for (const candidate of ['main', 'dev', 'chatgpt/task', 'codex/task', 'feature//wrong', 'fix/../invalid', 'fix/', 'fix/demo/']) {
      expect(isStablePreviewBranch(candidate)).toBe(false);
      expect(assessPreviewDeployGate({ ...accepted, branch: candidate }).eligible).toBe(false);
    }
    expect(isStablePreviewBranch('feature/diary-408')).toBe(true);
  });

  it('rejects an obsolete SHA or an invalid source repository', () => {
    expect(assessPreviewDeployGate({ ...accepted, headSha: 'a'.repeat(40) }).reasons)
      .toContain('branch head advanced or could not be verified');
    expect(assessPreviewDeployGate({ ...accepted, repository: 'attacker/mosaic-life-tracker' }).eligible).toBe(false);
    expect(assessPreviewDeployGate({ ...accepted, sha: 'b70de6d' }).eligible).toBe(false);
  });

  it('requires the latest matching run to be successful, not merely an older green run', () => {
    const newer = { ...accepted.workflowRuns[0], id: 38273000000, check_suite_id: suite + 1, conclusion: 'failure' };
    const result = assessPreviewDeployGate({ ...accepted, workflowRuns: [accepted.workflowRuns[0], newer] });
    expect(result.eligible).toBe(false);
    expect(result.acceptedRunId).toBe(newer.id);
  });

  it('rejects a successful build sub-job that lacks a matching successful canonical-acceptance', () => {
    const bad = { ...accepted.checkRuns[0], name: 'build' };
    expect(assessPreviewDeployGate({ ...accepted, checkRuns: [bad] }).reasons)
      .toContain('missing passing canonical-acceptance in the same check suite');
    const wrongSuite = { ...accepted.checkRuns[0], check_suite: { id: suite + 1 } };
    expect(assessPreviewDeployGate({ ...accepted, checkRuns: [wrongSuite] }).eligible).toBe(false);
    expect(assessPreviewDeployGate({ ...accepted, checkRuns: [{ ...accepted.checkRuns[0], app: { slug: 'untrusted-app' } }] }).eligible).toBe(false);
  });

  it('rejects in-progress, canceled, PR-targeted, and missing CI evidence', () => {
    for (const run of [
      { ...accepted.workflowRuns[0], status: 'in_progress', conclusion: null },
      { ...accepted.workflowRuns[0], conclusion: 'cancelled' },
      { ...accepted.workflowRuns[0], event: 'pull_request' },
    ]) {
      expect(assessPreviewDeployGate({ ...accepted, workflowRuns: [run] }).eligible).toBe(false);
    }
    expect(assessPreviewDeployGate({ ...accepted, checkRuns: null }).eligible).toBe(false);
  });

  it('does not accept a spoofed canonical check from a different SHA or workflow', () => {
    expect(assessPreviewDeployGate({ ...accepted, checkRuns: [{ ...accepted.checkRuns[0], head_sha: 'a'.repeat(40) }] }).eligible).toBe(false);
    expect(assessPreviewDeployGate({ ...accepted, workflowRuns: [{ ...accepted.workflowRuns[0], path: '.github/workflows/unrelated.yml' }] }).eligible).toBe(false);
  });
});
