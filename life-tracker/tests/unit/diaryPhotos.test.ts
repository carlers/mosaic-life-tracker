import { describe, expect, it } from 'vitest';
import { parseDiaryPhotos, serializeDiaryPhotos } from '../../src/lib/diaryPhotos';
describe('Diary photo IDs', () => {
  it('validates a bounded, ordered collection of opaque storage IDs', () => {
    const ids=['img_first','img_second'];
    expect(serializeDiaryPhotos(ids)).toBe('["img_first","img_second"]');
    expect(parseDiaryPhotos(serializeDiaryPhotos(ids))).toEqual(ids);
    expect(() => serializeDiaryPhotos([ids[0],ids[0]])).toThrow();
    expect(() => serializeDiaryPhotos(Array(6).fill('img_x'))).toThrow();
    expect(() => serializeDiaryPhotos(['data:image/webp;base64,AAA'])).toThrow();
  });
  it('gracefully reads legacy diary without any attached images', () => {
    expect(parseDiaryPhotos(undefined)).toEqual([]);
    expect(parseDiaryPhotos('invalid')).toEqual([]);
    expect(parseDiaryPhotos('[]')).toEqual([]);
  });
});
