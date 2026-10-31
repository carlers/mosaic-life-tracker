import * as chrono from 'chrono-node';

export type ParsedTaskCommand = {
  status: 'create_task' | 'needs_review' | 'unsupported';
  title: string | null;
  category: string | null;
  date: string | null;
};

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const when = '(?:today|tomorrow|bukas|ngayon|in backlog|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|on \\d{4}-\\d{2}-\\d{2})';
const extraWhen = '(?:on (?:january|february|march|april|may|june|july|august|september|october|november|december) \\d{1,2}(?:,? \\d{4})?|in (?:\\d{1,2}|one|two|three|four|five|six|seven) (?:days?|weeks?))';
const anchorWhen = new RegExp('\\s+(?<when>(?:for\\s+)?' + when + ')$', 'i');
const anchorChrono = new RegExp('\\s+(?<when>(?:for\\s+)?' + extraWhen + ')$', 'i');
const starts = [
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
function draft(status: ParsedTaskCommand['status'] = 'needs_review',
  title: string | null = null, category: string | null = null,
  date: string | null = null): ParsedTaskCommand {
  return { status, title, category, date };
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12);
  d.setDate(d.getDate() + days);
  return d;
}
function dateString(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')].join('-');
}
export function isValidCommandDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7)), day = Number(value.slice(8));
  const parsed = new Date(y, m - 1, day, 12);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === day;
}
function parseDate(expression: string, now: Date): string | null {
  const word = expression.replace(/^for\s+/i, '').toLowerCase();
  if (word === 'today' || word === 'ngayon') return dateString(now);
  if (word === 'tomorrow' || word === 'bukas') return dateString(addDays(now, 1));
  if (word === 'in backlog') return '';
  if (word.startsWith('on 20')) {
    const value = word.slice(3);
    return isValidCommandDate(value) ? value : null;
  }
  if (word.startsWith('next ') && weekdays.includes(word.slice(5))) {
    const delta = (weekdays.indexOf(word.slice(5)) - now.getDay() + 7) % 7;
    return dateString(addDays(now, delta || 7));
  }
  if (!new RegExp('^' + extraWhen + '$', 'i').test(word)) return null;
  const phrase = word.replace(/^on\s+/i, '');
  const parsed = chrono.parse(phrase, now, { forwardDate: true });
  if (parsed.length !== 1 || parsed[0].index !== 0 ||
    parsed[0].text.trim().toLowerCase() !== phrase ||
    parsed[0].end) return null;
  const date = parsed[0].start.date();
  if (!Number.isFinite(date.getTime()) || date < addDays(now, 0) ||
    date > addDays(now, 366)) return null;
  return dateString(date);
}
function categoryFromPrefix(prefix: string, categories: readonly string[]) {
  if (!categories.length || categories.some(c => typeof c !== 'string' ||
    !c.trim() || c.length > 255)) return null;
  const matches: Array<{ title: string; category: string }> = [];
  for (const category of categories) {
    const escaped = category.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
    const pattern = new RegExp('^(?<title>.+)\\s+(?:to|in|for|under|sa)\\s+(?:my\\s+)?' +
      escaped + '(?:\\s+list)?$', 'i');
    const match = prefix.trim().match(pattern);
    if (!match?.groups) continue;
    const title = match.groups.title.trim();
    if (/^(?:move|delete|remove|complete|archive|reschedule|mark)\s+to\b/i.test(title)) continue;
    if (/^(?:text|audio|speech|image|video)\s+to\s+(?:text|audio|speech|image|video)$/i.test(title)) continue;
    if (/^(?:(?:\d+|one|two|three|four|five|six|seven|ten|all|every|many|several|multiple|some|few|a dozen)\s+(?:[\w-]+\s+){0,3}(?:tasks?|items?|errands?|assignments?|reminders?|todos?|chores?|entries?)\b)/i.test(title)) continue;
    if (/^(?:move|delete|remove|complete|archive|reschedule|mark)\s+(?:all|every|some|my|\d+)\b/i.test(title)) continue;
    if (/\b(?:and\s+(?:delete|remove|complete|move|reschedule|buy|send|call|finish|pay|clean|submit|study|vacuum)|;\s*\S)/i.test(title)) continue;
    if (title.length > 0 && title.length <= 255) matches.push({ title, category });
  }
  return matches.length === 1 ? matches[0] : null;
}

/** Draft only. No direct access to account state, task IDs, or database writes. */
export function parseTaskCommand(text: string, categoryNames: readonly string[],
  now = new Date()): ParsedTaskCommand {
  if (typeof text !== 'string' || text.length > 1024 || !Number.isFinite(now.getTime())) return draft();
  const original = text.trim().replace(/[.!?]+$/, '').trim();
  if (/^(?:add|create|put)\s+(?:income|expense|transaction|budget)\b/i.test(original)) return draft('unsupported');
  if (/^(?:move|delete|remove|complete|mark|reschedule|archive|show|find|open|search|what|how)\b/i.test(original)) return draft('unsupported');
  const start = starts.find(re => re.test(original));
  if (!start) return draft(/\b(?:add|create|need to|gotta|task)\b/i.test(original) ? 'needs_review' : 'unsupported');
  const body = original.replace(start, '').trim();
  const dateMatch = body.match(anchorWhen) ?? body.match(anchorChrono);
  if (!dateMatch?.groups?.when || dateMatch.index === undefined) return draft();
  const date = parseDate(dateMatch.groups.when, now);
  if (date === null) return draft();
  const category = categoryFromPrefix(body.slice(0, dateMatch.index), categoryNames);
  if (!category) return draft();
  return draft('create_task', category.title, category.category, date);
}
