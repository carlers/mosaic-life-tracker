import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const overlay = 'f24ddc175dca6c1c518624e408be8cfc9793ae96';
const repo = 'carlers/mosaic-life-tracker';
const root = process.cwd();
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error(command + ' exited ' + result.status);
};
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (process.env.VERCEL_ENV && !process.env.VERCEL_GIT_COMMIT_SHA) throw new Error('Missing Vercel Git source SHA');
const mainSha = process.env.VERCEL_GIT_COMMIT_SHA || git('rev-parse', 'HEAD');
const isSha = /^[a-f0-9]{40}$/;
if (!isSha.test(mainSha)) throw new Error('Invalid main source SHA');
if (process.env.VERCEL_GIT_COMMIT_SHA && process.env.VERCEL_GIT_COMMIT_SHA !== mainSha) {
  throw new Error('Source checkout does not match Vercel Git commit');
}
if (process.env.VERCEL_GIT_COMMIT_REF && process.env.VERCEL_GIT_COMMIT_REF !== 'main') {
  throw new Error('MOSAIC_DEMO_ONLY_MAIN_ALLOWED');
}
console.log('MOSAIC_DEMO_MAIN_SOURCE=' + mainSha);

// Gate the demo against the actual released branch and successful canonical CI.
// Public read-only GitHub APIs, without tokens or new production app workflows.
async function api(path) {
  const response = await fetch('https://api.github.com/repos/' + repo + path, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Mosaic-main-demo-build' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('GitHub gate HTTP ' + response.status);
  return response.json();
}
async function gate() {
  for (let attempt = 0; attempt < 16; attempt++) {
    const ref = await api('/git/ref/heads/main');
    if (ref.object?.sha !== mainSha) throw new Error('Main has advanced; reject stale demo build');
    const runs = await api('/actions/workflows/quality-gate.yml/runs?head_sha=' + mainSha + '&branch=main&event=push&per_page=5');
    const latest = runs.workflow_runs?.filter(run => run.name === 'Quality Gate' &&
      run.head_branch === 'main' && run.head_sha === mainSha && run.event === 'push')
      .sort((a, b) => b.id - a.id)[0];
    if (latest?.status === 'completed' && latest.conclusion !== 'success') {
      throw new Error('Latest main Quality Gate failed: ' + latest.id);
    }
    if (latest?.status === 'completed' && latest.conclusion === 'success') {
      const jobs = await api('/actions/runs/' + latest.id + '/jobs?per_page=100');
      const accepted = jobs.jobs?.some(job => job.name === 'canonical-acceptance' &&
        job.status === 'completed' && job.conclusion === 'success');
      if (accepted) {
        console.log('MOSAIC_DEMO_CANONICAL_MAIN_PASS=' + latest.id);
        return;
      }
      throw new Error('Main canonical-acceptance did not succeed: ' + latest.id);
    }
    if (attempt === 15) throw new Error('Main canonical CI not complete');
    console.log('Waiting for exact main canonical acceptance: ' + (latest?.status ?? 'missing'));
    await new Promise(ok => setTimeout(ok, 60000));
  }
}
await gate();

// Import only the immutable, reviewed demo adapter; never import dev app UI.
// Vercel's source checkout may have no .git/origin remote, so use a pinned
// GitHub immutable commit archive, never a moving dev branch.
const adapterArchive = resolve(root, 'mosaic-demo-adapter.tar.gz');
const adapterDir = resolve(root, '.mosaic-demo-adapter');
run('curl', ['--fail', '--location', '--silent', '--show-error', '--output',
  adapterArchive, 'https://codeload.github.com/carlers/mosaic-life-tracker/tar.gz/' + overlay]);
mkdirSync(adapterDir, { recursive: true });
run('tar', ['-xzf', adapterArchive, '-C', adapterDir, '--strip-components=1']);
const paths = ['landing', 'life-tracker/demo', 'life-tracker/src/demo', 'life-tracker/vite.demo.config.ts'];
for (const path of paths) {
  if (!existsSync(resolve(adapterDir, path))) throw new Error('Missing pinned adapter: ' + path);
  if (existsSync(resolve(root, path)) && process.env.VERCEL_ENV) {
    throw new Error('Released main now owns demo adapter path; fail closed: ' + path);
  }
  mkdirSync(dirname(resolve(root, path)), { recursive: true });
  cpSync(resolve(adapterDir, path), resolve(root, path), { recursive: true, force: true });
}
rmSync(adapterDir, { recursive: true, force: true });
rmSync(adapterArchive, { force: true });

function replace(path, before, after) {
  const full = resolve(root, path), text = readFileSync(full, 'utf8');
  if (text.includes(after)) return;
  if (!text.includes(before)) throw new Error('Incompatible released main UI: ' + path);
  writeFileSync(full, text.replace(before, after));
}
replace('life-tracker/src/App.tsx', '<BrowserRouter>',
  '<BrowserRouter basename={import.meta.env.VITE_PUBLIC_DEMO ? "/demo" : undefined}>');
replace('life-tracker/src/lib/messageComposer.ts',
  '  await db.messages.insert(newMsg);\n  deliverPendingMessages(userId).catch(',
  '  await db.messages.insert(newMsg);\n  if (import.meta.env.VITE_PUBLIC_DEMO) {\n    const row = await db.messages.findOne(localId).exec();\n    await row?.patch({ deliveryStatus: "delivered", isUnsent: false });\n    return;\n  }\n  deliverPendingMessages(userId).catch(');
replace('life-tracker/src/components/messages/MessageBubble.tsx',
  '<span>Delivered</span>',
  '<span>{import.meta.env.VITE_PUBLIC_DEMO ? "Saved in demo only" : "Delivered"}</span>');
const pkgPath = resolve(root, 'life-tracker/package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.scripts['build:demo'] = 'VITE_PUBLIC_DEMO=1 tsc -b && VITE_PUBLIC_DEMO=1 vite build -c vite.demo.config.ts';
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: resolve(root, 'life-tracker') });
run('npm', ['run', 'build:demo'], { cwd: resolve(root, 'life-tracker') });
run('node', ['landing/test-site.mjs']);
run('node', ['landing/test-demo.mjs']);

// Emit Vercel Build Output API: copy a strict allowlist, not source/test files.
const staticDir = resolve(root, '.vercel/output/static');
rmSync(resolve(root, '.vercel/output'), { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
for (const name of ['index.html', 'styles.css', 'apple-touch-icon.png', 'favicon.svg', 'robots.txt', 'demo-loader.js']) {
  copyFileSync(resolve(root, 'landing', name), resolve(staticDir, name));
}
cpSync(resolve(root, 'landing/demo'), resolve(staticDir, 'demo'), { recursive: true });
const vercel = JSON.parse(readFileSync(resolve(root, 'landing/vercel.json'), 'utf8'));
const bySource = key => vercel.headers.find(item => item.source === key)?.headers ?? [];
const asObject = headers => Object.fromEntries(headers.map(item => [item.key, item.value]));
const common = asObject(bySource('/(.*)'));
const landing = asObject(bySource('/'));
const demo = asObject(bySource('/demo/(.*)'));
if (!landing['Content-Security-Policy']?.includes("connect-src 'none'") ||
    !demo['Content-Security-Policy']?.includes("connect-src 'none'") ||
    !demo['Content-Security-Policy']?.includes("frame-ancestors 'self'")) {
  throw new Error('Landing/demo network isolation CSP is missing');
}
const routes = [
  { src: '^/.*$', headers: common, continue: true },
  { src: '^/$', headers: landing, continue: true },
  { src: '^/demo(?:/.*)?$', headers: demo, continue: true },
  { handle: 'filesystem' },
  { src: '^/demo(?:/.*)?$', dest: '/demo/index.html' },
  { src: '^/$', dest: '/index.html' },
];
writeFileSync(resolve(root, '.vercel/output/config.json'), JSON.stringify({ version: 3, routes }, null, 2) + '\n');
console.log('MOSAIC_DEMO_MAIN_BUILD_OUTPUT_PASS=' + mainSha);

