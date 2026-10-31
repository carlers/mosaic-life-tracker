/** Isolated deterministic command interpretation benchmark, issue #1441. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const AS_OF = new Date(2026, 9, 31, 12, 0); // fixed local reference; never parse ISO as UTC
export const CATEGORIES = ['School', 'Personal', 'Work', 'Health', 'Home', 'Errands', 'College', 'Projects'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WHEN = '(?:today|tomorrow|bukas|ngayon|in backlog|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|on \\d{4}-\\d{2}-\\d{2})';
const EXTRA_WHEN = '(?:on (?:january|february|march|april|may|june|july|august|september|october|november|december) \\d{1,2}(?:,? \\d{4})?|in (?:\\d{1,2}|one|two|three|four|five|six|seven) (?:days?|weeks?))';
// Only a date at the end is eligible; "for" inside task titles is preserved.
const ANCHOR_WHEN = new RegExp('\\s+(?<when>(?:for\\s+)?' + WHEN + ')$', 'i');
const ANCHOR_CHRONO = new RegExp('\\s+(?<when>(?:for\\s+)?' + EXTRA_WHEN + ')$', 'i');
const START = [
  /^(?:add|create|put|schedule)\s+/i,
  /^please add\s+/i,
  /^remind me to\s+/i,
  /^i should\s+/i,
  /^need to\s+/i,
  /^i gotta\s+/i,
  /^please put\s+/i,
  /^can you add\s+/i,
  /^i need to\s+/i,
  /^paki-add\s+/i,
  /^pa-add\s+/i,
  /^lagyan mo ng task na\s+/i,
];
function result(status = 'needs_review', title = null, category = null, date = null) {
  return {status, title, category, date};
}
function addDays(ref, days) { const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12); d.setDate(d.getDate() + days); return d; }
function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function strictIso(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0,4)), m = Number(s.slice(5,7)), day = Number(s.slice(8));
  const d = new Date(y, m - 1, day, 12);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day ? s : null;
}
function dateOf(expression, ref, chrono) {
  const w = expression.replace(/^for\s+/i, '').toLowerCase();
  if (['today', 'ngayon'].includes(w)) return fmt(ref);
  if (['tomorrow', 'bukas'].includes(w)) return fmt(addDays(ref, 1));
  if (w === 'in backlog') return '';
  if (w.startsWith('on 20')) return strictIso(w.slice(3));
  if (w.startsWith('next ') && WEEKDAYS.includes(w.slice(5))) {
    const offset = (WEEKDAYS.indexOf(w.slice(5)) - ref.getDay() + 7) % 7;
    return fmt(addDays(ref, offset || 7));
  }
  if (!chrono || !new RegExp('^' + EXTRA_WHEN + '$', 'i').test(w)) return null;
  const phrase = w.replace(/^on\s+/i, '');
  const parsed = chrono.parse(phrase, ref, {forwardDate: true});
  if (parsed.length !== 1 || parsed[0].index !== 0 || parsed[0].text.trim().toLowerCase() !== phrase.toLowerCase() || parsed[0].end) return null;
  const date = parsed[0].start.date();
  const max = addDays(ref, 366);
  if (!Number.isFinite(date.getTime()) || date < addDays(ref, 0) || date > max) return null;
  return fmt(date);
}
function categoryMatch(prefix, categories) {
  if (!Array.isArray(categories) || categories.length === 0 ||
      categories.some(c => typeof c !== 'string' || !c.trim() || c.length > 255)) return null;
  const options = [];
  const trimmed = prefix.trim();
  for (const category of categories) {
    const escaped = category.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
    const suffix = new RegExp('^(?<title>.+)\\s+(?:to|in|for|under|sa)\\s+(?:my\\s+)?' + escaped + '(?:\\s+list)?$', 'i');
    const matched = trimmed.match(suffix);
    if (!matched) continue;
    const title = matched.groups.title.trim();

    // A command to move a named category must not be created as a task.
    if (/^(?:move|delete|remove|complete|archive|reschedule|mark)\s+to\b/i.test(title)) continue;
    // A bare media-to-media conversion phrase without an action is ambiguous.
    if (/^(?:text|audio|speech|image|video)\s+to\s+(?:text|audio|speech|image|video)$/i.test(title)) continue;
    // Quantity or collective instructions must not create one task literally
    // named "15 tasks", "all tasks" or "several items".
    if (/^(?:(?:\d+|one|two|three|four|five|six|seven|ten|all|every|many|several|multiple|some|few|a dozen)\s+(?:[\w-]+\s+){0,3}(?:tasks?|items?|errands?|assignments?|reminders?|todos?|chores?|entries?)\b)/i.test(title)) continue;
    if (/^(?:move|delete|remove|complete|archive|reschedule|mark)\s+(?:all|every|some|my|\d+)\b/i.test(title)) continue;
    if (/\b(?:and\s+(?:delete|remove|complete|move|reschedule|buy|send|call|finish|pay|clean|submit|study|vacuum)|;\s*\S)/i.test(title)) continue;

    // Rightmost complete destination category is matched. Words including
    // "to", "in", and other category names remain part of task titles.
    // Duplicate owned category labels are ambiguous and require review.
    if (title && title.length <= 255) options.push({ title, category });
  }
  return options.length === 1 ? options[0] : null;
}
export function predict(text, {chrono = null, reference = AS_OF, categories = CATEGORIES} = {}) {
  if (typeof text !== 'string' || text.length > 1024) return result();
  const original = text.trim().replace(/[.!?]+$/,'').trim();
  if (/^(?:add|create|put)\s+(?:income|expense|transaction|budget)\b/i.test(original)) return result('unsupported');
  // The single-task parser never accepts edits, bulk actions or read-only queries.
  if (/^(?:move|delete|remove|complete|mark|reschedule|archive|show|find|open|search|what|how)\b/i.test(original)) return result('unsupported');
  const initial = START.find(pattern => pattern.test(original));
  if (!initial) return result(/\b(?:add|create|need to|gotta|task)\b/i.test(original) ? 'needs_review' : 'unsupported');
  const body = original.replace(initial,'').trim();
  let match = body.match(ANCHOR_WHEN);
  if (!match && chrono) match = body.match(ANCHOR_CHRONO);
  if (!match) return result();
  const phrase = match.groups.when;
  const day = dateOf(phrase, reference, chrono);
  if (day === null) return result();
  const prefix = body.slice(0, match.index).trim();
  const category = categoryMatch(prefix, categories);
  if (!category) return result();
  return result('create_task', category.title, category.category, day);
}

export function compare(rows, options={}) {
  const details = [], durations=[];
  for (const row of rows) {
    const start = performance.now();
    const got = predict(row.input, options);
    durations.push(performance.now() - start);
    const wanted = row.expected;
    const exact = got.status === wanted.status && (got.status !== 'create_task' ||
      (got.title?.toLocaleLowerCase() === wanted.title?.toLocaleLowerCase() && got.category === wanted.category && got.date === wanted.date));
    details.push({id:row.id, group:row.group, input:row.input, expected:wanted, got, exact,
      unsafe_create:got.status === 'create_task' && !exact});
  }
  const sorted = durations.toSorted((a,b)=>a-b);
  const p = q => Number(sorted[Math.max(0, Math.ceil(sorted.length*q)-1)].toFixed(4));
  const groups = {};
  for (const row of details) {const s=groups[row.group]??={count:0,exact:0,unsafe:0};s.count++;s.exact+=Number(row.exact);s.unsafe+=Number(row.unsafe_create);}
  return {count:details.length,exact_count:details.filter(d=>d.exact).length,unsafe_create_count:details.filter(d=>d.unsafe_create).length,
    exact_rate:Number((details.filter(d=>d.exact).length/details.length).toFixed(4)),latency_ms:{p50:p(.5),p95:p(.95)},by_group:groups,details};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = name => args.includes(name);
  const option = (name, otherwise) => {const pos=args.indexOf(name);return pos===-1?otherwise:args[pos+1];};
  const enableChrono = flag('--chrono');
  let chrono = null;
  if (enableChrono) {
    // No production dependency. CLI runner explicitly installs Chrono for test only.
    chrono = await import('chrono-node');
  }
  const directory = dirname(fileURLToPath(import.meta.url));
  const input = option('--input', resolve(directory,'cases.jsonl'));
  const rows = readFileSync(input,'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const report = {schema:1,runner:'node-parser-lab',variant:enableChrono?'grammar+chrono':'grammar', reference:'2026-10-31', dataset:input,
    ...compare(rows,{chrono})};
  const out = option('--output',resolve(directory,'results',enableChrono?'chrono-168.json':'grammar-168.json'));
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({variant:report.variant,score:{count:report.count,exact_count:report.exact_count,exact_rate:report.exact_rate,unsafe_create_count:report.unsafe_create_count,latency_ms:report.latency_ms,by_group:report.by_group},output:out},null,2));
}
