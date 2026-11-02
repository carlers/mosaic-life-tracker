import { describe, expect, it } from 'vitest';
import { makeDemoFixtures, DEMO_OWNER, DEMO_DB_NAME } from '../../src/demo/fixtures';
import { startOfDay } from 'date-fns';

describe('isolated public demo fixtures',()=>{
  const anchor=new Date(2026,10,2);
  it('is deterministic with unique synthetic IDs and no real-user identity',()=>{
    const a=makeDemoFixtures(anchor),b=makeDemoFixtures(anchor);
    expect(a).toEqual(b);
    expect(DEMO_DB_NAME).not.toBe('life_tracker_db');
    expect(a.categories.length).toBe(4);
    expect(a.tasks.length).toBeGreaterThanOrEqual(25);
    expect(new Set(a.tasks.map(t=>t.id)).size).toBe(a.tasks.length);
    expect(a.tasks.every(t=>t.userId===DEMO_OWNER&&t.visibility==='private'&&!t.isDeleted)).toBe(true);
    expect(a.categories.every(c=>c.userId===DEMO_OWNER&&!c.isDeleted)).toBe(true);
    expect(a.tasks.some(t=>t.completed)).toBe(true);
    expect(a.tasks.some(t=>!t.completed)).toBe(true);
    expect(a.tasks.some(t=>t.date==='')).toBe(true);
  });
  it('uses the chosen local calendar anchor instead of the current date',()=>{
    const a=makeDemoFixtures(anchor);
    expect(a.tasks.filter(t=>t.date==='2026-11-02').length).toBeGreaterThan(2);
    expect(startOfDay(anchor).getFullYear()).toBe(2026);
  });
});
