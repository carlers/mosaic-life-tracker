export interface CalendarDiaryPreview {
  entryCount: number;
  excerpt: string;
  emoji: string;
}

export interface CalendarDiarySnapshot {
  ownerId: string;
  previews: ReadonlyMap<string, CalendarDiaryPreview>;
}
