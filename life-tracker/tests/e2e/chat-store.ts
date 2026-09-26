import { useSyncExternalStore } from 'react';
import type { MessageDocument } from '../../src/db/schema';
let sequence = 0;
export function message(direction: MessageDocument['direction'] = 'incoming'): MessageDocument {
  const n = ++sequence;
  return { id: `m${n}`, userId: 'me', senderId: direction === 'outgoing' ? 'me' : 'friend', recipientId: 'me', threadId: 'thread', direction, content: `Message ${n}: a conversation with enough text to wrap on a phone screen.`, createdAt: new Date(1700000000000 + n * 1000).toISOString(), readAt: '', deliveryStatus: 'delivered', isDeleted: false, taskRefId: '', taskRefDate: '', taskRefColor: '', originalMessageId: '', updatedAt: '', taskRefTitle: '', isUnsent: false, replyToId: '', replyToSenderId: '', replyToContent: '', reactions: '{}' };
}
let snapshot = { messages: Array.from({ length: 60 }, () => message()), isLoading: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const actions = {
  sendMessage: async () => { control.append('outgoing'); },
  markAllRead: async () => {}, unsendMessage: async () => {}, toggleReaction: async () => ({ success: true }),
};
export const control = {
  append(direction: MessageDocument['direction'] = 'incoming') { snapshot = { ...snapshot, messages: [...snapshot.messages, message(direction)] }; emit(); },
  load(count = 60) { snapshot = { messages: Array.from({ length: count }, () => message()), isLoading: false }; emit(); },
  loading() { snapshot = { messages: [], isLoading: true }; emit(); },
  quote() { const target = snapshot.messages[2]; snapshot = { ...snapshot, messages: [...snapshot.messages, { ...message(), replyToId: target.id, replyToSenderId: target.senderId, replyToContent: 'Jump to earlier message' }] }; emit(); },
  edit() { snapshot = { ...snapshot, messages: snapshot.messages.map((m, i) => i === 0 ? { ...m, content: m.content + ' edited' } : m) }; emit(); },
};
export function useMessages() {
  return { ...useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => snapshot), ...actions };
}
export function useFriends() { return { friends: [{ friendId: 'friend', friendDisplayName: 'Test Friend' }] }; }
export function useAuth() { return { user: { $id: 'me' } }; }
Object.assign(window, { chatControl: control });
