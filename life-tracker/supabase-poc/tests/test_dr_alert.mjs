import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventAlert, probeAlert, deliverAlert, main } from '../dr-alert.mjs';

function event(extra = {}) {
  const id = 12345;
  return { action: 'completed', workflow_run: {
    id, name: 'Supabase Scratch Unified Offsite Recovery Watch',
    head_branch: 'main', head_repository: { full_name: 'carlers/mosaic-life-tracker' },
    repository: { full_name: 'carlers/mosaic-life-tracker' },
    conclusion: 'failure',
    html_url: 'https://github.com/carlers/mosaic-life-tracker/actions/runs/' + id,
    ...extra,
  }};
}
const env = {
  SUPABASE_DR_ALERT_BREVO_API_KEY: 'k'.repeat(32),
  SUPABASE_DR_ALERT_SENDER: 'sender@example.invalid',
  SUPABASE_DR_ALERT_RECIPIENT: 'recipient@example.invalid',
};

test('failure, timeout and cancellation of exact main backup/watch trigger', () => {
  for (const name of ['Supabase Scratch Unified Encrypted Offsite Backup',
                       'Supabase Scratch Unified Offsite Recovery Watch']) {
    for (const conclusion of ['failure', 'timed_out', 'cancelled']) {
      const alert = eventAlert(event({ name, conclusion }));
      assert.ok(alert);
      assert.match(alert.body, /actions\/runs\/12345/);
      assert.ok(!alert.body.includes('secret'));
    }
  }
});

test('success, other projects, non-main, fake URL and unknown workflow are ignored', () => {
  const cases = [
    event({ conclusion: 'success' }), event({ head_branch: 'dev' }),
    event({ name: 'Publish Production Release' }),
    event({ html_url: 'https://evil.invalid/' }),
    event({ head_repository: { full_name: 'attacker/other' } }),
    event({ repository: { full_name: 'attacker/other' } }),
    event({ id: '12345' }), { ...event(), action: 'requested' },
  ];
  for (const item of cases) assert.equal(eventAlert(item), null);
});

test('explicit probe only; cannot fake failure without confirmation', () => {
  assert.equal(probeAlert('anything else'), null);
  const result = probeAlert('TEST_SCRATCH_DR_ALERT');
  assert.ok(result && result.subject.includes('TEST ONLY'));
  assert.ok(result.body.includes('No database backup'));
});

test('transport sends minimal Brevo transactional plain text without source data', async () => {
  let payload, options;
  await deliverAlert(probeAlert('TEST_SCRATCH_DR_ALERT'), env, async (url, init) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    payload = JSON.parse(init.body); options = init;
    return { status: 201 };
  });
  assert.equal(payload.sender.email, env.SUPABASE_DR_ALERT_SENDER);
  assert.equal(payload.to[0].email, env.SUPABASE_DR_ALERT_RECIPIENT);
  assert.equal(options.headers['api-key'], env.SUPABASE_DR_ALERT_BREVO_API_KEY);
  assert.equal(options.method, 'POST');
  assert.ok(!JSON.stringify(payload).includes('postgres.'));
});

test('no protected Brevo key/recipient/sender -> never send', async () => {
  for (const changed of [
    { SUPABASE_DR_ALERT_BREVO_API_KEY: '' },
    { SUPABASE_DR_ALERT_RECIPIENT: 'not-email' },
    { SUPABASE_DR_ALERT_SENDER: '' },
  ]) {
    await assert.rejects(
      deliverAlert(probeAlert('TEST_SCRATCH_DR_ALERT'), { ...env, ...changed },
        () => { throw Error('SHOULD_NOT_CONNECT'); }),
      /settings missing/,
    );
  }
});

test('transport failure and provider rejection do not masquerade as delivered', async () => {
  await assert.rejects(deliverAlert(probeAlert('TEST_SCRATCH_DR_ALERT'), env,
    async () => { throw Error('private key not reported'); }), /transport failed/);
  await assert.rejects(deliverAlert(probeAlert('TEST_SCRATCH_DR_ALERT'), env,
    async () => ({ status: 401, text: async () => 'sensitive detail' })), /Brevo rejected/);
});

test('malformed CLI mode rejects probe without contacting provider', async () => {
  await assert.rejects(main({ ...env, SUPABASE_DR_ALERT_PROBE_CONFIRMATION: 'BAD' }, ['--probe']),
    /confirmation missing/);
  await assert.rejects(main(env, ['--unsafe']), /Unsupported/);
});

test('event mode without trusted payload refuses; no external request', async () => {
  await assert.rejects(main({}, ['--event']), /payload missing/);
});
