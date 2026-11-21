export const DIARY_EDITOR_WIDTH_SETTING_KEY = 'diaryEditorWidth';
export type DiaryEditorWidth = 'focused' | 'full';

/** Invalid or missing settings retain the existing centered editor width. */
export function resolveDiaryEditorWidth(value: unknown): DiaryEditorWidth {
  return value === 'full' ? 'full' : 'focused';
}
