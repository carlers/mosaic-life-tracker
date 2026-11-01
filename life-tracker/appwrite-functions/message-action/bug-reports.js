const crypto = require('crypto');
const { Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TABLE_ID = 'bug_reports';
const RETENTION_DAYS = 30;
const MAX_REPORTS_PER_HOUR = 5;
const DIAGNOSTICS = {
  version: 30, build: 40, browser: 30, os: 30,
  device: 16, pwa: 16, screen: 30,
};
function reportId(userId, requestId) {
  return 'bug_' + crypto.createHash('sha256')
    .update(userId + ':' + requestId).digest('hex').slice(0, 32);
}
function cleanText(raw, max, required) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if ((required && !value) || value.length > max) return null;
  return value;
}
function normalizeReport(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (typeof payload.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(payload.requestId)) return null;
  const title = cleanText(payload.title, 160, true);
  const description = cleanText(payload.description, 3000, true);
  const steps = cleanText(payload.steps === undefined ? '' : payload.steps, 2000, false);
  if (title === null || description === null || steps === null) return null;
  if (Object.keys(payload).some(key =>
    !['action', 'requestId', 'title', 'description', 'steps', 'diagnostics', 'publicConsent'].includes(key))) return null;
  let diagnostics = '';
  if (payload.diagnostics !== undefined) {
    const info = payload.diagnostics;
    if (!info || Array.isArray(info) || typeof info !== 'object' ||
        Object.keys(info).some(key => !(key in DIAGNOSTICS))) return null;
    const safe = {};
    for (const [key, max] of Object.entries(DIAGNOSTICS)) {
      if (!(key in info)) continue;
      if (typeof info[key] !== 'string' || info[key].length > max ||
          !/^[a-zA-Z0-9. _-]*$/.test(info[key])) return null;
      safe[key] = info[key];
    }
    diagnostics = JSON.stringify(safe);
    if (diagnostics.length > 512) return null;
  }
  return { title, description, steps, diagnostics };
}
function hashReport(report) {
  return crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
}
async function readOptional(db, id) {
  try {
    return await db.getRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: id });
  } catch (cause) {
    if (Number(cause?.code) === 404) return null;
    throw cause;
  }
}
async function handleSubmitBugReport(db, callerId, payload, now = new Date()) {
  const report = normalizeReport(payload);
  if (!report) return { status: 400, body: { error: 'Invalid bug report' } };
  const id = reportId(callerId, payload.requestId);
  const digest = hashReport(report);
  const previous = await readOptional(db, id);
  if (previous) {
    return previous.user_id === callerId && previous.body_hash === digest
      ? { status: 200, body: { reportId: id, duplicate: true } }
      : { status: 409, body: { error: 'Report reference conflicts' } };
  }
  // Server-enforced sliding window; deterministic IDs also dedupe concurrent retries.
  const recent = await db.listRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.equal('user_id', callerId), Query.orderDesc('created_at'), Query.limit(6)],
    total: false,
  });
  const cutoff = now.getTime() - 60 * 60 * 1000;
  if ((recent.rows || []).filter(row => Date.parse(row.created_at) >= cutoff).length >= MAX_REPORTS_PER_HOUR) {
    return { status: 429, body: { error: 'Report limit reached. Try again later.' } };
  }
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 86400000).toISOString();
  try {
    await db.createRow({
      databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: id,
      data: { user_id: callerId, ...report, body_hash: digest,
        created_at: createdAt, expires_at: expiresAt },
      permissions: [],
    });
  } catch (cause) {
    if (Number(cause?.code) !== 409) throw cause;
    const raced = await readOptional(db, id);
    if (!raced) throw cause;
    return raced.user_id === callerId && raced.body_hash === digest
      ? { status: 200, body: { reportId: id, duplicate: true } }
      : { status: 409, body: { error: 'Report reference conflicts' } };
  }
  return { status: 201, body: { reportId: id, duplicate: false } };
}
async function pruneExpiredBugReports(db, now = new Date()) {
  let deleted = 0;
  const result = await db.listRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.lessThan('expires_at', now.toISOString()), Query.orderAsc('expires_at'), Query.limit(100)],
    total: false,
  });
  for (const row of result.rows || []) {
    try {
      await db.deleteRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: row.$id });
      deleted++;
    } catch (cause) {
      if (Number(cause?.code) !== 404) throw cause;
    }
  }
  return deleted;
}

// Publishing is deliberately opt-in, scoped to a single repository and disabled
// unless the operator explicitly enables it. No Appwrite identity or private
// diagnostics are ever placed in a GitHub issue.
const GITHUB_REPO = 'carlers/mosaic-life-tracker';
const ISSUE_BASE = 'https://github.com/' + GITHUB_REPO + '/issues/';
const PUBLISH_LEASE_MS = 120_000;
function publicIssueBody(report, id) {
  const quoted = value => value.split('\n').map(line => '> ' + line.replace(/@/g, '@\u200b')).join('\n');
  return [
    'Submitted through Mosaic’s **public**, opt-in bug-report form.',
    '### Description', quoted(report.description),
    ...(report.steps ? ['### Steps to reproduce', quoted(report.steps)] : []),
    '---',
    'No account identifier or private device diagnostics are included.',
    '<!-- mosaic-public-bug:' + id + ' -->',
  ].join('\n\n');
}
function validIssueUrl(url) {
  return typeof url === 'string' && /^https:\/\/github\.com\/carlers\/mosaic-life-tracker\/issues\/[1-9]\d*$/.test(url);
}
function issueUrlFromNumber(num) {
  if (!Number.isSafeInteger(num) || num < 1) return null;
  return ISSUE_BASE + num;
}
async function githubApi(path, token, method = 'GET', data, fetchImpl = globalThis.fetch) {
  const url = 'https://api.github.com' + path;
  const response = await fetchImpl(url, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'x-github-api-version': '2022-11-28',
      ...(data ? { 'content-type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error('GitHub publishing unavailable');
  return response.json();
}
async function findExistingGitHubIssue(id, token, fetchImpl) {
  const marker = '<!-- mosaic-public-bug:' + id + ' -->';
  for (let page = 1; page <= 3; page++) {
    const issues = await githubApi('/repos/' + GITHUB_REPO +
      '/issues?state=all&sort=created&direction=desc&per_page=100&page=' + page,
      token, 'GET', undefined, fetchImpl);
    if (!Array.isArray(issues)) throw new Error('Invalid GitHub issues response');
    for (const issue of issues) {
      if (typeof issue?.body === 'string' && issue.body.includes(marker)) {
        const url = issueUrlFromNumber(issue.number);
        if (url) return { url, number: issue.number };
      }
    }
    if (issues.length < 100) break;
  }
  return null;
}
async function publishPublicGitHubIssue(report, id, token, fetchImpl) {
  const found = await findExistingGitHubIssue(id, token, fetchImpl);
  if (found) return found;
  const result = await githubApi('/repos/' + GITHUB_REPO + '/issues', token, 'POST', {
    title: '[Mosaic Bug] ' + report.title,
    body: publicIssueBody(report, id),
  }, fetchImpl);
  const url = issueUrlFromNumber(result.number);
  if (!url || result.html_url !== url) throw new Error('Invalid GitHub issue receipt');
  return { url, number: result.number };
}
async function handlePublishBugReport(db, callerId, payload, options = {}) {
  if (!callerId) return { status: 401, body: { error: 'Authentication required' } };
  if (!payload || payload.publicConsent !== true) {
    return { status: 400, body: { error: 'Explicit public publication consent required' } };
  }
  const report = normalizeReport(payload);
  if (!report) return { status: 400, body: { error: 'Invalid bug report' } };
  const token = options.token ?? process.env.GITHUB_BUG_REPORT_TOKEN;
  const enabled = options.enabled ?? (process.env.GITHUB_BUG_REPORT_ENABLED === 'true');
  if (!enabled || typeof token !== 'string' || !token.trim()) {
    return { status: 503, body: { error: 'Public GitHub reporting is not configured' } };
  }
  const now = options.now ?? new Date();
  const id = reportId(callerId, payload.requestId);
  const digest = hashReport({ ...report, destination: 'github-public' });
  let previous = await readOptional(db, id);
  let duplicate = !!previous;
  if (previous) {
    if (previous.user_id !== callerId || previous.body_hash !== digest) {
      return { status: 409, body: { error: 'Report reference conflicts' } };
    }
    if (validIssueUrl(previous.github_issue_url)) {
      return { status: 200, body: { reportId: id, issueUrl: previous.github_issue_url, duplicate: true } };
    }
    const lastAttempt = Date.parse(previous.github_publish_started_at || '');
    if (Number.isFinite(lastAttempt) && now.getTime() - lastAttempt < PUBLISH_LEASE_MS) {
      return { status: 503, body: { error: 'GitHub publication is pending. Retry shortly.' } };
    }
  } else {
    const recent = await db.listRows({
      databaseId: DATABASE_ID, tableId: TABLE_ID,
      queries: [Query.equal('user_id', callerId), Query.orderDesc('created_at'), Query.limit(6)],
      total: false,
    });
    if ((recent.rows || []).filter(row =>
      Date.parse(row.created_at) >= now.getTime() - 3_600_000).length >= MAX_REPORTS_PER_HOUR) {
      return { status: 429, body: { error: 'Report limit reached. Try again later.' } };
    }
    try {
      await db.createRow({
        databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: id,
        data: {
          user_id: callerId, ...report, body_hash: digest,
          created_at: now.toISOString(),
          expires_at: new Date(now.getTime() + RETENTION_DAYS * 86_400_000).toISOString(),
          github_issue_url: '', github_issue_number: 0,
          github_publish_started_at: now.toISOString(),
        }, permissions: [],
      });
    } catch (cause) {
      if (Number(cause?.code) !== 409) throw cause;
      previous = await readOptional(db, id);
      if (!previous || previous.user_id !== callerId || previous.body_hash !== digest) {
        return { status: 409, body: { error: 'Report reference conflicts' } };
      }
      if (validIssueUrl(previous.github_issue_url)) {
        return { status: 200, body: { reportId: id, issueUrl: previous.github_issue_url, duplicate: true } };
      }
      return { status: 503, body: { error: 'GitHub publication is pending. Retry shortly.' } };
    }
  }
  // The initial row is an atomic per-report reservation. Reconciliation is
  // read-before-write; timeout and uncertain GitHub results retain the lease.
  try {
    if (duplicate) {
      await db.updateRow({
        databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: id,
        data: { github_publish_started_at: now.toISOString() },
      });
    }
    const published = await publishPublicGitHubIssue(report, id, token, options.fetchImpl);
    await db.updateRow({
      databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: id,
      data: { github_issue_url: published.url, github_issue_number: published.number },
    });
    return { status: duplicate ? 200 : 201,
      body: { reportId: id, issueUrl: published.url, duplicate } };
  } catch {
    return { status: 503, body: { error: 'GitHub publication could not be confirmed. Retry shortly.' } };
  }
}

module.exports = { handleSubmitBugReport, handlePublishBugReport, publicIssueBody, pruneExpiredBugReports, normalizeReport, reportId,
  RETENTION_DAYS, MAX_REPORTS_PER_HOUR };
