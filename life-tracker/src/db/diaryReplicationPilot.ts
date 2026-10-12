import type { DiaryDocument } from './schema';
import { APPWRITE_TABLES } from '../lib/appwriteConfig';
import { createSimpleOwnerReplicationPilot, type SimpleOwnerPullCheckpoint, type SimpleOwnerPushCheckpoint } from './simpleOwnerReplicationPilot';

export type DiaryReplicationCheckpoint = SimpleOwnerPullCheckpoint;
export type DiaryReplicationPushCheckpoint = SimpleOwnerPushCheckpoint;

const pilot = createSimpleOwnerReplicationPilot<DiaryDocument>({
  collectionName: 'diary',
  tableId: APPWRITE_TABLES.diary,
  casTableId: 'diary',
  label: 'Diary',
  freshnessLabel: 'diary',
  equalityFields: ["id","userId","date","content","emoji","visibility","createdAt","updatedAt","isDeleted"],
});

export const captureDiaryReplicationPushCheckpoint = pilot.capture;
export const isDiaryReplicationPilotActive = pilot.active;
export const resyncDiaryReplicationPilot = pilot.resync;
export const refreshDiaryReplicationPilot = pilot.refresh;
export const startDiaryReplicationPilot = pilot.start;
export const stopDiaryReplicationPilot = pilot.stop;
export const __diaryReplicationPilotTestUtils = {
  pullDiary: pilot.pull,
  pushDiary: pilot.push,
};
