/** Isolated generated-link acceptance; no email is sent and no real account is used. */
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connect, ORIGIN } from './hosted-core.mjs';
import { exerciseHostedUi } from './hosted-core-ui.mjs';
import { inspectEmailPolicy, EMAIL_PREVIEW, EMAIL_PREVIEW_SHA, requireDeployedPreviewAccess } from './email-policy.mjs';

const check = (condition, message) => { if (!condition) throw Error(message); };
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function runHostedEmailProbe(client, { exercise = exerciseHostedUi, preview = null,
  onProgress = () => {} } = {}) {
  const runId = randomBytes(12).toString('hex');
  const fixtures = [];
  const ok = client.requireOk;
  onProgress({ stage: 'email-fixtures', runId });
  let failure;
  try {
    for (const label of ['a', 'b']) {
      const fixture = { email: `mosaic-hosted-${runId}-email-${label}@example.org`,
        password: 'Aa!9' + randomBytes(24).toString('hex') };
      const response = await ok(await client.dataApi('/auth/v1/admin/users', {
        admin: true, body: { ...fixture, email_confirm: label === 'a',
          app_metadata: { mosaic_disposable_run: runId } },
      }), 'Email fixture provisioning');
      check(UUID.test(response.id ?? '') && response.email === fixture.email, 'Email fixture identity mismatch');
      fixture.id = response.id;
      fixtures.push(fixture);
    }
    const target = fixtures[1];
    const before = await ok(await client.dataApi('/auth/v1/admin/users/' + target.id, { admin: true }), 'Unconfirmed fixture check');
    check(!before.email_confirmed_at, 'Confirmation acceptance requires an unconfirmed account');
    const signup = await client.fixtureEmailLink({ id: target.id, runId, type: 'signup', password: target.password });
    await exercise(client, fixtures, ORIGIN, preview, 'signed email confirmation', { kind: 'signup', ...signup });
    const confirmed = await ok(await client.dataApi('/auth/v1/admin/users/' + target.id, { admin: true }), 'Email confirmation readback');
    check(Boolean(confirmed.email_confirmed_at), 'Server did not confirm the fixture email');
    onProgress({ stage: 'email-confirmation-passed', runId });
    const recovery = await client.fixtureEmailLink({ id: target.id, runId, type: 'recovery' });
    const newPassword = 'Aa!9' + randomBytes(24).toString('hex');
    await exercise(client, fixtures, ORIGIN, preview, 'signed email recovery', { kind: 'recovery', ...recovery, newPassword });
    onProgress({ stage: 'email-recovery-passed', runId });
  } catch (error) { failure = error; }
  finally {
    const errors = [];
    // Reconcile uncertain create responses using the unguessable run marker.
    const marked = await client.sql(`select id,email from auth.users where raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)}`);
    for (const user of marked) {
      if (!UUID.test(user.id ?? '') || !['a', 'b'].some(label => user.email === `mosaic-hosted-${runId}-email-${label}@example.org`)) {
        errors.push('Unexpected email fixture identity'); continue;
      }
      try {
        await client.sql(`begin;
          do $guard$ begin
            if not exists(select 1 from auth.users where id=${quote(user.id)}::uuid
              and raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)})
              then raise exception 'fixture marker mismatch'; end if;
          end $guard$;
          update mosaic_candidate_private.core_authorities set backend='frozen',epoch=epoch+1
            where owner_id=${quote(user.id)}::uuid;
          commit;`, false);
        await ok(await client.dataApi('/auth/v1/admin/users/' + user.id, {
          admin: true, method: 'PUT', body: { ban_duration: '876000h' },
        }), 'Email fixture retirement');
      } catch { errors.push('Email fixture retirement incomplete'); }
    }
    const readback = await client.sql(`select count(*) as users,
      coalesce(bool_and(u.banned_until>now() and (a.owner_id is null or a.backend='frozen')),true) as retired,
      (select count(*) from public.mosaic_candidate_tasks t join auth.users u on u.id=t.owner_id
        where u.raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)} and not t.is_deleted) as live_tasks,
      (select count(*) from public.mosaic_candidate_categories c join auth.users u on u.id=c.owner_id
        where u.raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)} and not c.is_deleted) as live_categories
      from auth.users u left join mosaic_candidate_private.core_authorities a on a.owner_id=u.id
      where u.raw_app_meta_data->>'mosaic_disposable_run'=${quote(runId)}`);
    check(!errors.length && Number(readback[0]?.users) === marked.length && readback[0]?.retired === true &&
      Number(readback[0]?.live_tasks) === 0 && Number(readback[0]?.live_categories) === 0,
    'Email fixture retirement readback failed; inspect run ' + runId);
    onProgress({ stage: 'email-retirement-verified', runId, retiredUsers: marked.length, liveTasks: 0, liveCategories: 0 });
  }
  if (failure) throw failure;
  return { runId, confirmation: true, recovery: true, retiredUsers: fixtures.length,
    emailDelivery: 'not-tested-generated-codes' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[2] ?? '--inspect-policy';
    check(process.argv.length <= 3 && ['--ui', '--ui-preview', '--inspect-policy', '--configure-preview-email'].includes(mode),
      'Usage: hosted-email.mjs [--ui|--ui-preview|--inspect-policy|--configure-preview-email]');
    const preview = mode === '--ui-preview' ? { origin: EMAIL_PREVIEW, sha: EMAIL_PREVIEW_SHA } : null;
    if (preview) requireDeployedPreviewAccess(preview, process.env.MOSAIC_CORE_PREVIEW_SHARE_URL);
    const client = await connect({ token: process.env.SUPABASE_ACCESS_TOKEN });
    const result = mode === '--configure-preview-email' ? await client.configurePreviewEmailPolicy() :
      mode === '--inspect-policy' ? inspectEmailPolicy(await client.requireOk(await client.management('/config/auth'), 'Auth email policy inspection')) :
        await runHostedEmailProbe(client, {
          preview, onProgress: progress => process.stdout.write(JSON.stringify(progress) + '\n'),
        });
    process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
  } catch (error) {
    process.stderr.write('Hosted email verification failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
