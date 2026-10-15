import { describe, expect, it } from 'vitest';
import { diaryMarker } from '../../src/lib/diaryMarker';

describe('Diary marker legacy compatibility', () => {
  it('prefers explicit emoji and leaves body unchanged', () => {
    const doc = { emoji: '🌞', content: '📝 old text' };
    expect(diaryMarker(doc)).toBe('🌞');
    expect(doc.content).toBe('📝 old text');
  });
  it('shows a read-only marker for old TodoMate emoji + body rows', () => {
    expect(diaryMarker({ content: '🌱 A good day' })).toBe('🌱');
  });
  it('does not invent an emoji for ordinary text or punctuation', () => {
    expect(diaryMarker({ content: 'A good day' })).toBe('');
    expect(diaryMarker({ content: '✨achievement' })).toBe('');
  });
});
