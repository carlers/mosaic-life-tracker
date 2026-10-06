import { ExecutionMethod } from 'appwrite';
import { APPWRITE_MESSAGE_ACTION_FUNCTION_ID } from './appwriteConfig';
import { getConnectivitySnapshot } from './connectivity';
import { guardedFunctions } from './sdk';

export async function sendAppAction(
  payload: Record<string, unknown>,
  timeoutMs = 15_000
): Promise<Record<string, unknown>> {
  if (getConnectivitySnapshot().status !== 'online') {
    throw new Error('Offline');
  }
  if (APPWRITE_MESSAGE_ACTION_FUNCTION_ID.startsWith('REPLACE_')) {
    throw new Error('MESSAGE_ACTION_FUNCTION_ID not configured');
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const execPromise = guardedFunctions.createExecution({
    functionId: APPWRITE_MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify(payload),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  });
  execPromise.catch(() => {});

  const execution = await Promise.race([
    execPromise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(`Message action timed out after ${timeoutMs}ms`)
          ),
        timeoutMs
      );
    }),
  ]).finally(() => {
    if (timeoutId !== null) clearTimeout(timeoutId);
  });

  if (
    execution.status !== 'completed' ||
    execution.responseStatusCode >= 400
  ) {
    const err = new Error(
      `Message action failed (${execution.responseStatusCode}): ${execution.responseBody}`
    );
    (err as { code?: number }).code = execution.responseStatusCode;
    try {
      const result = JSON.parse(execution.responseBody);
      (err as { result?: unknown }).result = result;
      if (
        payload.action === 'friendship' &&
        typeof result.error === 'string'
      ) {
        err.message = result.error;
      }
    } catch {
      // Preserve the generic error for an invalid server response.
    }
    throw err;
  }

  try {
    return JSON.parse(execution.responseBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}
