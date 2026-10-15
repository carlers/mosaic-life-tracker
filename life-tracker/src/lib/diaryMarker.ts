import type { DiaryDocument } from '../db/schema';

/** Legacy TodoMate imports joined emoji and text. This fallback never rewrites the record. */
export function diaryMarker(entry: Pick<DiaryDocument, 'emoji' | 'content'>): string {
  if (entry.emoji) return entry.emoji;
  const legacy = /^([\p{Extended_Pictographic}\uFE0F\u200D]+)\s/u.exec(entry.content || '');
  return legacy?.[1] || '';
}
