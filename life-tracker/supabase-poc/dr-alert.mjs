/** Failure-only Brevo transactional email for exact main Scratch unified backup/watch runs.
 * Never log keys, email addresses, source row data, or arbitrary event strings.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'carlers/mosaic-life-tracker';
const NAMES = new Set([
  'Supabase Scratch Unified Encrypted Offsite Backup',
  'Supabase Scratch Unified Offsite Recovery Watch',
]);
const CONCLUSIONS = new Set(['failure', 'timed_out', 'cancelled']);
const EMAIL = /^[^@\s<>]{1,128}@[^@\s<>]{1,190}$/;
const API = 'https://api.brevo.com/v3/smtp/email';

export function eventAlert(event) {
  const run = event?.workflow_run;
  if (event?.action !== 'completed' || !run ||
      !NAMES.has(run.name) || run.head_branch !== 'main' ||
      run.head_repository?.full_name !== REPO ||
      run.repository?.full_name !== REPO ||
      !CONCLUSIONS.has(run.conclusion) ||
      !Number.isSafeInteger(run.id) || run.id < 1 ||
      !/^https:\/\/github\.com\/carlers\/mosaic-life-tracker\/actions\/runs\/[0-9]+$/.test(run.html_url) ||
      run.html_url !== 'https://github.com/' + REPO + '/actions/runs/' + run.id) {
    return null;
  }
  // Only static allowlisted fields enter provider payload.
  return {
    subject: '[Mosaic Scratch DR] ' +
      (run.name.endsWith('Backup') ? 'Backup' : 'Watch') + ' ' + run.conclusion,
    body: 'Mosaic Scratch-only encrypted R2 disaster recovery requires attention.\n' +
      'Workflow: ' + run.name + '\nConclusion: ' + run.conclusion + '\n' +
      'Inspect protected GitHub Actions run: ' + run.html_url + '\n' +
      'Do not enable pruning, backend cutover or disable existing backups to fix the alert.\n',
  };
}

export function probeAlert(confirmation) {
  if (confirmation !== 'TEST_SCRATCH_DR_ALERT') return null;
  return {
    subject: '[Mosaic Scratch DR] TEST ONLY — alert delivery probe',
    body: 'This is a controlled TEST ONLY of Mosaic Scratch disaster-recovery email alert delivery.\n' +
      'No database backup, deletions, R2 object changes, production change or provider cutover occurred.\n',
  };
}

export async function deliverAlert(message, env, fetchImpl = fetch) {
  if (!message || typeof message.subject !== 'string' || typeof message.body !== 'string')
    throw new Error('DR alert message unavailable');
  const key = env.SUPABASE_DR_ALERT_BREVO_API_KEY;
  const sender = env.SUPABASE_DR_ALERT_SENDER;
  const recipient = env.SUPABASE_DR_ALERT_RECIPIENT;
  // Optional independent reply address; never force a third-party free-mail From.
  const replyTo = env.SUPABASE_DR_ALERT_REPLY_TO;
  if (replyTo != null && replyTo !== '' && !EMAIL.test(replyTo))
    throw new Error('Protected DR alert reply-to setting invalid');
  if (!key || key.length < 20 || /\s/.test(key) ||
      !EMAIL.test(sender || '') || !EMAIL.test(recipient || '')) {
    throw new Error('Protected Brevo alert settings missing');
  }
  const payload = {
    sender: { email: sender, name: 'Mosaic DR' },
    to: [{ email: recipient }],
    ...(replyTo ? { replyTo: { email: replyTo, name: 'Mosaic DR' } } : {}),
    subject: message.subject,
    textContent: message.body,
  };
  let response;
  try {
    response = await fetchImpl(API, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Protected DR alert transport failed');
  }
  // Provider HTTP acceptance is NOT an inbox-delivery receipt.
  if (response.status !== 201 && response.status !== 202)
    throw new Error('Brevo rejected the DR alert request');
  return true;
}

export async function main(env = process.env, argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !['--event', '--probe'].includes(argv[0]))
    throw new Error('Unsupported DR alert mode');
  let alert;
  if (argv[0] === '--probe') {
    alert = probeAlert(env.SUPABASE_DR_ALERT_PROBE_CONFIRMATION);
    if (!alert) throw new Error('Explicit synthetic DR alert confirmation missing');
  } else {
    if (!env.GITHUB_EVENT_PATH) throw new Error('Protected workflow event payload missing');
    const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
    alert = eventAlert(event);
    if (!alert) {
      console.log('MOSAIC_SUPABASE_DR_ALERT_UNRELATED_EVENT_SKIP');
      return;
    }
  }
  await deliverAlert(alert, env);
  console.log(argv[0] === '--probe'
    ? 'MOSAIC_SUPABASE_DR_ALERT_PROBE_ACCEPTED_NOT_DELIVERY_PROOF'
    : 'MOSAIC_SUPABASE_DR_ALERT_PROVIDER_ACCEPTED_NOT_DELIVERY_PROOF');
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) main().catch(() => {
  console.error('MOSAIC_SUPABASE_DR_ALERT_NOT_DELIVERED');
  process.exitCode = 1;
});
