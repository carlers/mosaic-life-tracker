import { assessPreviewDeployGate } from './preview-deploy-gate.mjs';
import { validateBuildEvidence } from './preview-evidence-schema.mjs';

export const PREBUILT_CANARY_BRANCH = 'fix/592-trusted-archive-20261014';
export const PREBUILT_PILOT_BRANCH = 'feature/592-prebuilt-pilot-20261014';
// Generic opt-in remains OFF at the default-main workflow boundary unless
// the owner enables the independent rollout variable. Never trust a prefix
// alone: the candidate must also prove byte-identical reviewed Git opt-out.
export function isLegacyPrebuiltPilot(branch) {
  return branch === PREBUILT_CANARY_BRANCH || branch === PREBUILT_PILOT_BRANCH;
}
export function isGenericPrebuiltBranch(branch) {
  return typeof branch === 'string' &&
    /^(feature|fix|perf|security|refactor)\/[a-z0-9][a-z0-9-]{0,72}$/.test(branch) &&
    !isLegacyPrebuiltPilot(branch);
}
export function isApprovedPrebuiltBranch(branch) {
  return isLegacyPrebuiltPilot(branch) || isGenericPrebuiltBranch(branch);
}
export const PREBUILT_ROUTING_SHA256 = '1e32af5372d2467ef19509262719fab9e023df2f2cc99c56987f2f0c8dd3b0c9';
const SHA = /^[a-f0-9]{40}$/i;
const REPO = 'carlers/mosaic-life-tracker';
const WORKFLOW = '.github/workflows/quality-gate.yml';
// Only the actually validated six-member CI producer is eligible for the
// first generic rollout. A candidate-controlled workflow can preserve check
// labels while changing their meaning; changing this pin needs main review.
export const REVIEWED_GENERIC_QUALITY_GATE_BLOB =
  '5f64f715551f0c311a60d823367d849dfb369bba';
// Reviewed #914 additive historical-consumer preflight is the ONLY difference
// from the previously trusted producer. Keep both exact Git blobs recognized.
export const REVIEWED_GENERIC_QUALITY_GATE_BLOB_914 =
  '28781399a01981c3e96aa99f8925320b0f61b8e4';
const REVIEWED_GENERIC_QUALITY_GATE_BLOBS = new Set([
  REVIEWED_GENERIC_QUALITY_GATE_BLOB,
  REVIEWED_GENERIC_QUALITY_GATE_BLOB_914,
]);
export function assertReviewedGenericQualityGate(branch, sourceBlob) {
  if (isLegacyPrebuiltPilot(branch)) return true; // No legacy rollout change.
  if (!isGenericPrebuiltBranch(branch) ||
      !REVIEWED_GENERIC_QUALITY_GATE_BLOBS.has(sourceBlob))
    throw new Error('Unreviewed generic Quality Gate definition');
  return true;
}
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
    run?.conclusion === 'success' && isApprovedPrebuiltBranch(run?.head_branch) &&
    SHA.test(run?.head_sha ?? '') && Number.isSafeInteger(run?.id) && run.id > 0 &&
    Number.isSafeInteger(run?.check_suite_id) && run.check_suite_id > 0 &&
    Number.isSafeInteger(run?.run_attempt) && run.run_attempt >= 1;
  if (!validEvent) reasons.push('untrusted completed stable Quality Gate event');
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
  if (!isApprovedPrebuiltBranch(expected.branch)) reasons.push('unapproved prebuilt branch');
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
