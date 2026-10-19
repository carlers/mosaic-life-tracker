import { describe, expect, it } from 'vitest';
import { describePwaUpdate, parsePwaUpdateInfo } from '../../src/lib/pwaUpdateInfo';

const notes = [
  { version: '0.30.0', headline: 'See what changed', changes: ['Detailed updates', 'Better descriptions'] },
  { version: '0.29.13', headline: 'Task entry fix', changes: ['Task creation reliability'] },
];

describe('waiting-service-worker update descriptions', () => {
  it('classifies major, minor, patch and same-version worker changes', () => {
    const major = describePwaUpdate('0.29.12', { version: '1.0.0', releases: [] });
    expect(major.kind).toBe('major');
    expect(describePwaUpdate('0.29.12', { version: '0.30.0', releases: notes }).kind).toBe('minor');
    expect(describePwaUpdate('0.29.12', { version: '0.29.13', releases: notes.slice(1) }).kind).toBe('patch');
    expect(describePwaUpdate('0.30.0', { version: '0.30.0', releases: notes }).kind).toBe('maintenance');
  });

  it('shows only verified intermediate highlights newer than the installed version', () => {
    const result = describePwaUpdate('0.29.12', { version: '0.30.0', releases: notes });
    expect(result.version).toBe('0.30.0');
    expect(result.title).toBe('See what changed');
    expect(result.changes).toEqual(['Detailed updates', 'Better descriptions', 'Task creation reliability']);
    expect(describePwaUpdate('0.29.13', { version: '0.30.0', releases: notes }).changes)
      .toEqual(['Detailed updates', 'Better descriptions']);
  });

  it('fails closed on missing, stale, untrusted or invalid worker replies', () => {
    expect(parsePwaUpdateInfo(null)).toBeNull();
    expect(parsePwaUpdateInfo({ version: '0.30.0', releases: [{ version: '0.31.0', headline: 'Future', changes: ['X'] }] })).toBeNull();
    expect(parsePwaUpdateInfo({ version: '0.30.0', releases: [{ version: '0.30.0', headline: '<script>', changes: [] }, { version: '0.30.0', headline: 'Duplicate', changes: [] }] })).toBeNull();
    expect(parsePwaUpdateInfo({ version: 'bad', releases: [] })).toBeNull();
    expect(parsePwaUpdateInfo({ version: '0.30.0', releases: notes })).toEqual({ version: '0.30.0', releases: notes });
    expect(describePwaUpdate('0.30.0', { version: '0.29.13', releases: [] }).kind).toBe('unknown');
    expect(describePwaUpdate('0.29.12', null).changes).toEqual([]);
  });
});
