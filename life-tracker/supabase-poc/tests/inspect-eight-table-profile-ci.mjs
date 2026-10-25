// Actual pg_restore TOC readback in disposable eight-table signed DR lab.
import { assertProfileToc, SEVEN, EIGHT_SETTINGS } from '../recovery-profile.mjs';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const raw = Buffer.concat(chunks).toString('utf8');
const start = raw.indexOf('{');
const end = raw.lastIndexOf('}');
if (start < 0 || end < start || raw.length > 16 * 1024) {
  throw new Error('Invalid authenticated disposable archive report');
}
const toc = JSON.parse(raw.slice(start, end + 1));
assertProfileToc(toc, EIGHT_SETTINGS);
let refusedOlder = false;
try {
  assertProfileToc(toc, SEVEN);
} catch {
  refusedOlder = true;
}
if (!refusedOlder) throw new Error('Settings-bearing real archive accepted under obsolete 7-table recovery profile');
console.log('MOSAIC_SETTINGS_EIGHT_TABLE_R2_PROFILE_MATCH_PASS');
