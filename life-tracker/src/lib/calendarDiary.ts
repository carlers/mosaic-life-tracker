export interface CalendarDiaryPreview {
  entryCount: number;
  excerpt: string;
  emoji: string;
  /** Icon-only projections never contain Diary excerpt or emoji bytes. */
  style?: 'icon';
}

import type { DiaryDocument } from '../db/schema';

export interface CalendarDiaryConfig {
  /** Optional complete owner snapshot for Day View; never shown in Calendar cells. */
  ownerId?: string;
  entries?: readonly DiaryDocument[];
  isLoading?: boolean;
  previews: ReadonlyMap<string, CalendarDiaryPreview>;
  counted: boolean;
  position: import('./preferences').CalendarDiaryPosition;
}

export interface CalendarDiarySnapshot extends CalendarDiaryConfig {
  ownerId: string;
}
