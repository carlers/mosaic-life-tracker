import { sendAppAction } from './appAction';

export type TaskRequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'unavailable';
export type TaskRequestEvent = 'created' | 'accepted' | 'declined' | 'withdrawn';
export interface TaskRequestItem {
  id: string;
  senderId: string;
  recipientId: string;
  title: string;
  note: string;
  suggestedDate: string;
  status: TaskRequestStatus;
  revision: string;
  createdAt: string;
  updatedAt: string;
}
function extractItem(result: Record<string, unknown>): TaskRequestItem {
  const item = result.item as TaskRequestItem | undefined;
  if (!item || typeof item.id !== 'string' || typeof item.revision !== 'string' ||
      typeof item.status !== 'string') throw new Error('Task request response unavailable');
  return item;
}
export const taskRequestOperationId = () => crypto.randomUUID().replaceAll('-', '');
export async function getTaskRequest(requestId: string): Promise<TaskRequestItem> {
  return extractItem(await sendAppAction({action:'task_requests', operation:'get',requestId}));
}
export async function sendTaskRequest(payload:{
  recipientId: string;title:string;note:string;suggestedDate:string;operationId:string;
}): Promise<TaskRequestItem> {
  return extractItem(await sendAppAction({action:'task_requests',operation:'send',...payload}));
}
export async function transitionTaskRequest(payload:{
  requestId:string;operation:'accept'|'decline'|'withdraw';operationId:string;
  expectedRevision:string; categoryId?:string;date?:string;ownerLocalDate?:string;
}): Promise<TaskRequestItem> {
  return extractItem(await sendAppAction({action:'task_requests',...payload}));
}
