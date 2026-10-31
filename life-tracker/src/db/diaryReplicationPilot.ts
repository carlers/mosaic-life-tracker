import type { DiaryDocument } from './schema';
import { APPWRITE_TABLES } from '../lib/appwriteConfig';
import { sendAppAction } from '../lib/appAction';
import { createSimpleOwnerReplicationPilot, type SimpleOwnerPullCheckpoint, type SimpleOwnerPushCheckpoint } from './simpleOwnerReplicationPilot';

export type DiaryReplicationCheckpoint = SimpleOwnerPullCheckpoint;
export type DiaryReplicationPushCheckpoint = SimpleOwnerPushCheckpoint;

const pilot = createSimpleOwnerReplicationPilot<DiaryDocument>({
  collectionName: 'diary',
  tableId: APPWRITE_TABLES.diary,
  casTableId: 'diary',
  label: 'Diary',
  freshnessLabel: 'diary',
  beforeWrite: async (next, current, userId) => {
    if (next.userId !== userId ||
        !((next.visibility === 'private' && current.visibility !== 'private') ||
          (next.isDeleted && !current.isDeleted))) return false;
    let cursor = '';
    for (let page = 0; page < 100; page++) {
      const response = await sendAppAction({
        action: 'revoke_diary_references', diaryId: next.id,
        revision: next.updatedAt, cursor,
      });
      if (response.ok !== true || typeof response.nextCursor !== 'string')
        throw new Error('Diary quote revocation incomplete');
      if (!response.nextCursor) return true;
      if (response.nextCursor === cursor)
        throw new Error('Diary quote revocation made no progress');
      cursor = response.nextCursor;
    }
    throw new Error('Diary quote revocation exceeds bounded page limit');
  },
  equalityFields: ["id","userId","date","content","emoji","photos","visibility","createdAt","updatedAt","isDeleted"],
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
