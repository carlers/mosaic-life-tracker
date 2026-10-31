import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as chrono from 'chrono-node';
import { predict, compare } from './parser-lab.mjs';

const fixture = filename => readFileSync(new URL('./' + filename, import.meta.url), 'utf8')
  .trim().split(/\r?\n/).map(JSON.parse);

test('natural titles retain prepositions and existing category words', () => {
  assert.deepEqual(predict('add go to school to errands for tomorrow'), {
    status: 'create_task', title: 'go to school', category: 'Errands', date: '2026-11-01'
  });
  assert.deepEqual(predict('Add go from Work to School to Errands tomorrow'), {
    status: 'create_task', title: 'go from Work to School', category: 'Errands', date: '2026-11-01'
  });
  assert.deepEqual(predict('ADD LEARN TO CODE TO projects tomorrow'), {
    status: 'create_task', title: 'LEARN TO CODE', category: 'Projects', date: '2026-11-01'
  });
});

test('multiword names, literal metacharacters, duplicate names and unknown names', () => {
  assert.deepEqual(predict('Add go to school to School Projects tomorrow', {
    categories: ['School', 'School Projects', 'Personal']
  }), {status: 'create_task', title: 'go to school',
    category: 'School Projects', date: '2026-11-01'});
  assert.equal(predict('Add write C++ to C++ tomorrow', {
    categories: ['C++']
  }).category, 'C++');
  assert.equal(predict('Add homework to school tomorrow', {
    categories: ['School', 'SCHOOL']
  }).status, 'needs_review');
  assert.equal(predict('Add homework to School tomorrow', {
    categories: ['Errands']
  }).status, 'needs_review');
  assert.equal(predict('Add homework to School tomorrow', {
    categories: []
  }).status, 'needs_review');
});

test('no quantity requests, bulk operations or suspicious extra intent become creates', () => {
  const inputs = [
    'Add 15 tasks to School tomorrow', 'Add several items to Errands tomorrow',
    'Add four assignments to School tomorrow', 'Add 8 errands to Errands tomorrow',
    'Add 15 unfinished School tasks to School tomorrow',
    'Add two urgent assignments to School tomorrow',
    'Add homework and buy milk to School tomorrow',
    'Add text to speech to Work today', 'Add move to Home to Home tomorrow',
    'Move all School tasks to Backlogs', 'Complete all School tasks',
    'Add homework to School tomorrow and pay bills'
  ];
  for (const input of inputs) assert.notEqual(predict(input, {chrono}).status, 'create_task', input);
  assert.equal(predict('Add buy 12 eggs to Errands tomorrow').status, 'create_task');
});

test('bounded title, anchored dates, calendar rollover, and explicit review', () => {
  assert.equal(predict('Add ' + 'x'.repeat(256) + ' to School tomorrow').status, 'needs_review');
  assert.deepEqual(predict('Add homework to School for tomorrow', {
    reference: new Date(2026, 11, 31, 12)
  }), {status:'create_task',title:'homework',category:'School',date:'2027-01-01'});
  assert.equal(predict('Add homework to School on 2026-02-30',{chrono}).status,'needs_review');
  assert.equal(predict('Add homework to School tomorrow morning',{chrono}).status,'needs_review');
});

test('fresh independent 40-case challenge remains fixed and is reported by group', () => {
  const rows = fixture('parser-lab-fresh-challenge.jsonl');
  assert.equal(rows.length, 40);
  assert.equal(new Set(rows.map(row => row.input.toLowerCase())).size, rows.length);
  const result = compare(rows, {chrono});
  assert.equal(result.count, 40);
  assert.equal(result.unsafe_create_count, 0);
  assert.deepEqual(Object.fromEntries(Object.entries(result.by_group)
    .map(([group, stats])=>[group, stats.count])), {
      fresh_create: 20, fresh_review: 12, fresh_unsupported: 8
    });
  assert.equal(result.exact_count, 40);
});

test('historical corpus and separate challenge retain zero actionable mistakes', () => {
  const datasets=[['cases.jsonl',168],['parser-lab-holdout.jsonl',30],
    ['parser-lab-regression.jsonl',88]];
  for(const [path,expectedCount] of datasets) {
    const report=compare(fixture(path),{chrono});
    assert.equal(report.count,expectedCount,path);
    assert.equal(report.unsafe_create_count,0,path);
    assert.equal(report.exact_count,expectedCount,path);
  }
});
