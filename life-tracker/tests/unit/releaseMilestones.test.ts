import { describe, expect, it } from 'vitest';
import { formatVersionMilestones, normalizeMilestone } from '../../scripts/lib/release-milestones.mjs';
import { splitReleaseMilestones } from '../../src/lib/releaseHistory';

const sha = 'a'.repeat(40);
const candidate = {
  sha, subject: 'merge(dev): v0.16.5 — Improve sticker library behavior (#489)',
  sourceVersion: '0.16.5',
  body: '- Make static stickers easier to find\n- Vercel build budget repair\n- Restore quoted sticker thumbnails',
};

describe('verified production milestone notes', () => {
  it('uses only versions backed by matching source trees and shipped version bounds', () => {
    const entry = normalizeMilestone(candidate, '0.12.2', '0.16.6');
    expect(entry).toMatchObject({
      tag: 'v0.16.5', title: 'Improve sticker library behavior',
      notes: '- Make static stickers easier to find\n- Restore quoted sticker thumbnails',
    });
    expect(normalizeMilestone({ ...candidate, sourceVersion: '0.16.4' }, '0.12.2', '0.16.6')).toBeNull();
    expect(normalizeMilestone(candidate, '0.16.5', '0.16.6')).toBeNull();
    expect(normalizeMilestone(candidate, '0.12.2', '0.15.0')).toBeNull();
    expect(normalizeMilestone({ ...candidate, sha: 'invalid' }, '0.12.2', '0.16.6')).toBeNull();
  });

  it('round trips human-facing notes through the GitHub Release Markdown section', () => {
    const entry = normalizeMilestone(candidate, '0.12.2', '0.16.6');
    const section = formatVersionMilestones([entry]);
    const combined = '- **Aggregate release change**\n\n' + section;
    expect(splitReleaseMilestones(combined, 'v0.16.6')).toEqual({
      notes: '- **Aggregate release change**',
      milestones: [entry],
    });
    expect(formatVersionMilestones([])).toBe('');
  });
});
