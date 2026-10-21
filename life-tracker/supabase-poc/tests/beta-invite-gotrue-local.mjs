/**
 * #1027 isolated Supabase CLI only: actual GoTrue Before User Created hook.
 * Never uses a hosted project, real email destination, SMTP, or user data.
 * The workflow provisions synthetic allowlist entries only in local Postgres.
 */
import { randomBytes } from 'node:crypto';

const origin = process.env.MOSAIC_SB_LOCAL_URL;
const publishableKey = process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
const adminKey = process.env.MOSAIC_SB_LOCAL_ADMIN_KEY;
if (origin !== 'http://127.0.0.1:54321' || !publishableKey ||
    !(adminKey?.startsWith('sb_secret_') || adminKey?.length > 80))
  throw Error('Actual invite hook test requires only disposable local Supabase credentials');

async function api(path, key, payload) {
  const response = await fetch(origin + path, {
    method: 'POST', redirect: 'error', cache: 'no-store',
    headers: { apikey: key, Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body;
  try { body = await response.json(); }
  catch { throw Error('Local Auth endpoint did not return JSON'); }
  return { status: response.status, body };
}
const secret = () => 'Aa!9' + randomBytes(24).toString('hex');
const signup = async email => api('/auth/v1/signup', publishableKey,
  { email, password: secret() });
function check(condition, message) { if (!condition) throw Error(message); }

const invited = await signup('mosaic-invite-allowed@example.org');
check(invited.status >= 200 && invited.status < 300 &&
  /^[a-f0-9-]{36}$/i.test(invited.body?.user?.id ?? ''),
  'Server rejected intentionally invited signup');

for (const email of ['mosaic-invite-outsider@example.org',
  'mosaic-invite-revoked@example.org', 'mosaic-invite-expired@example.org']) {
  const denied = await signup(email);
  check(denied.status === 403 && !denied.body?.user?.id,
    'GoTrue admitted a non-invited account');
}

const adminFixture = await api('/auth/v1/admin/users', adminKey,
  { email: 'mosaic-invite-admin@example.org', password: secret(),
    email_confirm: true, app_metadata: { mosaic_disposable_run: 'invite-gotrue-local' } });
check(adminFixture.status >= 200 && adminFixture.status < 300 &&
  /^[a-f0-9-]{36}$/i.test(adminFixture.body?.id ?? ''),
  'GoTrue administrator cannot provision an explicitly invited disposable fixture');

process.stdout.write(JSON.stringify({
  stage: 'actual-local-gotrue-invite-hook', allowed: 1, denied: 3,
  adminInvitedFixture: 1, localOnly: true,
}) + '\n');
