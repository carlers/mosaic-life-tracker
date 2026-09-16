#!/usr/bin/env node
import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  rmSync, cpSync, readdirSync, statSync,
} from 'fs';
import { dirname, join, resolve, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(__filename);
const BACKUP_ROOT = join(ROOT, '.mosaic-backup');
const DIRECTIVE_RE = /^===(FILE|DELETE|COMMIT):(.+)===$/;
const SELF_MOD_FILE = 'apply-changes.mjs';

function log(...a) {
  console.log(...a);
}

function fail(msg, code = 1) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(code);
}

function warnSelfModification(files) {
  const selfModifying = files.some((f) => f.path === SELF_MOD_FILE);
  if (!selfModifying) return;
  log('');
  log('⚠️  WARNING: this mega file modifies apply-changes.mjs itself.');
  log('    The currently-running process uses the OLD in-memory version for');
  log('    parse, backup, and verify. Subsequent applies will use the NEW version.');
  log('    If your change affects parse/backup/verify logic, re-run those steps');
  log('    after this apply completes.');
  log('');
}

function parseArgs(argv) {
  const flags = {
    file: 'pending-changes.txt',
    dryRun: false,
    noVerify: false,
    rollback: false,
    start: false,
    verbose: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--no-verify') flags.noVerify = true;
    else if (arg === '--rollback') flags.rollback = true;
    else if (arg === '--start') flags.start = true;
    else if (arg === '--verbose') flags.verbose = true;
    else if (arg.startsWith('--file=')) flags.file = arg.slice('--file='.length);
    else fail(`Unknown argument: ${arg}`);
  }
  return flags;
}

function parseMegaFile(content) {
  let text = content;
  const fenceMatch = text.match(/^(~~~+|`{3,})mosaic\s*\n([\s\S]*?)\n\1\s*$/);
  if (fenceMatch) text = fenceMatch[2];
  const lines = text.split(/\r?\n/);

  // Pass 1: mark lines that are inside a Markdown fence (backticks or tildes).
  // Fence-boundary lines are also marked true so they are never treated as
  // directives. This makes the directive examples inside documentation
  // code blocks inert — critical for AGENTS.md §5.1, which documents the
  // mega-file format by showing literal directive lines inside a fence.
  const insideFence = new Array(lines.length).fill(false);
  let fenceChar = null;
  let fenceLen = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(`{3,}|~{3,})/);
    if (m) {
      const ch = m[1][0];
      const len = m[1].length;
      if (fenceChar === null) {
        fenceChar = ch;
        fenceLen = len;
        insideFence[i] = true;
        continue;
      }
      if (ch === fenceChar && len >= fenceLen) {
        fenceChar = null;
        fenceLen = 0;
        insideFence[i] = true;
        continue;
      }
      insideFence[i] = true;
      continue;
    }
    insideFence[i] = fenceChar !== null;
  }

  const files = [], deletes = [];
  let commit = null, i = 0;
  while (i < lines.length) {
    if (insideFence[i]) { i++; continue; }
    const m = lines[i].match(DIRECTIVE_RE);
    if (!m) { i++; continue; }
    const [, type, value] = m;
    if (type === 'COMMIT') { commit = value.trim(); i++; continue; }
    if (type === 'DELETE') { deletes.push(value.trim()); i++; continue; }
    const path = value.trim();
    const contentLines = [];
    i++;
    while (i < lines.length) {
      if (!insideFence[i] && DIRECTIVE_RE.test(lines[i])) break;
      contentLines.push(lines[i]);
      i++;
    }
    files.push({ path, content: contentLines.join('\n') });
  }
  return { files, deletes, commit };
}

function validatePath(p) {
  if (!p) fail('Empty path in directive');
  if (p.startsWith('/')) fail(`Absolute path not allowed: ${p}`);
  if (p.includes('..')) fail(`Path traversal not allowed: ${p}`);
  const abs = resolve(ROOT, p);
  const rel = relative(ROOT, abs);
  if (rel.startsWith('..') || rel === '') fail(`Path escapes project root: ${p}`);
  return abs;
}

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function run(cmd) {
  log(`\n🔍 Running ${cmd}...`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    log(`  ✓ ${cmd} passed`);
    return true;
  } catch {
    log(`  ✗ ${cmd} failed`);
    return false;
  }
}

function findLatestBackup() {
  if (!existsSync(BACKUP_ROOT)) return null;
  return readdirSync(BACKUP_ROOT)
    .map((d) => join(BACKUP_ROOT, d))
    .filter((d) => {
      try { return statSync(d).isDirectory(); } catch { return false; }
    })
    .sort()
    .reverse()[0] || null;
}

function doRollback() {
  const latest = findLatestBackup();
  if (!latest) fail('No backups found');
  const manifestPath = join(latest, 'manifest.json');
  if (!existsSync(manifestPath)) fail(`No manifest in ${latest}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  log(`\n⏪ Rolling back from ${relative(ROOT, latest)}`);
  for (const p of manifest.created || []) {
    const abs = join(ROOT, p);
    if (existsSync(abs)) {
      rmSync(abs, { force: true });
      log(`  ✗ Removed ${p}`);
    }
  }
  for (const p of [...(manifest.modified || []), ...(manifest.deleted || [])]) {
    const src = join(latest, 'files', p);
    if (existsSync(src)) {
      const dest = join(ROOT, p);
      ensureDir(dest);
      cpSync(src, dest);
      log(`  ↺ Restored ${p}`);
    }
  }
  log('\n✅ Rollback complete\n');
  process.exit(0);
}

function suggestCommitFallback(files, deletes) {
  const paths = [...files.map((f) => f.path), ...deletes];
  const prefixes = new Set(paths.map((p) => p.split(sep).slice(0, 2).join('/')));
  if ([...prefixes].every((d) => d.startsWith('appwrite-functions/'))) return 'chore: appwrite function';
  if ([...prefixes].every((d) => d.startsWith('src/components/ui/'))) return 'ui: primitives';
  if ([...prefixes].every((d) => d.startsWith('src/lib/'))) return 'lib: utilities';
  if ([...prefixes].every((d) => d.startsWith('src/hooks/'))) return 'hooks: state';
  return `chore: apply ${files.length + deletes.length} file change(s)`;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.rollback) doRollback();

  const inputPath = resolve(ROOT, flags.file);
  if (!existsSync(inputPath)) fail(`Input file not found: ${flags.file}`);

  const { files, deletes, commit } = parseMegaFile(readFileSync(inputPath, 'utf8'));
  if (files.length === 0 && deletes.length === 0) fail('No directives found in input file');

  log(`\n📋 Parsed ${files.length} FILE, ${deletes.length} DELETE`);
  warnSelfModification(files);
  if (commit) log(`📝 Commit: ${commit}`);

  const planned = [];
  for (const f of files) {
    const abs = validatePath(f.path);
    planned.push({ kind: existsSync(abs) ? 'MODIFY' : 'CREATE', path: f.path, abs, content: f.content });
  }
  for (const p of deletes) {
    planned.push({ kind: 'DELETE', path: p, abs: validatePath(p) });
  }

  log('\nPlanned operations:');
  for (const p of planned) {
    const size = p.content ? ` (${formatBytes(Buffer.byteLength(p.content, 'utf8'))})` : '';
    log(`  ${p.kind.padEnd(7)} ${p.path}${size}`);
  }

  if (flags.dryRun) {
    log('\n🧪 Dry run — no files written.\n');
    process.exit(0);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(BACKUP_ROOT, timestamp);
  const backupFilesDir = join(backupDir, 'files');
  mkdirSync(backupFilesDir, { recursive: true });
  const manifest = { timestamp, created: [], modified: [], deleted: [], commit: commit || null };
  for (const p of planned) {
    if (p.kind === 'CREATE') { manifest.created.push(p.path); continue; }
    if (existsSync(p.abs)) {
      const dest = join(backupFilesDir, p.path);
      ensureDir(dest);
      cpSync(p.abs, dest);
      (p.kind === 'MODIFY' ? manifest.modified : manifest.deleted).push(p.path);
    }
  }
  writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log(`\n💾 Backup: ${relative(ROOT, backupDir)}`);

  log('\n✍️  Writing files...');
  for (const p of planned) {
    if (p.kind === 'DELETE') {
      if (existsSync(p.abs)) {
        rmSync(p.abs, { force: true });
        log(`  ✓ Deleted ${p.path}`);
      } else {
        log(`  · Skipped (not found) ${p.path}`);
      }
    } else {
      ensureDir(p.abs);
      let body = p.content;
      if (!body.endsWith('\n')) body += '\n';
      writeFileSync(p.abs, body, 'utf8');
      log(`  ✓ ${p.kind === 'CREATE' ? 'Created' : 'Updated'} ${p.path}`);
    }
  }

  if (!flags.noVerify) {
    if (!run('npm run lint')) fail('Lint failed. Run `npm run apply:rollback` to restore.');
    if (!run('npm test')) fail('Tests failed. Run `npm run apply:rollback` to restore.');
    if (!run('npm run build')) fail('Build failed. Run `npm run apply:rollback` to restore.');
  }

  const commitMsg = commit || suggestCommitFallback(files, deletes);
  log(`\n✅ ${files.length} file(s) applied, ${deletes.length} deleted.${flags.noVerify ? '' : ' Verified.'}`);
  log(`\n📝 Suggested commit:\n   ${commitMsg}`);
  log(`\n💡 git add -A && git commit -m "${commitMsg}"`);
  log(`\n↩️  To rollback: npm run apply:rollback\n`);

  if (flags.start) {
    log('🚀 Starting dev server...\n');
    const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: ROOT });
    child.on('exit', (code) => process.exit(code || 0));
  }
}

main();
