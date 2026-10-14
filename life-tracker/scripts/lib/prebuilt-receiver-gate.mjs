import { assessPreviewDeployGate } from './preview-deploy-gate.mjs';
import { validateBuildEvidence } from './preview-evidence-schema.mjs';

export const PREBUILT_CANARY_BRANCH = 'fix/592-trusted-archive-20261014';
export const PREBUILT_ROUTING_SHA256 = 'c1ee8560a43e316a7eb8c0ec163affa4c9941050065fc735c93e678b84b9d848';
const SHA = /^[a-f0-9]{40}$/i;
const REPO = 'carlers/mosaic-life-tracker';
const WORKFLOW = '.github/workflows/quality-gate.yml';
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;

// Pure/read-only: eligibility does NOT create a provider deployment.
// Re-fetch main, branch HEAD and canonical suite immediately before any POST.
export function assessPrebuiltReceiverEvent({
  event, repository, eventName, ref, checkoutSha, mainHead,
  enabled, workflowRuns, checkRuns, branchHead,
}) {
  const reasons = [];
  const run = event?.workflow_run;
  const validEvent = eventName === 'workflow_run' &&
    repository === REPO && event?.repository?.full_name === REPO &&
    run?.head_repository?.full_name === REPO &&
    run?.repository?.full_name === REPO &&
    run?.name === 'Quality Gate' && run?.path === WORKFLOW &&
    run?.event === 'push' && run?.status === 'completed' &&
    run?.conclusion === 'success' && run?.head_branch === PREBUILT_CANARY_BRANCH &&
    SHA.test(run?.head_sha ?? '') && Number.isSafeInteger(run?.id) && run.id > 0 &&
    Number.isSafeInteger(run?.check_suite_id) && run.check_suite_id > 0 &&
    Number.isSafeInteger(run?.run_attempt) && run.run_attempt >= 1;
  if (!validEvent) reasons.push('untrusted completed canary Quality Gate event');
  if (ref !== 'refs/heads/main' || !SHA.test(checkoutSha ?? '') ||
      mainHead !== checkoutSha) reasons.push('trusted default-main checkout missing or stale');
  if (enabled !== 'true') reasons.push('default-main receiver is disabled');
  const gate = assessPreviewDeployGate({
    repository: event?.repository?.full_name, branch: run?.head_branch,
    sha: run?.head_sha, headSha: branchHead, workflowRuns, checkRuns,
  });
  if (!gate.eligible || gate.acceptedRunId !== run?.id)
    reasons.push('latest exact-SHA canonical CI or branch HEAD not accepted');
  return { eligible: reasons.length === 0, reasons, sha: run?.head_sha,
    branch: run?.head_branch, runId: run?.id, attempt: run?.run_attempt };
}

// Only the current accepted run attempt's artifact. Never accept old retry
// data, duplicate same-name uploads or a candidate-supplied approval flag.
export function selectPrebuiltArtifact(artifacts, { sha, runId, attempt }) {
  if (!Array.isArray(artifacts) || !SHA.test(sha ?? '') ||
      !Number.isSafeInteger(runId) || runId < 1 ||
      !Number.isSafeInteger(attempt) || attempt < 1)
    throw new Error('Incomplete trusted run and artifact listing');
  const name = 'mosaic-ci-build-' + sha + '-' + runId + '-' + attempt;
  const matches = artifacts.filter(a => a?.name === name);
  if (matches.length !== 1) throw new Error('Missing or ambiguous accepted CI artifact');
  const artifact = matches[0];
  if (!Number.isSafeInteger(artifact?.id) || artifact.id < 1 ||
      artifact.expired !== false ||
      !Number.isSafeInteger(artifact.size_in_bytes) ||
      artifact.size_in_bytes < 100 || artifact.size_in_bytes > MAX_ARTIFACT_BYTES ||
      artifact.workflow_run?.id !== runId ||
      !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? ''))
    throw new Error('Untrusted or oversized artifact metadata');
  return { id: artifact.id, name, size: artifact.size_in_bytes,
    digest: artifact.digest ?? null };
}

// This is only a preliminary provenance/profile check. Main receiver must
// verify full archive bytes and routes before any provider creation.
export function assessPrebuiltManifest(evidence, expected) {
  validateBuildEvidence(evidence, {
    sha: expected.sha, ref: 'refs/heads/' + expected.branch,
  });
  const p = evidence.buildProfile, m = evidence.metrics;
  const reasons = [];
  if (expected.branch !== PREBUILT_CANARY_BRANCH) reasons.push('unapproved canary branch');
  if (p?.nodeMajor !== 24 || p?.giphy !== 'enabled' ||
      p?.posthog !== 'enabled' || p?.vercelEnvironment !== 'preview' ||
      p?.appwriteBackend !== 'scratch')
    reasons.push('non-parity browser-public Preview profile');
  if (!Number.isSafeInteger(m?.initialClosureGzipBytes) ||
      m.initialClosureGzipBytes > 154500 ||
      !Number.isSafeInteger(m?.homeClosureGzipBytes) ||
      m.homeClosureGzipBytes > 381000)
    reasons.push('blocking startup bundle budget not satisfied');
  if (expected.routingSha256 !== PREBUILT_ROUTING_SHA256)
    reasons.push('unknown routing contract');
  return { eligible: reasons.length === 0, reasons, deploymentAuthorized: false };
}
