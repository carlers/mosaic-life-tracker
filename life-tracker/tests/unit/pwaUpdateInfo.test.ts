import { describe, expect, it } from 'vitest';
import { describePwaUpdate, parsePwaUpdateInfo } from '../../src/lib/pwaUpdateInfo';

describe('waiting-worker release details', () => {
  const notes = [
    { version: '0.82.0', headline: 'Update experience', changes: ['Centered dialog', 'Home dot'] },
    { version: '0.81.10', headline: 'Fixes', changes: ['Task reliability'] },
  ];
  it('identifies version change type and verified skipped versions', () => {
    expect(describePwaUpdate('0.81.9', { version: '0.82.0', releases: notes }).kind).toBe('minor');
    expect(describePwaUpdate('0.81.9', { version: '0.81.10', releases: notes.slice(1) }).kind).toBe('patch');
    expect(describePwaUpdate('0.81.9', { version: '1.0.0', releases: [] }).kind).toBe('major');
    expect(describePwaUpdate('0.82.0', { version: '0.82.0', releases: [] }).kind).toBe('maintenance');
    expect(describePwaUpdate('0.81.9', { version: '0.82.0', releases: notes }).changes)
      .toEqual(['Centered dialog', 'Home dot', 'Task reliability']);
  });
  it('refuses malformed, future, duplicate and stale metadata', () => {
    expect(parsePwaUpdateInfo({ version: '0.82.0', releases: notes })).toEqual({ version: '0.82.0', releases: notes });
    expect(parsePwaUpdateInfo({ version: '0.82.0', releases: [{ version: '0.83.0', headline: 'Future', changes: [] }] })).toBeNull();
    expect(parsePwaUpdateInfo({ version: '0.82.0', releases: [notes[0], notes[0]] })).toBeNull();
    expect(parsePwaUpdateInfo({ version: 'x', releases: [] })).toBeNull();
    expect(describePwaUpdate('0.82.0', { version: '0.81.0', releases: [] }).kind).toBe('unknown');
    expect(describePwaUpdate('0.82.0', null).changes).toEqual([]);
  });
});
