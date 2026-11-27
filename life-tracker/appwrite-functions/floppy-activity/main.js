'use strict';

// Owner-only Preview pilot for Mosaic's first external provider (#2402).
// No browser-issued Floppy token, no Appwrite schema write, no plain-text cache.
// Do not activate this Function in Production or share it between Mosaic users.
const PREVIEW_PROJECT_ID = '6ae94a2100014d01f5ed';
const ISO_DAY = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function validDay(day) {
  if (typeof day !== 'string' || !ISO_DAY.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1
    && date.getUTCDate() === d;
}

function validOrigin(raw) {
  try {
    const u = new URL(raw);
    const labels = u.hostname.toLowerCase().split('.');
    // Owner-approved cohost exposes ONLY Tailscale Serve HTTPS 8443.
    // Never send the provider bearer token to a generic public hostname.
    const tailnetHost = labels.length === 4
      && labels[2] === 'ts' && labels[3] === 'net'
      && labels.slice(0, 2).every(label =>
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
    if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/'
      || u.search || u.hash || u.port !== '8443' || !tailnetHost)
      return null;
    return u.origin;
  } catch { return null; }
}

function cleanText(v, max = 240) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function cleanRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.media_type !== 'movie' && value.media_type !== 'episode') return null;
  const item = value.item && typeof value.item === 'object' && !Array.isArray(value.item)
    ? value.item : {};
  const show = value.show && typeof value.show === 'object' && !Array.isArray(value.show)
    ? value.show : {};
  // No notes, reviews, metadata URLs, provider image URLs or other private fields.
  return {
    media_type: value.media_type,
    item: {
      source: cleanText(item.source, 60),
      media_id: cleanText(String(item.media_id ?? ''), 120),
      title: cleanText(item.title),
    },
    show: { title: cleanText(show.title) },
    title: cleanText(value.title),
    display_title: cleanText(value.display_title),
    played_at_local: cleanText(value.played_at_local, 80),
    end_date: cleanText(value.end_date, 80),
    instance_id: typeof value.instance_id === 'number' || typeof value.instance_id === 'string'
      ? value.instance_id : null,
    episode_code: cleanText(value.episode_code, 20),
    score: typeof value.score === 'number' ? value.score : null,
    play_count: typeof value.play_count === 'number' ? value.play_count : 1,
    record_type: cleanText(value.record_type, 32),
  };
}

function privateReply(res, status, data) {
  return res.json(data, status, {
    'Cache-Control': 'private, no-store',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
}

async function fetchJson(url, options, fetchImpl) {
  const r = await fetchImpl(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) {
    // Do not expose upstream response body, URL, headers or credentials.
    if (r.status === 401 || r.status === 403) throw new Error('unauthorized_provider');
    if (r.status === 429) throw new Error('rate_limited');
    throw new Error('provider_unavailable');
  }
  const buffer = await r.text();
  if (buffer.length > 240000) throw new Error('provider_payload_too_large');
  try { return JSON.parse(buffer); }
  catch { throw new Error('invalid_provider_json'); }
}

async function run(context, deps = {}) {
  const { req, res } = context;
  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;
  const project = env.APPWRITE_FUNCTION_PROJECT_ID;
  const userId = req.headers?.['x-appwrite-user-id'];
  const jwt = req.headers?.['x-appwrite-user-jwt'];
  const permittedUser = env.FLOPPY_PILOT_USER_ID;
  // Explicitly block execution under Production, Scratch Lab, or any unknown project.
  if (project !== PREVIEW_PROJECT_ID
    || env.MOSAIC_FLOPPY_PREVIEW_ENABLED !== 'true')
    return privateReply(res, 503, { error: 'Floppy pilot unavailable' });
  if (!permittedUser || !jwt || !userId || userId !== permittedUser)
    return privateReply(res, 403, { error: 'Forbidden' });

  const endpoint = env.APPWRITE_FUNCTION_API_ENDPOINT;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://'))
    return privateReply(res, 503, { error: 'Identity service unavailable' });

  // Verify the actual Appwrite JWT, not merely the platform-supplied user-id.
  // A direct HTTP caller cannot forge the verified account identity.
  try {
    const account = await fetchJson(endpoint.replace(/\/$/, '') + '/account', {
      headers: {
        'X-Appwrite-Project': project,
        'X-Appwrite-JWT': jwt,
      },
    }, fetchImpl);
    if (account?.$id !== userId)
      return privateReply(res, 403, { error: 'Forbidden' });
  } catch {
    return privateReply(res, 401, { error: 'Authentication expired' });
  }

  const body = req.bodyJson || {};
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return privateReply(res, 400, { error: 'Invalid request' });
  if (body.action === 'status')
    return privateReply(res, 200, { available: Boolean(validOrigin(env.FLOPPY_ORIGIN)
      && typeof env.FLOPPY_READ_TOKEN === 'string' && env.FLOPPY_READ_TOKEN.length >= 16) });
  if (body.action !== 'history' || !validDay(body.day))
    return privateReply(res, 400, { error: 'Invalid day or action' });

  const origin = validOrigin(env.FLOPPY_ORIGIN);
  const token = env.FLOPPY_READ_TOKEN;
  if (!origin || typeof token !== 'string' || token.length < 16)
    return privateReply(res, 503, { error: 'Floppy connection unavailable' });
  const offset = body.offset === undefined ? 0 : body.offset;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2000)
    return privateReply(res, 400, { error: 'Invalid offset' });
  const query = new URLSearchParams({
    start_date: body.day,
    end_date: body.day,
    types: 'movie,episode',
    flat: '1',
    limit: '100',
    offset: String(offset),
  });
  try {
    const response = await fetchJson(origin + '/api/v1/history/?' + query, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    }, fetchImpl);
    const pagination = response?.pagination;
    if (!Array.isArray(response?.results)
      || !pagination || !Number.isSafeInteger(pagination.total)
      || pagination.total < 0 || pagination.total > 1000000
      || !Number.isSafeInteger(pagination.offset)
      || !Number.isSafeInteger(pagination.limit)
      || pagination.offset !== offset || pagination.limit !== 100
      || response.results.length > 100
      || pagination.offset > pagination.total
      || pagination.offset + response.results.length > pagination.total
      || (response.results.length === 0 && pagination.offset < pagination.total))
      return privateReply(res, 502, { error: 'Floppy API contract changed' });
    return privateReply(res, 200, {
      results: response.results.map(cleanRow).filter(Boolean),
      // The broker removes unsupported/private rows. Preserve the number of
      // upstream rows consumed so the browser never re-requests skipped rows.
      pagination: { total: pagination.total, offset, limit: 100, scanned: response.results.length },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    return privateReply(res, code === 'unauthorized_provider' ? 424 : code === 'rate_limited' ? 429 : 502, {
      error: code === 'unauthorized_provider' ? 'Reconnect Floppy'
        : code === 'rate_limited' ? 'Floppy is rate limiting requests'
        : 'Floppy temporarily unavailable',
    });
  }
}

module.exports = run;
module.exports._test = { cleanRow, validDay, validOrigin };
