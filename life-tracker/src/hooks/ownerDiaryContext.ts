import React from 'react';
import type { DiaryDocument } from '../db/schema';

/**
 * One owner-scoped, local-first Diary snapshot for the Day View and all
 * virtualized neighboring days. Null means a standalone caller should
 * subscribe itself. Never reuse entries across account identity changes.
 */
export interface OwnerDiarySnapshot {
  ownerId: string;
  entries: readonly DiaryDocument[];
  isLoading: boolean;
}
export const OwnerDiaryContext = React.createContext<OwnerDiarySnapshot | null>(null);
