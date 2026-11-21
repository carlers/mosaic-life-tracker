import { describe, expect, it, vi } from 'vitest';
import {
  AUTO_DIARY_MONTH_EMOJI, diaryEntryOrderModeKey, diaryManualOrderKey, diaryMonthEmojiKey,
  groupDiaryMonthMarkers, moveDiaryEntry, orderDiaryDayEntries, readDiaryManualOrder,
  resolveDiaryEntryOrderMode, resolveDiaryMonthEmoji, saveDiaryManualOrder, sanitizeDiaryManualOrder,
} from '../../src/lib/diaryDayOrder';
const date = '2026-11-21';
const entries = [
  { id: 'a', date, createdAt: '2026-11-21T08:00:00Z', emoji: '', content: 'Morning' },
  { id: 'b', date, createdAt: '2026-11-21T10:00:00Z', emoji: '🌸', content: 'Afternoon' },
  { id: 'c', date, createdAt: '2026-11-21T14:00:00Z', emoji: '🌙', content: 'Night' },
  { id: 'd', date, createdAt: '2026-11-21T18:00:00Z', emoji: '', content: 'Late' },
];
describe('Diary day order and month marker', () => {
  it('retains manual memory when switching chronological modes and handles new entries', () => {
    const scrambled = [entries[3], entries[1], entries[0], entries[2]];
    expect(orderDiaryDayEntries(scrambled, 'oldest').map(x => x.id)).toEqual(['a','b','c','d']);
    expect(orderDiaryDayEntries(scrambled, 'newest').map(x => x.id)).toEqual(['d','c','b','a']);
    const manual = moveDiaryEntry(['d','c','b','a'], 'b', 'd');
    expect(manual).toEqual(['b','d','c','a']);
    expect(orderDiaryDayEntries(scrambled, 'manual', manual).map(x => x.id)).toEqual(manual);
    expect(orderDiaryDayEntries(scrambled, 'oldest', manual).map(x => x.id)).toEqual(['a','b','c','d']);
    expect(orderDiaryDayEntries([...scrambled, {
      id: 'e', date, createdAt: '2026-11-21T22:00:00Z', emoji: '', content: 'New',
    }], 'manual', manual).map(x => x.id)).toEqual([...manual, 'e']);
  });
  it('uses first *available* emoji in selected order, not the last row at this date', () => {
    expect(groupDiaryMonthMarkers([entries[3],entries[0],entries[2],entries[1]]).get(date))
      .toEqual({count: 4, emoji: '🌸'});
    expect(resolveDiaryMonthEmoji(orderDiaryDayEntries(entries, 'newest'), AUTO_DIARY_MONTH_EMOJI)).toBe('🌙');
    expect(resolveDiaryMonthEmoji(entries, 'c')).toBe('🌙');
    expect(resolveDiaryMonthEmoji(entries, 'missing')).toBe('🌸');
    expect(groupDiaryMonthMarkers([{...entries[0],isDeleted:true},entries[1]]).get(date))
      .toEqual({count:1,emoji:'🌸'});
  });
  it('uses settings for manual ordering and a chosen month emoji', () => {
    const prefs: Record<string,unknown> = {
      [diaryEntryOrderModeKey(date)]: 'manual',
      [diaryManualOrderKey(date)]: ['d','c','b','a'],
      [diaryMonthEmojiKey(date)]: 'b',
    };
    const get = (k:string) => prefs[k];
    expect(groupDiaryMonthMarkers(entries, get).get(date)?.emoji).toBe('🌸');
    delete prefs[diaryMonthEmojiKey(date)];
    expect(groupDiaryMonthMarkers(entries, get).get(date)?.emoji).toBe('🌙');
  });
  it('ignores invalid mode, duplicate identifiers and stale chunk metadata', () => {
    expect(resolveDiaryEntryOrderMode('wrong')).toBe('oldest');
    expect(sanitizeDiaryManualOrder(['a','a','!',12,'b'])).toEqual(['a','b']);
    expect(moveDiaryEntry(['a','b'], 'missing','a')).toEqual(['a','b']);
    expect(readDiaryManualOrder(date, () => ({version:'wrong',parts:1}))).toEqual([]);
  });
  it('persists long manual order in small revision-checked chunks and commits manifest last', async () => {
    const map = new Map<string,unknown>(), written:string[] = [];
    const get = (k:string)=>map.get(k);
    const set = vi.fn(async(k:string,v:unknown)=>{written.push(k);map.set(k,v);});
    const ids=Array.from({length:420},(_,i)=>'entry_'+String(i).padStart(6,'0')+'_very_long_identifier');
    await saveDiaryManualOrder(date,ids,get,set);
    expect(written.at(-1)).toBe(diaryManualOrderKey(date));
    expect(written.length).toBe(6);
    expect(readDiaryManualOrder(date,get)).toEqual(ids);
    const active = map.get(diaryManualOrderKey(date)) as {slot:number;version:string;parts:number};
    map.set(diaryManualOrderKey(date)+':' + active.slot + ':1',
      {version:'wrong_abcdefgh',ids:ids.slice(100,200)});
    expect(readDiaryManualOrder(date,get)).toEqual([]);
    await saveDiaryManualOrder(date,['a','b'],get,set);
    expect(readDiaryManualOrder(date,get)).toEqual(['a','b']);
  });
  it('preserves the previous large manual order when the next chunked save fails', async () => {
    const map = new Map<string, unknown>();
    const get = (key:string)=>map.get(key);
    const set = async (key:string,value:unknown)=>{map.set(key,value);};
    const ids = Array.from({length:350},(_,i)=>'entry_'+String(i).padStart(6,'0')+'_very_long_identifier');
    await saveDiaryManualOrder(date,ids,get,set);
    const active = map.get(diaryManualOrderKey(date));
    const next = [...ids].reverse();
    await expect(saveDiaryManualOrder(date,next,get,async (key,value) => {
      if (key.endsWith(':1:1')) throw new Error('Offline mid-save');
      map.set(key,value);
    })).rejects.toThrow('Offline mid-save');
    expect(map.get(diaryManualOrderKey(date))).toEqual(active);
    expect(readDiaryManualOrder(date,get)).toEqual(ids);
  });

});
