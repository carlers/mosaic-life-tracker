export interface CalendarDiaryPreview {
  entryCount: number;
  excerpt: string;
  emoji: string;
}

export interface CalendarDiaryConfig {
  previews: ReadonlyMap<string, CalendarDiaryPreview>;
  counted: boolean;
  position: import('./preferences').CalendarDiaryPosition;
}

export interface CalendarDiarySnapshot extends CalendarDiaryConfig {
  ownerId: string;
}
