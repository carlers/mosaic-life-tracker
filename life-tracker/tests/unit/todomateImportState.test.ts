import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  beginTodoMateImport,
  clearTodoMateImportMarker,
  markTodoMateImportApplied,
  readTodoMateImportMarker,
} from '../../src/lib/todomateImportState';

describe('TodoMate import recovery marker', () => {
  const values = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    });
  });

  beforeEach(() => {
    values.clear();
  });

  afterAll(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('records only account-scoped progress metadata and advances to applied', () => {
    beginTodoMateImport('user_A', {
      tasks: 1000,
      categories: 12,
      diary: 3,
      photos: 24,
    });

    expect(readTodoMateImportMarker('user_A')).toMatchObject({
      version: 1,
      userId: 'user_A',
      phase: 'applying',
      expected: {
        tasks: 1000,
        categories: 12,
        diary: 3,
        photos: 24,
      },
    });
    expect(readTodoMateImportMarker('user_B')).toBeNull();

    markTodoMateImportApplied('user_A');
    expect(readTodoMateImportMarker('user_A')).toMatchObject({
      phase: 'applied',
      appliedAt: expect.any(String),
    });

    clearTodoMateImportMarker('user_A');
    expect(readTodoMateImportMarker('user_A')).toBeNull();
  });

  it('drops malformed persisted markers instead of trusting them', () => {
    localStorage.setItem(
      'mosaic_todomate_import_v1_user_A',
      JSON.stringify({ version: 1, userId: 'user_B', phase: 'applying' })
    );

    expect(readTodoMateImportMarker('user_A')).toBeNull();
    expect(localStorage.getItem('mosaic_todomate_import_v1_user_A')).toBeNull();
  });
});
