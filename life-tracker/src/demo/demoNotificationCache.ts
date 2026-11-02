/**
 * Fictional alerts consumed by the actual NotificationsPage. This replaces
 * only its offline cache inside the separate demo build. No remote service.
 */
import type { NotificationEntry } from '../lib/notifications';
import type { TaskDocument } from '../db/schema';
import { DEMO_OWNER } from './fixtures';

export interface CachedNotificationFeed {
  items: NotificationEntry[];
  nextCursor: string;
  fetchedAt: string;
}
const KEY='fictional-notification-feed';
function sample():CachedNotificationFeed {
  const now=Date.now();
  const at=(minutes:number)=>new Date(now-minutes*60_000).toISOString();
  const items:NotificationEntry[]=[
    {
      id:'demo-alert-message',type:'direct_message',actorId:'demo_friend_lee',
      actorName:'Lee (demo)',actorUsername:'lee-demo',actorAvatarFileId:'',
      targetId:'demo_message_lee_in',destination:'/messages/demo_friend_lee',
      occurredAt:at(9),createdAt:at(9),readAt:'',detail:'A fictional sample message',
    },
    {
      id:'demo-alert-friend',type:'friend_accepted',actorId:'demo_friend_ava',
      actorName:'Ava (demo)',actorUsername:'ava-demo',actorAvatarFileId:'',
      targetId:'demo_friend_ava',destination:'/explore',
      occurredAt:at(95),createdAt:at(95),readAt:'',
    },
  ];
  return {items,nextCursor:'',fetchedAt:new Date(now).toISOString()};
}
export function redactCachedNotificationDetails(items:NotificationEntry[]):NotificationEntry[]{
  return items.map(item=>item.type==='task_completed'?item:({
    id:item.id,type:item.type,actorId:item.actorId,actorName:item.actorName,
    actorUsername:item.actorUsername,actorAvatarFileId:item.actorAvatarFileId,
    targetId:item.targetId,destination:item.destination,
    occurredAt:item.occurredAt,createdAt:item.createdAt,readAt:item.readAt,
  }));
}
export async function getCachedNotifications(userId:string):Promise<CachedNotificationFeed|null>{
  if(userId!==DEMO_OWNER)return null;
  try{
    const raw=localStorage.getItem(KEY);
    if(raw){
      const parsed=JSON.parse(raw) as CachedNotificationFeed;
      if(Array.isArray(parsed.items))return parsed;
    }
  }catch{/* The fallback remains a fictional, non-network feed. */}
  const initial=sample();
  await setCachedNotifications(userId,initial);
  return initial;
}
export async function setCachedNotifications(userId:string,feed:CachedNotificationFeed):Promise<void>{
  if(userId!==DEMO_OWNER)return;
  try{localStorage.setItem(KEY,JSON.stringify(feed));}catch{/* Storage may be disabled. */}
}
export async function patchCachedNotificationTask(
  userId:string,taskId:string,updates:Partial<TaskDocument>
):Promise<void>{
  const feed=await getCachedNotifications(userId);
  if(!feed)return;
  await setCachedNotifications(userId,{...feed,items:feed.items.map(item=>
    item.type==='task_completed'&&item.task.id===taskId
      ? {...item,task:{...item.task,...updates}}:item
  )});
}
export async function markCachedNotificationsRead(
  userId:string,ids:string[],readAt:string
):Promise<void>{
  const feed=await getCachedNotifications(userId);
  if(!feed)return;
  const selected=new Set(ids);
  await setCachedNotifications(userId,{...feed,items:feed.items.map(item=>
    selected.has(item.id)&&!item.readAt?{...item,readAt}:item
  )});
}
