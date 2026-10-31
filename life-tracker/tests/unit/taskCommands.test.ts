import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTaskCommand, parseTaskCommandPreview, isValidCommandDate } from '../../src/lib/taskCommands';

const names = ['School', 'Personal', 'Work', 'Health', 'Home', 'Errands', 'College', 'Projects'];
const fixed = new Date(2026, 9, 31, 12, 0);
type Case = {
  id: string;
  input: string;
  expected: { status: string; title: string | null; category: string | null; date: string | null };
};
const cases = (filename: string): Case[] =>
  readFileSync(new URL('../fixtures/commands/' + filename, import.meta.url), 'utf8')
    .trim().split(/\r?\n/).map(line => JSON.parse(line) as Case);

describe('Home natural-language task draft parser', () => {
  for (const file of ['parser-lab-holdout.jsonl', 'parser-lab-regression.jsonl', 'parser-lab-fresh-challenge.jsonl']) {
    it('retains safe interpretation on synthetic fixture ' + file, () => {
      for (const row of cases(file)) {
        expect(parseTaskCommand(row.input, names, fixed), row.id + ': ' + row.input)
          .toEqual(row.expected);
      }
    });
  }

  it('interprets task titles containing "to" and category words', () => {
    expect(parseTaskCommand('add go to school to errands for tomorrow', names, fixed))
      .toEqual({ status: 'create_task', title: 'go to school',
        category: 'Errands', date: '2026-11-01' });
    expect(parseTaskCommand('ADD LEARN TO CODE TO PROJECTS tomorrow', names, fixed))
      .toEqual({ status: 'create_task', title: 'LEARN TO CODE',
        category: 'Projects', date: '2026-11-01' });
  });

  it('does not invent a target when category names conflict or do not exist', () => {
    expect(parseTaskCommand('Add homework to SCHOOL tomorrow', ['School', 'school'], fixed).status)
      .toBe('needs_review');
    expect(parseTaskCommand('Add homework to SCHOOL tomorrow', ['Personal'], fixed).status)
      .toBe('needs_review');
    expect(parseTaskCommand('Add write C++ to C++ tomorrow', ['C++'], fixed).category)
      .toBe('C++');
    expect(parseTaskCommand('Add go to school to School Projects tomorrow',
      ['School', 'School Projects'], fixed)).toMatchObject({
      title: 'go to school', category: 'School Projects',
    });
  });

  it('never treats unsupported bulk and count-based requests as single tasks', () => {
    for (const text of [
      'move all tasks from School to backlogs',
      'delete everything in College',
      'Add 15 tasks to School tomorrow',
      'Add two unfinished assignments to School tomorrow',
      'Add homework and buy milk to Errands tomorrow',
      'Add text to speech to Work today',
    ]) {
      expect(parseTaskCommand(text, names, fixed).status, text).not.toBe('create_task');
    }
  });

  it('validates dates and local tomorrow across month and year boundaries', () => {
    expect(isValidCommandDate('2026-02-30')).toBe(false);
    expect(isValidCommandDate('2028-02-29')).toBe(true);
    expect(parseTaskCommand('Add call mom to Personal tomorrow', names,
      new Date(2026, 11, 31, 12))).toMatchObject({ date: '2027-01-01' });
  });
});


describe('partial review extraction', () => {
  it('keeps task title and category when date is omitted', () => {
    expect(parseTaskCommandPreview('add do physics to school', names, fixed)).toEqual({
      status:'needs_review',title:'do physics',category:'School',date:null
    });
  });
  it('extracts unknown destination as a review suggestion, never a create action', () => {
    expect(parseTaskCommandPreview('add review galaxies to Astronomy tomorrow',names,fixed))
      .toEqual({status:'needs_review',title:'review galaxies',category:'Astronomy',date:'2026-11-01'});
  });
  it('rejects unsafe bulk and ambiguous destination suggestions', () => {
    expect(parseTaskCommandPreview('Move all tasks to Backlogs',names,fixed).status).toBe('unsupported');
    expect(parseTaskCommandPreview('Add 15 tasks to School',names,fixed).title).toBeNull();
    expect(parseTaskCommandPreview('Add homework to School or College tomorrow',names,fixed).category).toBeNull();
  });
});
