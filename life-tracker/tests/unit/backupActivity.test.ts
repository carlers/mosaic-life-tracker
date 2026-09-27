import { beforeEach, describe, expect, it } from 'vitest';
import {
  getBackupActivity,
  recordBackupActivity,
} from '../../src/lib/backupActivity';

describe('backup activity metadata', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores backup and restore timestamps separately per user', () => {
    recordBackupActivity('user_A', 'backup', '2026-09-27T01:00:00.000Z');
    recordBackupActivity('user_A', 'restore', '2026-09-27T02:00:00.000Z');
    recordBackupActivity('user_B', 'backup', '2026-09-27T03:00:00.000Z');

    expect(getBackupActivity('user_A')).toEqual({
      lastBackupAt: '2026-09-27T01:00:00.000Z',
      lastRestoreAt: '2026-09-27T02:00:00.000Z',
    });
    expect(getBackupActivity('user_B')).toEqual({
      lastBackupAt: '2026-09-27T03:00:00.000Z',
      lastRestoreAt: null,
    });
  });

  it('fails soft when stored activity metadata is malformed', () => {
    window.localStorage.setItem('mosaic_backup_activity:user_A', '{broken');

    expect(getBackupActivity('user_A')).toEqual({
      lastBackupAt: null,
      lastRestoreAt: null,
    });
  });
});
