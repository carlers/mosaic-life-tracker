import { ExecutionMethod } from 'appwrite';
import { APPWRITE_PROJECT_ID } from './appwriteConfig';
import { getConnectivitySnapshot } from './connectivity';
import { guardedFunctions } from './sdk';
import { isFloppyDay, parseFloppyHistoryPage, type FloppyActivityPage } from './floppyHistory';

const PREVIEW_PROJECT_ID = '6ae94a2100014d01f5ed';
const PREVIEW_FUNCTION_ID = 'floppy_media_preview';

/**
 * Runtime and build safeguards are deliberately independent. The Function
 * additionally validates the JWT, owner and exact Appwrite Preview project.
 */
export const FLOPPY_PREVIEW_AVAILABLE = APPWRITE_PROJECT_ID === PREVIEW_PROJECT_ID
  && import.meta.env.VITE_FLOPPY_ACTIVITY_FUNCTION_ID === PREVIEW_FUNCTION_ID;

export async function getFloppyDay(day: string, offset = 0): Promise<FloppyActivityPage> {
  if (!FLOPPY_PREVIEW_AVAILABLE) throw new Error('Floppy integration is not configured');
  if (!isFloppyDay(day) || !Number.isSafeInteger(offset) || offset < 0 || offset > 2000)
    throw new Error('Invalid Floppy history request');
  if (getConnectivitySnapshot().status !== 'online') throw new Error('Offline');

  const execution = await guardedFunctions.createExecution({
    functionId: PREVIEW_FUNCTION_ID,
    body: JSON.stringify({ action: 'history', day, offset }),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  });
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200) {
    const error = new Error(
      execution.responseStatusCode === 401 || execution.responseStatusCode === 403
        ? 'Floppy connection not authorized' : 'Floppy temporarily unavailable'
    );
    (error as Error & { status?: number }).status = execution.responseStatusCode;
    throw error;
  }
  try {
    return parseFloppyHistoryPage(JSON.parse(execution.responseBody), day);
  } catch {
    throw new Error('Floppy API response is incompatible');
  }
}
