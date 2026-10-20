/**
 * Build the real application and run the existing UI contract against mosaic-dev.
 * Local HTTP is loopback-only (a browser secure context); hosted HTTPS verification
 * stays enabled. The build/test children never receive management/admin credentials.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function child(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const process = spawn(command, args, { ...options, stdio: 'inherit' });
    process.once('error', () => reject(new Error('Hosted UI child could not start')));
    process.once('exit', code => code === 0 ? resolvePromise() :
      reject(new Error(`Hosted UI child exited ${code}`)));
  });
}

export async function exerciseHostedUi(client, accounts, origin) {
  if (origin !== 'https://hcxtiifzxoaflhjgoglb.supabase.co')
    throw new Error('Hosted UI requires isolated mosaic-dev');
  const keys = await client.requireOk(await client.management('/api-keys'), 'Public build key access');
  const publishableKey = keys.find(k => k.type === 'publishable')?.api_key;
  if (!publishableKey?.startsWith('sb_publishable_')) throw new Error('Public build key required');
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/SUPABASE|MOSAIC_SB|MOSAIC_CORE_HOSTED_FIXTURES|VERCEL_TOKEN/.test(key)) delete env[key];
  }
  Object.assign(env, {
    VITE_MOSAIC_BACKEND: 'supabase-cloud', VITE_MOSAIC_FEATURE_PROFILE: 'core-only',
    VITE_SUPABASE_URL: origin, VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  });
  await child('npm', ['run', 'build'], { cwd, env });
  const root = resolve(cwd, 'dist');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    try {
      const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      let data;
      let extension = path.slice(path.lastIndexOf('.'));
      try { data = await readFile(path); }
      catch {
        if (extension in mime) { res.writeHead(404).end(); return; }
        data = await readFile(resolve(root, 'index.html')); extension = '.html';
      }
      res.writeHead(200, { 'Content-Type': mime[extension] ?? 'application/octet-stream' }).end(data);
    } catch { res.writeHead(500).end(); }
  });
  const scratch = await mkdtemp(resolve(tmpdir(), 'mosaic-hosted-ui-'));
  try {
    await new Promise((resolvePromise, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolvePromise);
    });
    const config = {
      // Hosted Auth verification and replication need multiple network round
      // trips. Keep the same assertions with a bounded hosted-only deadline.
      testDir: resolve(cwd, 'tests/e2e'), workers: 1, expect: { timeout: 45_000 },
      outputDir: resolve(scratch, 'results'),
      use: { launchOptions: {
        ...(process.env.MOSAIC_E2E_CHROMIUM_PATH ? { executablePath: process.env.MOSAIC_E2E_CHROMIUM_PATH } : {}),
        ...(process.env.HTTPS_PROXY ? {
          proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' },
        } : {}),
      } },
    };
    await writeFile(resolve(scratch, 'config.mjs'), 'export default ' + JSON.stringify(config));
    await child(process.execPath, ['tests/e2e/node_modules/@playwright/test/cli.js', 'test',
      'supabase-core-app.spec.mjs', '--config', resolve(scratch, 'config.mjs'),
      '--grep', 'real Mosaic UI', '--reporter=line'], { cwd, env: {
      ...env, MOSAIC_SB_LOCAL_URL: origin, MOSAIC_SB_LOCAL_PUBLISHABLE_KEY: publishableKey,
      // Playwright 1.58 otherwise appends <-loopback> after explicit bypasses,
      // forcing this process's own static server through the outbound proxy.
      PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: '1',
      MOSAIC_CORE_APP_LAB: 'true', MOSAIC_CORE_HOSTED_LAB: 'true',
      MOSAIC_E2E_BASE_URL: `http://127.0.0.1:${server.address().port}`,
      MOSAIC_CORE_HOSTED_FIXTURES: JSON.stringify(accounts.map(({ email, password }) => ({ email, password }))),
    } });
  } finally {
    await new Promise(resolvePromise => server.close(resolvePromise));
    await rm(scratch, { recursive: true, force: true });
  }
}
