#!/usr/bin/env node
// Issue #1414: GoTrue-generated disposable email -> real signed recovery.
// All credentials and email links remain in this process. Never run on hosted.
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createSupabaseEmailActions, parseEmailAction } from '../../src/lib/supabaseEmailActions.ts';

const base = process.env.MOSAIC_AUTH_LAB_URL;
const key = process.env.MOSAIC_AUTH_LAB_PUBLISHABLE_KEY;
const mailpit = process.env.MOSAIC_AUTH_LAB_MAILPIT_URL;
const callbackUrl = 'http://127.0.0.1:5173/reset-password';
const check = (ok, label) => { if (!ok) throw Error(label); };
check(process.env.GITHUB_ACTIONS === 'true' &&
  process.env.MOSAIC_REAL_AUTH_RECOVERY_LAB === '1' &&
  process.env.MOSAIC_AUTH_LAB_EMAIL_RECOVERY === '1' &&
  base === 'http://127.0.0.1:54321' &&
  mailpit === 'http://127.0.0.1:54324' &&
  /^sb_publishable_\S+$/.test(key || ''),
  'Disposable local Auth/email guard failed');

async function request(path, { method = 'GET', body, bearer } = {}) {
  const response = await fetch(base + path, {
    method, cache: 'no-store', redirect: 'error', credentials: 'omit',
    headers: { apikey: key, Authorization: 'Bearer ' + (bearer || key),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, body: data };
}
const secret = () => 'LocalRecovery!' + randomBytes(20).toString('hex');
async function signIn(email, password) {
  return request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
}
async function emailVerificationLink(email) {
  let message;
  for (let i = 0; i < 40; i++) {
    const response = await fetch(mailpit + '/api/v1/search?query=' +
      encodeURIComponent('to:' + email), { cache: 'no-store' });
    check(response.ok, 'Disposable local inbox inaccessible');
    const list = await response.json();
    const found = (list.messages || []).find(item =>
      (item.To || []).some(to => to.Address?.toLowerCase() === email));
    if (found) {
      check(/^[A-Za-z0-9_-]+$/.test(found.ID), 'Invalid local inbox message ID');
      const detail = await fetch(mailpit + '/api/v1/message/' + found.ID,
        { cache: 'no-store' });
      check(detail.ok, 'Disposable email content unavailable');
      message = await detail.json();
      break;
    }
    await delay(250);
  }
  check(message && Array.isArray(message.To) &&
    message.To.some(to => to.Address?.toLowerCase() === email),
    'Disposable recovery email was not captured');
  const html = String(message.HTML || '') + ' ' + String(message.Text || '');
  const matches = html.match(/https?:\/\/[^\s"'<>]+/g) || [];
  const links = matches.map(value => value.replaceAll('&amp;', '&')
    .replace(/[).,]+$/, ''));
  const target = links.map(value => {
    try { return new URL(value); } catch { return null; }
  }).find(url => url && url.origin === base &&
    url.pathname === '/auth/v1/verify' &&
    url.searchParams.get('type') === 'recovery');
  check(target && target.searchParams.get('token') &&
    target.searchParams.get('redirect_to') === callbackUrl &&
    target.username === '' && target.password === '',
    'Email link did not use the expected verified local redirect');
  return target.toString();
}

async function run() {
  const email = 'mosaic-email-lab-' + randomBytes(9).toString('hex') + '@example.org';
  const initial = secret();
  const replacement = secret();
  const signup = await request('/auth/v1/signup', {
    method: 'POST', body: { email, password: initial },
  });
  check(signup.status >= 200 && signup.status < 300 &&
    typeof signup.body?.user?.id === 'string' &&
    typeof signup.body?.access_token === 'string',
    'Disposable signed signup failed');
  const ownerId = signup.body.user.id;
  const originalToken = signup.body.access_token;
  const recover = await request('/auth/v1/recover?redirect_to=' +
    encodeURIComponent(callbackUrl), {
      method: 'POST', body: { email },
    });
  check(recover.status >= 200 && recover.status < 300,
    'Disposable recovery request denied');
  const verificationLink = await emailVerificationLink(email);
  // GoTrue consumes the one-time email token and redirects the browser.
  // Do not follow the redirect: no server, mail, URL or log may retain it.
  const verified = await fetch(verificationLink, {
    redirect: 'manual', cache: 'no-store', credentials: 'omit',
  });
  check(verified.status >= 300 && verified.status < 400,
    'GoTrue did not issue an email verification redirect');
  const destination = new URL(verified.headers.get('location') || '', base);
  check(destination.origin === new URL(callbackUrl).origin &&
    destination.pathname === '/reset-password' &&
    !destination.searchParams.has('access_token') &&
    !destination.searchParams.has('refresh_token'),
    'GoTrue redirected to an unexpected email-action origin');
  const callback = parseEmailAction(destination.pathname, destination.hash);
  check(callback?.kind === 'recovery' && typeof callback.accessToken === 'string',
    'GoTrue implicit recovery callback did not match app parser');
  const action = createSupabaseEmailActions({
    baseUrl: base, publishableKey: key, callback, fetcher: fetch,
  });
  const principal = await action.verify();
  check(principal.kind === 'recovery' && principal.email === email,
    'Signed recovery identity did not match disposable email');
  const changed = await action.resetPassword(replacement);
  check(typeof changed.revoked === 'boolean',
    'Verified password change did not finish with an explicit revoke state');
  const oldPassword = await signIn(email, initial);
  check(oldPassword.status === 400 || oldPassword.status === 401,
    'Old password unexpectedly works after recovery');
  const newer = await signIn(email, replacement);
  check(newer.status === 200 && newer.body?.user?.id === ownerId &&
    typeof newer.body.access_token === 'string',
    'New password did not restore the same signed GoTrue owner');
  const confirmed = await request('/auth/v1/user', {
    bearer: newer.body.access_token,
  });
  check(confirmed.status === 200 && confirmed.body?.id === ownerId,
    'New password session did not verify the original GoTrue owner');
  // The original verification link must not issue a second recovery grant.
  const replay = await fetch(verificationLink, {
    redirect: 'manual', cache: 'no-store', credentials: 'omit',
  });
  const replayLocation = new URL(replay.headers.get('location') || '/', base);
  check(replay.status >= 400 ||
    parseEmailAction('/reset-password', replayLocation.hash) === null,
    'Consumed recovery token was accepted again');
  // No password endpoint may be reached by a forged or denied bearer.
  const denied = createSupabaseEmailActions({
    baseUrl: base, publishableKey: key,
    callback: { kind: 'recovery', accessToken: 'invalid.jwt.signature' },
    fetcher: fetch,
  });
  let rejected = false;
  try { await denied.verify(); } catch { rejected = true; }
  check(rejected, 'Forged bearer was accepted by signed GoTrue');
  rejected = false;
  try { await denied.resetPassword(secret()); } catch { rejected = true; }
  check(rejected, 'Forged bearer reached password mutation');
  // Original signed account remains a separate session family; no app
  // persistence, RxDB writer or historical Appwrite linking is performed.
  check(originalToken !== newer.body.access_token,
    'Recovery failed to create a distinct signed token');
  process.stdout.write('LOCAL_GOTRUE_GENERATED_EMAIL_RECOVERY_PASS\n');
}
run().catch(() => {
  // Failure text is fixed: never print received emails, URLs, passwords or JWTs.
  process.stderr.write('LOCAL_GOTRUE_GENERATED_EMAIL_RECOVERY_FAIL\n');
  process.exitCode = 1;
});
