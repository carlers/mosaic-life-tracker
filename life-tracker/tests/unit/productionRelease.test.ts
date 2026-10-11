import { describe, expect, it } from 'vitest';
import {
  assertProductionEvidence, decidePublication, extractReleaseNotes,
  parseProductionBuild, releaseTag, isNewProductionVersion, PRODUCTION_DOMAIN, VERCEL_STATUS_PREFIX,
} from '../../scripts/lib/production-release.mjs';

const sha = '95c8b25edeba5e2730252f6d265d392949890caa';
const good = {
  build: { commit: sha, branch: 'main', channel: 'Production' },
  sha,
  statuses: [{ context: 'Vercel', state: 'success', target_url: VERCEL_STATUS_PREFIX + 'example' }],
};

describe('production release publication safeguards', () => {
  it('extracts only human-facing notes from production PRs, including the first release', () => {
    const pr = '## Production release\n### User-facing changes since v0.6.2\n- Better navigation and release history\n- Improve tasks for users\n\n### Evidence and safety\n- private CI detail';
    expect(extractReleaseNotes(pr)).toBe('- Better navigation and release history\n- Improve tasks for users');
    expect(extractReleaseNotes('## User-facing release notes\n- Add everyday feature for users\n')).toContain('everyday');
    for (const invalid of ['no notes', '## User-facing release notes\n- TODO', '## User-facing release notes\n- a', '## User-facing release notes\n- ' + 'x'.repeat(8001)]) {
      expect(() => extractReleaseNotes(invalid)).toThrow();
    }
  });

  it('reads escaped production build meta and checks deployed commit/channel and Vercel status', () => {
    const html = '<html><meta name="mosaic-build-info" content="{&quot;commit&quot;:&quot;' +
      sha + '&quot;,&quot;branch&quot;:&quot;main&quot;,&quot;channel&quot;:&quot;Production&quot;}"></html>';
    expect(parseProductionBuild(html)).toEqual(good.build);
    expect(() => assertProductionEvidence(good)).not.toThrow();
    expect(PRODUCTION_DOMAIN).toContain('mosaic-life-tracker');
    expect(() => assertProductionEvidence({ ...good, build: { ...good.build, channel: 'Preview' } })).toThrow();
    expect(() => assertProductionEvidence({ ...good, build: { ...good.build, commit: 'other' } })).toThrow();
    expect(() => assertProductionEvidence({ ...good, statuses: [{ context: 'Vercel', state: 'success', target_url: 'https://unrelated.example/' }] })).toThrow();
    expect(() => assertProductionEvidence({ ...good, statuses: [{ context: 'Vercel', state: 'pending', target_url: VERCEL_STATUS_PREFIX }] })).toThrow();
    expect(() => parseProductionBuild('<html>no metadata</html>')).toThrow();
  });

  it('never repoints tags, reuses existing releases, rejects old versions and moved main', () => {
    const base = { version: '0.12.1', priorVersion: '0.6.2', mainSha: sha, currentSha: sha, taggedSha: null, existingRelease: null };
    expect(releaseTag('0.12.1')).toBe('v0.12.1');
    expect(isNewProductionVersion('0.12.1', '0.6.2')).toBe(true);
    expect(isNewProductionVersion('0.12.1', '0.12.1')).toBe(false);
    expect(isNewProductionVersion('0.12.1', '0.13.0')).toBe(false);
    expect(decidePublication(base)).toBe('publish');
    expect(decidePublication({ ...base, taggedSha: sha })).toBe('publish');
    expect(decidePublication({ ...base, taggedSha: sha, existingRelease: { tag_name: 'v0.12.1', draft: false, prerelease: false, published_at: '2026-10-11T00:00:00Z' } })).toBe('already-published');
    expect(() => decidePublication({ ...base, taggedSha: 'other' })).toThrow();
    expect(() => decidePublication({ ...base, mainSha: 'other' })).toThrow();
    expect(() => decidePublication({ ...base, priorVersion: '0.12.1' })).toThrow();
    expect(() => decidePublication({ ...base, version: '0.5.0' })).toThrow();
    expect(() => decidePublication({ ...base, version: '0.12.1-rc.1' })).toThrow();
  });
});
