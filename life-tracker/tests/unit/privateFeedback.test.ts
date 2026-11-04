import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../src/lib/appAction', () => ({ sendAppAction: mocks.send }));
import { submitPrivateFeedback } from '../../src/lib/privateFeedback';

const id = 'a'.repeat(32);
beforeEach(() => {
  mocks.send.mockReset().mockResolvedValue({ reportId: 'bug_' + 'b'.repeat(32) });
});

describe('private general feedback', () => {
  it('routes suggestions to private storage with no public consent or automatic diagnostics', async () => {
    const result = await submitPrivateFeedback('idea', '  Improve the calendar  ', id);
    expect(result.reference).toMatch(/^bug_[a-f0-9]{32}$/);
    expect(mocks.send).toHaveBeenCalledWith({
      action: 'submit_feedback', requestId: id, kind: 'idea',
      message: 'Improve the calendar',
    });
    expect(JSON.stringify(mocks.send.mock.calls)).not.toMatch(/publish_bug_report|publicConsent|github/);
  });

  it('attaches only explicitly requested bounded diagnostics', async () => {
    await submitPrivateFeedback('experience', 'Navigation is confusing', id, { os: 'Android' });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'experience', diagnostics: { os: 'Android' },
    }));
  });

  it('rejects invalid content before sending and refuses ambiguous confirmations', async () => {
    for (const [kind, message, reference] of [
      ['idea', ' ', id],
      ['other', 'x'.repeat(3001), id],
      ['other', 'valid', 'bad'],
      ['invalid', 'valid', id],
    ] as const) {
      await expect(submitPrivateFeedback(kind as 'idea', message, reference)).rejects.toThrow('Invalid feedback');
    }
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.send.mockResolvedValueOnce({});
    await expect(submitPrivateFeedback('other', 'Valid', id)).rejects.toThrow('confirmation');
  });
});
