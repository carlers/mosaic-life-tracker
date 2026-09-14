export interface Reaction {
  emoji: string;
  userIds: string[];
}

/** Parse a stored reactions string. Returns [] on any malformed input. */
export function parseReactions(raw: string | undefined): Reaction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r: unknown): r is Reaction =>
          !!r &&
          typeof r === 'object' &&
          typeof (r as Reaction).emoji === 'string' &&
          Array.isArray((r as Reaction).userIds)
      )
      .map((r) => ({
        emoji: r.emoji,
        userIds: r.userIds.filter((id): id is string => typeof id === 'string'),
      }))
      .filter((r) => r.userIds.length > 0);
  } catch {
    return [];
  }
}

/** Stringify reactions, deduping userIds and pruning empties. */
export function stringifyReactions(reactions: Reaction[]): string {
  const cleaned = reactions
    .map((r) => ({
      emoji: r.emoji,
      userIds: Array.from(new Set(r.userIds)),
    }))
    .filter((r) => r.userIds.length > 0);
  if (cleaned.length === 0) return '';
  return JSON.stringify(cleaned);
}

/** Apply an add/remove of one user to one emoji. Idempotent. */
export function applyReactionDelta(
  reactions: Reaction[],
  emoji: string,
  userId: string,
  op: 'add' | 'remove'
): Reaction[] {
  const next: Reaction[] = reactions.map((r) => ({
    emoji: r.emoji,
    userIds: [...r.userIds],
  }));

  const idx = next.findIndex((r) => r.emoji === emoji);

  if (op === 'add') {
    if (idx === -1) {
      next.push({ emoji, userIds: [userId] });
    } else if (!next[idx].userIds.includes(userId)) {
      next[idx].userIds.push(userId);
    }
  } else {
    if (idx !== -1) {
      next[idx].userIds = next[idx].userIds.filter((id) => id !== userId);
      if (next[idx].userIds.length === 0) next.splice(idx, 1);
    }
  }
  return next;
}

/** Does the given user currently have the given emoji reaction? */
export function hasUserReacted(
  reactions: Reaction[],
  emoji: string,
  userId: string
): boolean {
  const r = reactions.find((x) => x.emoji === emoji);
  return !!r && r.userIds.includes(userId);
}