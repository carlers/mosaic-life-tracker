import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { preparePreviewRoutes } from '../../scripts/lib/preview-build-routes.mjs';
import { speechRecognitionErrorMessage } from '../../src/hooks/useBrowserSpeechInput';

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

  it('distinguishes microphone denial from browser speech service rejection', () => {
    expect(speechRecognitionErrorMessage('not-allowed')).toMatch(/Microphone access is blocked/);
    expect(speechRecognitionErrorMessage('service-not-allowed')).toMatch(/browser did not allow its speech-recognition service/);
    expect(speechRecognitionErrorMessage('service-not-allowed')).not.toMatch(/Microphone access is blocked/);
    expect(speechRecognitionErrorMessage('network')).toMatch(/internet access/);
  });
});
