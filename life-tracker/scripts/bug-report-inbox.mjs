#!/usr/bin/env node
// Private operator-only read tool, with explicit project confirmation.
import {
  assertConfirmedProject, createAppwriteAdminRequest,
  flagValue, parseBackendTarget,
} from './lib/appwrite-backend.mjs';

export async function readBugReportInbox({
  argv = process.argv.slice(2), env = process.env,
  fetchImpl = globalThis.fetch, log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertConfirmedProject(argv, target.projectId);
  const request = createAppwriteAdminRequest({ ...target, fetchImpl });
  const id = flagValue(argv, '--report-id');
  if (id && !/^bug_[a-f0-9]{32}$/.test(id)) throw new Error('Invalid report reference');
  const path = '/tablesdb/life_tracker/tables/bug_reports/rows';
  const payload = id ? await request('GET', path + '/' + id) : await request('GET', path);
  const reports = id ? [payload] : (payload.rows || []);
  for (const item of [...reports].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)))) {
    // Output is private personal content; never send it to CI logs or public issues.
    log(JSON.stringify({
      reportId: item.$id, title: item.title, description: item.description,
      steps: item.steps, diagnostics: item.diagnostics, createdAt: item.created_at,
      expiresAt: item.expires_at,
    }, null, 2));
  }
  return reports.length;
}
const isDirectRun = process.argv[1] &&
  import.meta.url === new URL('file://' + process.argv[1]).href;
if (isDirectRun) {
  readBugReportInbox().catch(() => {
    console.error('Could not retrieve private bug reports. Check target and operator credentials.');
    process.exitCode = 1;
  });
}
