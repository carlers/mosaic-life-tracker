import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  parseReactions as clientParse,
  stringifyReactions as clientStringify,
  applyReactionDelta as clientApply,
  type Reaction,
} from '../../src/lib/reactionUtils';
import { makeRecipientRowId as clientMakeRecipient } from '../../src/lib/threads';

// NOTE: main.js is CommonJS. Use createRequire rather than ESM import so we
// get the actual `module.exports` value (a function with helper properties).
const require = createRequire(import.meta.url);
const handler = require('../../appwrite-functions/message-action/main.js') as any;

const serverParse: (raw: string | undefined) => Reaction[] =
  handler.parseReactions;
const serverStringify: (r: Reaction[]) => string = handler.stringifyReactions;
const serverApply: (
  r: Reaction[],
  emoji: string,
  userId: string,
  op: 'add' | 'remove'
) => Reaction[] = handler.applyReactionDelta;
const serverMakeRecipient: (senderMessageId: string) => string =
  handler.makeRecipientRowId;
const serverSha256: (input: string) => string = handler.sha256Hex;

// At least 3 shared fixture cases: empty, single emoji, multi-user multi-emoji
const FIXTURES: Reaction[][] = [
  [],
  [{ emoji: '👍', userIds: ['u1'] }],
  [
    { emoji: '👍', userIds: ['u1', 'u2'] },
    { emoji: '❤️', userIds: ['u3'] },
  ],
];

describe('client/server parity — parseReactions', () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`matches for fixture ${i}`, () => {
      const raw = FIXTURES[i].length === 0 ? '' : JSON.stringify(FIXTURES[i]);
      expect(serverParse(raw)).toEqual(clientParse(raw));
    });
  }
});

describe('client/server parity — stringifyReactions', () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`matches for fixture ${i}`, () => {
      expect(serverStringify(FIXTURES[i])).toBe(clientStringify(FIXTURES[i]));
    });
  }
});

describe('client/server parity — applyReactionDelta (add)', () => {
  it('add of a brand-new emoji matches', () => {
    const base: Reaction[] = [];
    expect(serverApply(base, '❤️', 'u1', 'add')).toEqual(
      clientApply(base, '❤️', 'u1', 'add')
    );
  });

  it('add of a second user to an existing emoji matches', () => {
    const base: Reaction[] = [{ emoji: '👍', userIds: ['u1'] }];
    expect(serverApply(base, '👍', 'u2', 'add')).toEqual(
      clientApply(base, '👍', 'u2', 'add')
    );
  });
});

describe('client/server parity — applyReactionDelta (remove)', () => {
  it('remove of one user matches', () => {
    const base: Reaction[] = [{ emoji: '👍', userIds: ['u1', 'u2'] }];
    expect(serverApply(base, '👍', 'u1', 'remove')).toEqual(
      clientApply(base, '👍', 'u1', 'remove')
    );
  });

  it('remove of the last user matches (entry is dropped)', () => {
    const base: Reaction[] = [
      { emoji: '👍', userIds: ['u1'] },
      { emoji: '❤️', userIds: ['u3'] },
    ];
    expect(serverApply(base, '👍', 'u1', 'remove')).toEqual(
      clientApply(base, '👍', 'u1', 'remove')
    );
  });
});

describe('client/server parity — makeRecipientRowId', () => {
  it('matches for a known message id', async () => {
    const messageId = 'msg_1700000000000_abcdefghi';
    const client = await clientMakeRecipient(messageId);
    const server = serverMakeRecipient(messageId);
    expect(server).toBe(client);
  });
});

describe('server-only helpers', () => {
  // sha256Hex is server-only; pin a well-known SHA-256 vector.
  it("sha256Hex('test') matches the well-known digest", () => {
    expect(serverSha256('test')).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    );
  });

  it('makeRecipientRowId matches /^rmsg_[a-f0-9]{30}$/', () => {
    expect(serverMakeRecipient('msg_x')).toMatch(/^rmsg_[a-f0-9]{30}$/);
  });
});
