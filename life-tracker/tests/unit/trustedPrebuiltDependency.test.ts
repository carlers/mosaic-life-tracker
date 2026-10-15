import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const allowed = new Set([
  'run-trusted-prebuilt-receiver.mjs',
  'lib/prebuilt-github-admission.mjs',
  'lib/prebuilt-receiver-gate.mjs',
  'lib/prebuilt-zip-artifact.mjs',
  'lib/prebuilt-candidate-payload.mjs',
  'lib/preview-artifact-trust.mjs',
  'lib/preview-evidence-schema.mjs',
  'lib/preview-deploy-gate.mjs',
]);
describe('trusted prebuilt receiver dependency boundary (#592)', () => {
  it('imports only reviewed pure Node modules, never app build code or package dependencies', async () => {
    const root = resolve(process.cwd(), 'scripts');
    for (const name of allowed) {
      const text = await readFile(resolve(root, name), 'utf8');
      const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
      for (const imp of imports) {
        if (imp.startsWith('node:')) continue;
        expect(imp.startsWith('./'), name + ': ' + imp).toBe(true);
        const file = resolve(dirname(resolve(root, name)), imp);
        const relative = file.slice(root.length + 1).replaceAll('\\', '/');
        expect(allowed.has(relative), name + ': ' + relative).toBe(true);
      }
      expect(text).not.toMatch(/npm\s+(?:install|ci)|vercel\s+deploy|eval\s*\(/);
    }
  });
  it('main receiver remains intentionally read-only until protected canary approval', async () => {
    const path = resolve(process.cwd(), 'scripts', 'run-trusted-prebuilt-receiver.mjs');
    const text = await readFile(path, 'utf8');
    expect(text).toContain('loadAcceptedArtifact');
    expect(text).toContain('prebuilt-github-admission.mjs');
    expect(text).toContain("MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED === 'true'");
    expect(text).not.toContain("method: 'POST'");
    expect(text).not.toContain('VERCEL_TOKEN');
  });
});
