import { getDatabase } from '../db/database';
import { isCompletedDayAfterTaskChange, isScheduledCompletionDay } from './completionFeedback';
import { publishCompletionFeedback } from './completionFeedbackEvents';

/** Deferred after a confirmed foreground owner write. Never called by sync. */
export async function publishCompletedDayAfterLocalWrite(
  userId: string, taskId: string, date: string
): Promise<void> {
  if (!isScheduledCompletionDay(date)) return;
  const rows = await getDatabase().tasks.find({
    selector: { userId, date, isDeleted: false },
  }).exec();
  if (isCompletedDayAfterTaskChange(rows, userId, date, taskId)) {
    publishCompletionFeedback('day-complete', userId, taskId, date);
  }
}
