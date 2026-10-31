import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, predict } from './parser-lab.mjs';

const rows = readFileSync(new URL('./parser-lab-regression.jsonl', import.meta.url), 'utf8')
  .trim().split(/\r?\n/).map(JSON.parse);

test('independent regression fixture has 88 unique labelled commands', () => {
  assert.equal(rows.length, 88);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  assert.deepEqual(
    Object.fromEntries([...new Set(rows.map(row => row.group))].map(
      group => [group, rows.filter(row => row.group === group).length]
    )),
    { natural_titles: 28, date_variants: 14, needs_review: 26, bulk_unsupported: 20 }
  );
  for (const row of rows) {
    assert.ok(row.input && typeof row.input === 'string', row.id);
    assert.ok(['create_task', 'needs_review', 'unsupported'].includes(row.expected.status), row.id);
    if (row.expected.status === 'create_task') {
      assert.ok(row.expected.title && row.expected.category && row.expected.date !== null, row.id);
    } else {
      assert.equal(row.expected.title, null, row.id);
      assert.equal(row.expected.category, null, row.id);
      assert.equal(row.expected.date, null, row.id);
    }
  }
});

test('preserve safe explicit category matching independent of capitalization', () => {
  assert.deepEqual(predict('add buy milk to PERSONAL today'), {
    status: 'create_task', title: 'buy milk', category: 'Personal', date: '2026-10-31'
  });
  assert.deepEqual(predict('Paki-add buy rice sa errands bukas'), {
    status: 'create_task', title: 'buy rice', category: 'Errands', date: '2026-11-01'
  });
});

test('bulk move/delete commands cannot turn into task creation', () => {
  for (const input of [
    'Move all tasks from School to Backlogs',
    'Move every unfinished School task to backlog',
    'Delete all categories',
    'Complete every task from School'
  ]) {
    assert.notEqual(predict(input).status, 'create_task', input);
  }
});

test('benchmark explicitly reports wrong actionable interpretations without suppressing them', () => {
  const report = compare(rows);
  assert.equal(report.count, 88);
  assert.equal(report.details.length, 88);
  assert.equal(report.unsafe_create_count,
    report.details.filter(item => item.unsafe_create).length);
  assert.equal(report.exact_count, report.details.filter(item => item.exact).length);
  for (const problem of report.details.filter(item => item.unsafe_create)) {
    assert.equal(problem.got.status, 'create_task');
    assert.equal(problem.exact, false);
  }
  // Research-only parser: a zero-unsafe gate is needed before actual task writes.
});

test('regression fixture records preposition-bearing title and batch quantity risks', () => {
  const byInput = new Map(rows.map(row => [row.input.toLowerCase(), row]));
  const title = byInput.get('add go to school to errands for tomorrow');
  assert.deepEqual(title?.expected, {
    status: 'create_task', title: 'go to school', category: 'Errands', date: '2026-11-01'
  });
  const bulk = byInput.get('add 15 tasks to school tomorrow');
  assert.equal(bulk?.expected.status, 'needs_review');
});
