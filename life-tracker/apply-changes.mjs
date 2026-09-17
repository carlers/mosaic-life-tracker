import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const PENDING = path.join(ROOT, 'pending-changes.txt');
const BACKUP_ROOT = path.join(ROOT, '.mosaic-backup');

const clipboardBuffer = [];
const origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  clipboardBuffer.push(typeof chunk === 'string' ? chunk : chunk.toString());
  return origWrite(chunk, encoding, callback);
};

function log(...a) {
  console.log(...a);
}

function fail(msg, code = 1) {
  console.error(`\n✖ ${msg}\n`);
  copyToClipboardSafe();
  process.exit(code);
}

function warnSelfModification(files) {
  const self = 'apply-changes.mjs';
  if (files.includes(self)) {
    log(`⚠ ${self} is being modified by this patch.`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    noVerify: args.includes('--no-verify'),
    start: args.includes('--start'),
    rollback: args.includes('--rollback'),
    commit: args.includes('--commit'),
    noCommit: args.includes('--no-commit'),
  };
}

function parseMegaFile(content) {
  const outerRegex = /^(~~~+|`{3,})mosaic\s*\n([\s\S]*?)\n\1\s*$/;
  const match = content.match(outerRegex);
  if (!match) {
    throw new Error('No mosaic block found. Outer fence must be exactly five tildes + mosaic.');
  }
  const body = match[2];

  const lines = body.split('\n');
  const insideFence = new Array(lines.length).fill(false);
  let fenceChar = null;
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/^(`{3,}|~{3,})\s*$/);
    if (m) {
      const run = m[1];
      const ch = run[0];
      const len = run.length;
      if (fenceChar === null) {
        fenceChar = ch;
        fenceLen = len;
        insideFence[i] = true;
        continue;
      }
      if (ch === fenceChar && len >= fenceLen) {
        insideFence[i] = true;
        fenceChar = null;
        fenceLen = 0;
        continue;
      }
    }
    if (fenceChar !== null) {
      insideFence[i] = true;
    }
  }

  const files = [];
  const deletes = [];
  let commit = null;
  let currentFile = null;
  let currentLines = [];

  const flush = () => {
    if (currentFile) {
      files.push({ path: currentFile, content: currentLines.join('\n') });
      currentFile = null;
      currentLines = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    if (insideFence[i]) {
      if (currentFile) currentLines.push(lines[i]);
      continue;
    }
    const line = lines[i];

    // Defensive: strip a stray `mosaic`-opener line that Chat 2 sometimes
    // copies from the §5.1 shape illustration. The literal `mosaic`
    // appears exactly once in a well-formed mega file; a bare line here
    // is a bug in the emitter.
    if (/^(~~~+|`{3,})mosaic\s*$/.test(line) || line.trim() === 'mosaic') {
      log(`⚠ Ignoring stray mosaic opener inside body (line ${i + 1}).`);
      continue;
    }

    if (line.startsWith('===FILE:')) {
      flush();
      const p = line.slice('===FILE:'.length).replace(/===\s*$/, '').trim();
      validatePath(p);
      currentFile = p;
    } else if (line.startsWith('===DELETE:')) {
      flush();
      const p = line.slice('===DELETE:'.length).replace(/===\s*$/, '').trim();
      validatePath(p);
      deletes.push(p);
    } else if (line.startsWith('===COMMIT:')) {
      flush();
      commit = line.slice('===COMMIT:'.length).replace(/===\s*$/, '').trim();
    } else if (currentFile) {
      currentLines.push(line);
    }
  }
  flush();

  return { files, deletes, commit };
}

function validatePath(p) {
  if (!p || p.includes('..') || path.isAbsolute(p)) {
    throw new Error(`Invalid path in directive: ${p}`);
  }
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function run(cmd) {
  return new Promise((resolve) => {
    const child = spawnSync(cmd, { shell: true, stdio: 'inherit' });
    resolve(child.status === 0);
  });
}

function findLatestBackup() {
  if (!fs.existsSync(BACKUP_ROOT)) return null;
  const dirs = fs
    .readdirSync(BACKUP_ROOT)
    .map((d) => path.join(BACKUP_ROOT, d))
    .filter((d) => fs.statSync(d).isDirectory())
    .sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

function doRollback() {
  const latest = findLatestBackup();
  if (!latest) fail('No backup found.');
  log(`Restoring from ${latest} ...`);
  const entries = fs.readdirSync(latest, { withFileTypes: true });
  for (const e of entries) {
    const src = path.join(latest, e.name);
    const dst = path.join(ROOT, e.name);
    if (e.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else {
      ensureDir(dst);
      fs.copyFileSync(src, dst);
    }
  }
  log('✔ Rollback complete.');
}

function suggestCommitFallback(files, deletes) {
  const paths = [...files.map((f) => f.path), ...deletes];
  if (paths.every((p) => p.endsWith('.md'))) return 'docs: update documentation';
  if (paths.some((p) => p.startsWith('src/'))) return 'chore: refactor and update source';
  return 'chore: apply changes';
}

function truncateCommit(msg, max = 72) {
  if (!msg) return msg;
  return msg.length <= max ? msg : msg.slice(0, max - 1) + '…';
}

function copyToClipboardSafe() {
  const text = clipboardBuffer.join('');
  if (!text.trim()) return;
  try {
    const platform = process.platform;
    const cmd =
      platform === 'darwin'
        ? 'pbcopy'
        : platform === 'win32'
          ? 'clip'
          : 'wl-copy';
    const res = spawnSync(cmd, { input: text, shell: true });
    if (res.status === 0) return;
    const alt = spawnSync('xclip -selection clipboard', { input: text, shell: true });
    if (alt.status === 0) return;
    const alt2 = spawnSync('xsel --clipboard --input', { input: text, shell: true });
    if (alt2.status === 0) return;
  } catch {
    // fall through
  }
  origWrite('\n(clipboard copy unavailable — output printed above)\n');
}

function isTTY() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function promptYesNo(question) {
  const answer = spawnSync(
    'sh',
    ['-c', `printf '%s ' "${question}"; read ans; printf '%s' "$ans"`],
    { stdio: ['inherit', 'pipe', 'inherit'] }
  );
  const raw = (answer.stdout || '').toString().trim().toLowerCase();
  return raw === '' || raw === 'y' || raw === 'yes';
}

function gitCommit(commitMsg, paths) {
  if (paths.length === 0) {
    log('⚠ No touched paths to commit.');
    return false;
  }
  const quoted = paths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ');
  try {
    execSync(`git add -- ${quoted}`, { stdio: 'inherit' });
    execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { stdio: 'inherit' });
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    log(`✔ Committed ${hash}: ${commitMsg}`);
    return true;
  } catch {
    log('✖ git commit failed. Files are written; fix the hook/error and commit manually.');
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.rollback) {
    doRollback();
    copyToClipboardSafe();
    return;
  }

  if (!fs.existsSync(PENDING)) {
    fail('pending-changes.txt not found in project root.');
  }

  const raw = fs.readFileSync(PENDING, 'utf8');
  let parsed;
  try {
    parsed = parseMegaFile(raw);
  } catch (err) {
    fail(`Parse error: ${err.message}`);
  }

  const { files, deletes, commit } = parsed;
  const commitMsg = truncateCommit(
    commit || suggestCommitFallback(files, deletes)
  );

  log(`Parsed ${files.length} file(s), ${deletes.length} delete(s).`);
  if (commit) log(`Commit: ${commitMsg}`);

  warnSelfModification(files.map((f) => f.path));

  if (args.dryRun) {
    log('Dry run — no writes.');
    for (const f of files) log(`  would write ${f.path} (${formatBytes(f.content.length)})`);
    for (const d of deletes) log(`  would delete ${d}`);
    copyToClipboardSafe();
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUP_ROOT, timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const touchedPaths = [];

  for (const f of files) {
    const abs = path.join(ROOT, f.path);
    if (fs.existsSync(abs)) {
      const backupPath = path.join(backupDir, f.path);
      ensureDir(backupPath);
      fs.copyFileSync(abs, backupPath);
    }
    ensureDir(abs);
    fs.writeFileSync(abs, f.content, 'utf8');
    touchedPaths.push(f.path);
    log(`  wrote ${f.path}`);
  }

  for (const d of deletes) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs)) {
      const backupPath = path.join(backupDir, d);
      ensureDir(backupPath);
      fs.copyFileSync(abs, backupPath);
      fs.unlinkSync(abs);
      touchedPaths.push(d);
      log(`  deleted ${d}`);
    }
  }

  if (args.noVerify) {
    log('\n✔ Wrote files (verification skipped).');
    copyToClipboardSafe();
    return;
  }

  const lintOk = await run('npm run lint');
  if (!lintOk) fail('Lint failed. Run `npm run apply:rollback` to revert.');

  const testOk = await run('npm test');
  if (!testOk) fail('Tests failed. Run `npm run apply:rollback` to revert.');

  const buildOk = await run('npm run build');
  if (!buildOk) fail('Build failed. Run `npm run apply:rollback` to revert.');

  log('\n✔ Lint, test, and build all green.');

  if (args.noCommit) {
    log('(--no-commit) Skipping commit prompt.');
    copyToClipboardSafe();
    return;
  }

  if (args.commit) {
    gitCommit(commitMsg, touchedPaths);
    copyToClipboardSafe();
    return;
  }

  if (!isTTY()) {
    const quoted = touchedPaths.map((p) => `'${p}'`).join(' ');
    log('\nNot a TTY — copy-paste to commit:');
    log(`  git add -- ${quoted} && git commit -m ${JSON.stringify(commitMsg)}`);
    copyToClipboardSafe();
    return;
  }

  const shouldCommit = promptYesNo(`\nCommit these changes? [Y/n]`);
  if (shouldCommit) {
    gitCommit(commitMsg, touchedPaths);
  } else {
    log('Skipped commit.');
  }

  copyToClipboardSafe();

  if (args.start) {
    log('\nStarting dev server...');
    await run('npm run dev');
  }
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
});
