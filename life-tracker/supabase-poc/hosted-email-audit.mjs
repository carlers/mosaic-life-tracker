/** #1027: output-only, nonsecret hosted Auth email policy gate. No email is sent. */
import { pathToFileURL } from 'node:url';
import { connect } from './hosted-core.mjs';
import { inspectEmailPolicy } from './email-policy.mjs';

export const EMAIL_POLICY_FLAGS = Object.freeze([
  'confirmationRequired',
  'siteReady',
  'redirectsReady',
  'templatesReady',
  'customSmtpConfigured',
  'brevoRelayConfigured',
  'smtpSenderConfigured',
]);

export function summarizeHostedEmailPolicy(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw Error('Invalid isolated hosted email policy');
  const candidate = inspectEmailPolicy(config);
  const summary = Object.fromEntries(
    EMAIL_POLICY_FLAGS.map(key => [key, candidate[key] === true])
  );
  const rawLimit = candidate.emailRateLimit;
  summary.emailRateLimit = typeof rawLimit === 'number' && Number.isSafeInteger(rawLimit) &&
    rawLimit >= 0 && rawLimit <= 100000 ? rawLimit : null;
  return Object.freeze(summary);
}

export function emailPolicyGate(summary) {
  if (!summary || EMAIL_POLICY_FLAGS.some(key => typeof summary[key] !== 'boolean') ||
    !(summary.emailRateLimit === null ||
      (Number.isSafeInteger(summary.emailRateLimit) &&
        summary.emailRateLimit >= 0 && summary.emailRateLimit <= 100000)))
    throw Error('Unsafe email policy summary');
  // The exact reviewed old immutable Preview is still the policy target, not
  // the unapproved latest Preview artifact. No user-data or credential output.
  const markers = [
    'MOSAIC_HOSTED_EMAIL_POLICY_READ_PASS',
    ...EMAIL_POLICY_FLAGS.map(key =>
      'MOSAIC_HOSTED_EMAIL_' + key.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase() +
      '_' + (summary[key] ? 'PASS' : 'NOT_READY')),
    'MOSAIC_HOSTED_EMAIL_RATE_LIMIT_PER_HOUR_' +
      (summary.emailRateLimit === null ? 'UNKNOWN' : summary.emailRateLimit),
    'MOSAIC_HOSTED_EMAIL_REAL_INBOX_DELIVERY_NOT_TESTED',
  ];
  // For the known, immutable email Preview only; do NOT interpret as approval
  // of a new artifact, Production redirect, or actual SMTP deliverability.
  const ready = EMAIL_POLICY_FLAGS.every(key => summary[key]);
  markers.push(ready ? 'MOSAIC_HOSTED_EMAIL_REVIEWED_PREVIEW_POLICY_READY' :
    'MOSAIC_HOSTED_EMAIL_REVIEWED_PREVIEW_POLICY_NOT_READY');
  return { markers, ready };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--inspect')
      throw Error('Read-only inspect mode only');
    const client = await connect({ token: process.env.SUPABASE_ACCESS_TOKEN });
    const data = await client.requireOk(
      await client.management('/config/auth'), 'Hosted Auth policy read');
    const gate = emailPolicyGate(summarizeHostedEmailPolicy(data));
    gate.markers.forEach(marker => process.stdout.write(marker + '\n'));
    if (!gate.ready) process.exitCode = 2;
  } catch {
    // Provider errors may contain private policy fields; emit only fixed marker.
    process.stderr.write('MOSAIC_HOSTED_EMAIL_POLICY_READ_BLOCKED\n');
    process.exitCode = 1;
  }
}
