export interface CalendarDiaryPreview {
  entryCount: number;
  excerpt: string;
  emoji: string;
  /** Icon-only projections never contain Diary excerpt or emoji bytes. */
  style?: 'icon';
}

export interface CalendarDiaryConfig {
  previews: ReadonlyMap<string, CalendarDiaryPreview>;
  counted: boolean;
  position: import('./preferences').CalendarDiaryPosition;
}

export interface CalendarDiarySnapshot extends CalendarDiaryConfig {
  ownerId: string;
}
