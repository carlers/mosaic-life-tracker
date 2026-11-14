import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { TRUSTED_HIGH_LEVEL_CONFIG_SHA256 } from '../../scripts/lib/prebuilt-candidate-payload.mjs';
import { PREBUILT_ROUTING_SHA256 } from '../../scripts/lib/prebuilt-receiver-gate.mjs';
import { readFileSync } from 'node:fs';
import { preparePreviewRoutes } from '../../scripts/lib/preview-build-routes.mjs';
import { BRAVE_SPEECH_GUIDANCE, detectBraveBrowser, speechRecognitionErrorMessage } from '../../src/hooks/useBrowserSpeechInput';

const expected = 'camera=(), microphone=(self), geolocation=()';
const json = (path: string) => JSON.parse(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'));

describe('speech and trusted deployment permission policy', () => {
  it('enables only same-origin microphone access in both Vercel configs', () => {
    for (const path of ['vercel.json', 'scripts/lib/trusted-prebuilt-vercel.json']) {
      const cfg = json(path);
      const directives = cfg.headers[0].headers.filter((h: {key: string}) => h.key === 'Permissions-Policy');
      expect(directives).toHaveLength(1);
      expect(directives[0].value).toBe(expected);
      expect(directives[0].value).not.toContain('microphone=()');
      expect(directives[0].value).toContain('camera=()');
      expect(directives[0].value).toContain('geolocation=()');
    }
  });

  it('preserves microphone policy through trusted prebuilt routing and fixture', () => {
    const file = readFileSync(new URL('../../vercel.json', import.meta.url));
    const output = preparePreviewRoutes(JSON.parse(file.toString('utf8')), file);
    const route = output.config.routes.find((r: {headers?: Record<string,string>}) =>
      r.headers?.['Permissions-Policy']);
    expect(route?.headers?.['Permissions-Policy']).toBe(expected);
    const fixture = json('tests/fixtures/trusted-preview-routes-v3.json');
    expect(fixture.routes[0].headers['Permissions-Policy']).toBe(expected);
  });

  it('matches both exact trusted SHA-256 pins rather than disabling integrity gates', () => {
    const digest = (input: Buffer) => createHash('sha256').update(input).digest('hex');
    const highLevel = readFileSync(new URL('../../scripts/lib/trusted-prebuilt-vercel.json', import.meta.url));
    const routes = readFileSync(new URL('../fixtures/trusted-preview-routes-v3.json', import.meta.url));
    expect(digest(highLevel)).toBe(TRUSTED_HIGH_LEVEL_CONFIG_SHA256);
    expect(digest(routes)).toBe(PREBUILT_ROUTING_SHA256);
  });

  it('recognizes Brave using its official asynchronous browser API, not Chrome-like UA', async () => {
    const yes = { brave: { isBrave: async () => true } } as unknown as Navigator;
    const no = { brave: { isBrave: async () => false } } as unknown as Navigator;
    const unavailable = {} as Navigator;
    const failure = { brave: { isBrave: async () => { throw new Error('not available'); } } } as unknown as Navigator;
    expect(await detectBraveBrowser(yes)).toBe(true);
    expect(await detectBraveBrowser(no)).toBe(false);
    expect(await detectBraveBrowser(unavailable)).toBe(false);
    expect(await detectBraveBrowser(failure)).toBe(false);
  });

  it('treats Brave recognition network failures as provider incompatibility, not offline internet', () => {
    expect(speechRecognitionErrorMessage('network', true)).toBe(BRAVE_SPEECH_GUIDANCE);
    expect(speechRecognitionErrorMessage('service-not-allowed', true)).toBe(BRAVE_SPEECH_GUIDANCE);
    expect(speechRecognitionErrorMessage('network', true)).not.toMatch(/check internet/i);
    expect(speechRecognitionErrorMessage('network', false)).toMatch(/provider/i);
    expect(speechRecognitionErrorMessage('not-allowed', true)).toMatch(/Microphone access is blocked/i);
  });

  it('distinguishes microphone denial from browser speech service rejection', () => {
    expect(speechRecognitionErrorMessage('not-allowed')).toMatch(/Microphone access is blocked/);
    expect(speechRecognitionErrorMessage('service-not-allowed')).toMatch(/browser did not allow its speech-recognition service/);
    expect(speechRecognitionErrorMessage('service-not-allowed')).not.toMatch(/Microphone access is blocked/);
    expect(speechRecognitionErrorMessage('network')).toMatch(/internet access/);
  });
});
