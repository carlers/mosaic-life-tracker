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
const SELF_NAME = 'apply-changes.mjs';
const CLIPBOARD_MARKER =
  '[ apply-changes.mjs output - do not paste into pending-changes.txt ]\n';

const clipboardBuffer = [];
const origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  clipboardBuffer.push(typeof chunk === 'string' ? chunk : chunk.toString());
  return origWrite(chunk, encoding, callback);
};

function log(...a) {
  console.log(...a);
}

function fail(msg, code = 1, hints = []) {
  console.error('');
  console.error('FAIL: ' + msg);
  console.error('');
  if (hints && hints.length) {
    console.error('How to fix:');
    for (const h of hints) console.error('  - ' + h);
    console.error('');
  }
  copyToClipboardSafe();
  process.exit(code);
}

function warnSelfModification(files) {
  if (files.includes(SELF_NAME)) {
    log('WARN: ' + SELF_NAME + ' is being modified by this patch.');
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const fromFileIdx = args.indexOf('--from-file');
  return {
    dryRun: args.includes('--dry-run'),
    noVerify: args.includes('--no-verify'),
    start: args.includes('--start'),
    rollback: args.includes('--rollback'),
    commit: args.includes('--commit'),
    noCommit: args.includes('--no-commit'),
    fromStdin: args.includes('--stdin'),
    fromFile:
      fromFileIdx >= 0 && args[fromFileIdx + 1] ? args[fromFileIdx + 1] : null,
    help: args.includes('--help') || args.includes('-h'),
  };
}

function normalizeInput(raw) {
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.replace(/\r\n?/g, '\n');
  return s;
}

const DIRECTIVE_PREFIXES = ['FIL' + 'E:', 'DELET' + 'E:', 'COMMI' + 'T:'];

function lineStartsWithDirective(line) {
  for (const p of DIRECTIVE_PREFIXES) {
    if (line.startsWith('===' + p)) return true;
  }
  return false;
}

function directiveName(line) {
  for (const p of DIRECTIVE_PREFIXES) {
    if (line.startsWith('===' + p)) return p.slice(0, -1);
  }
  return null;
}

function findMosaicBlock(content) {
  const lines = content.split('\n');
  let fallback = null;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const opener = raw.match(/^\s*(~~~+|`{3,})mosaic\s*$/);
    if (!opener) continue;
    const fenceChar = opener[1][0];
    const fenceLen = opener[1].length;
    for (let j = i + 1; j < lines.length; j += 1) {
      const closer = lines[j].match(/^\s*(~~~+|`{3,})\s*$/);
      if (
        closer &&
        closer[1][0] === fenceChar &&
        closer[1].length === fenceLen
      ) {
        const body = lines.slice(i + 1, j).join('\n');
        const bodyLines = body.split('\n');
        const candidate = {
          openerLine: i,
          closerLine: j,
          fence: opener[1],
          body,
          hasDirective: bodyLines.some(lineStartsWithDirective),
          indented: /^\s/.test(raw),
        };
        if (!candidate.indented && candidate.hasDirective) return candidate;
        if (!fallback) fallback = candidate;
        break;
      }
    }
  }
  return fallback;
}

function diagnoseMissingBlock(content) {
  const lines = content.split('\n');
  const hints = [];
  if (!content.trim()) {
    hints.push('pending-changes.txt is empty. Paste a mosaic block first.');
    return hints;
  }
  for (let i = 0; i < lines.length && hints.length < 5; i += 1) {
    const line = lines[i];
    if (/^\s*`{3,}mosaic\s*$/.test(line)) {
      hints.push(
        'Line ' +
          (i + 1) +
          ': backtick fence detected. Use five tildes followed by the word mosaic.'
      );
    } else if (/^\s*~{1,4}mosaic\s*$/.test(line)) {
      const match = line.trim().match(/^~+/);
      const n = match ? match[0].length : 0;
      hints.push(
        'Line ' +
          (i + 1) +
          ': opener has ' +
          n +
          ' tildes. Use exactly five tildes followed by mosaic.'
      );
    } else if (/^\s*~+\s+mosaic/.test(line)) {
      hints.push(
        'Line ' +
          (i + 1) +
          ": space between tildes and 'mosaic'. Write five tildes immediately followed by 'mosaic' (no space)."
      );
    } else if (/^\s*mosaic\s*$/.test(line)) {
      hints.push(
        'Line ' +
          (i + 1) +
          ": bare 'mosaic' line. The opener needs five leading tildes."
      );
    }
  }
  const hasDirective = lines.some(lineStartsWithDirective);
  const hasOpener = lines.some((l) => /^\s*~{5,}mosaic\s*$/.test(l));
  if (hasDirective && !hasOpener) {
    hints.push(
      'Found directive lines but no five-tilde mosaic opener. Wrap the payload in an outer fence.'
    );
  }
  if (hasOpener && hints.length === 0) {
    hints.push(
      'An opener was found but no matching closer. The closer must be exactly five tildes alone on their own line.'
    );
  }
  if (hints.length === 0) {
    hints.push(
      'Expected a line containing five tildes followed by the word mosaic.'
    );
    hints.push('The closer must be five tildes alone on their own line.');
    hints.push(
      'Leading and trailing prose is tolerated; malformed fence lines are not.'
    );
  }
  return hints;
}

function parseMegaFile(rawContent) {
  const content = normalizeInput(rawContent);
  const block = findMosaicBlock(content);
  if (!block) {
    const hints = diagnoseMissingBlock(content);
    throw Object.assign(new Error('No mosaic block found.'), { hints });
  }

  const lines = block.body.split('\n');
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
  const duplicatePaths = [];
  const seenFilePaths = new Set();
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

    if (/^(~~~+|`{3,})mosaic\s*$/.test(line) || line.trim() === 'mosaic') {
      log(
        'WARN: ignoring stray mosaic opener inside body (body line ' +
          (i + 1) +
          ').'
      );
      continue;
    }

    const directive = directiveName(line);
    if (directive === 'FILE') {
      flush();
      const p = line.slice('===FILE:'.length).replace(/===\s*$/, '').trim();
      validatePath(p);
      if (seenFilePaths.has(p)) duplicatePaths.push(p);
      seenFilePaths.add(p);
      currentFile = p;
    } else if (directive === 'DELETE') {
      flush();
      const p = line.slice('===DELETE:'.length).replace(/===\s*$/, '').trim();
      validatePath(p);
      deletes.push(p);
    } else if (directive === 'COMMIT') {
      flush();
      commit = line.slice('===COMMIT:'.length).replace(/===\s*$/, '').trim();
    } else if (currentFile) {
      currentLines.push(line);
    }
  }
  flush();

  return { files, deletes, commit, duplicatePaths };
}

function validatePath(p) {
  if (!p || p.includes('..') || path.isAbsolute(p)) {
    throw new Error('Invalid path in directive: ' + p);
  }
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
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
  log('Restoring from ' + latest + ' ...');
  const entries = fs.readdirSync(latest, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'pending-changes.txt') continue;
    if (e.name.startsWith('run-output-')) continue;
    const src = path.join(latest, e.name);
    const dst = path.join(ROOT, e.name);
    if (e.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else {
      ensureDir(dst);
      fs.copyFileSync(src, dst);
    }
  }
  log('OK: rollback complete.');
}

function suggestCommitFallback(files, deletes) {
  const paths = [...files.map((f) => f.path), ...deletes];
  if (paths.every((p) => p.endsWith('.md'))) return 'docs: update documentation';
  if (paths.some((p) => p.startsWith('src/'))) {
    return 'chore: refactor and update source';
  }
  return 'chore: apply changes';
}

function truncateCommit(msg, max = 72) {
  if (!msg) return msg;
  if (msg.length <= max) return msg;
  return msg.slice(0, max - 1) + '~';
}

function commandAvailable(cmd) {
  const firstWord = cmd.split(' ')[0];
  const probe = spawnSync('sh', ['-c', 'command -v ' + firstWord], {
    encoding: 'utf8',
    timeout: 1500,
  });
  return probe.status === 0;
}

function tryClipboardCommand(cmd, text) {
  if (!commandAvailable(cmd)) return false;
  try {
    const res = spawnSync(cmd, {
      input: text,
      shell: true,
      timeout: 3000,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

function clipboardCandidates() {
  const platform = process.platform;
  if (platform === 'darwin') return ['pbcopy'];
  if (platform === 'win32') return ['clip'];
  const list = [];
  if (process.env.WAYLAND_DISPLAY) list.push('wl-copy');
  if (process.env.DISPLAY) {
    list.push('xclip -selection clipboard');
    list.push('xsel --clipboard --input');
  }
  list.push('wl-copy');
  list.push('xclip -selection clipboard');
  list.push('xsel --clipboard --input');
  return list;
}

function copyToClipboardSafe() {
  const text = clipboardBuffer.join('');
  if (!text.trim()) return;
  const payload = CLIPBOARD_MARKER + text;
  const candidates = clipboardCandidates();
  for (const cmd of candidates) {
    if (tryClipboardCommand(cmd, payload)) {
      origWrite('\n(copied to clipboard)\n');
      return;
    }
  }
  origWrite(
    '\n(clipboard copy unavailable - install wl-copy, xclip, or xsel, or paste the output manually)\n'
  );
}

function isTTY() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function promptYesNo(question) {
  const answer = spawnSync(
    'sh',
    ['-c', 'printf "%s " "' + question + '"; read ans; printf "%s" "$ans"'],
    { stdio: ['inherit', 'pipe', 'inherit'] }
  );
  const raw = (answer.stdout || '').toString().trim().toLowerCase();
  return raw === '' || raw === 'y' || raw === 'yes';
}

function gitCommit(commitMsg, paths) {
  if (paths.length === 0) {
    log('WARN: no touched paths to commit.');
    return false;
  }
  const quoted = paths
    .map((p) => "'" + p.replace(/'/g, "'\\''") + "'")
    .join(' ');
  try {
    execSync('git add -- ' + quoted, { stdio: 'inherit' });
    execSync('git commit -m ' + JSON.stringify(commitMsg), { stdio: 'inherit' });
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
    }).trim();
    log('OK: committed ' + hash + ': ' + commitMsg);
    return true;
  } catch {
    log(
      'FAIL: git commit failed. Files are written; fix the hook/error and commit manually.'
    );
    return false;
  }
}

function syntaxCheckInstaller() {
  const abs = path.join(ROOT, SELF_NAME);
  if (!fs.existsSync(abs)) return true;
  const res = spawnSync('node', ['--check', abs], { encoding: 'utf8' });
  if (res.status === 0) return true;
  return {
    ok: false,
    stderr: (res.stderr || '').toString(),
    stdout: (res.stdout || '').toString(),
  };
}

function readRawInput(args) {
  if (args.fromStdin) {
    try {
      return fs.readFileSync(0, 'utf8');
    } catch (err) {
      fail('Could not read stdin: ' + err.message);
    }
  }
  if (args.fromFile) {
    if (!fs.existsSync(args.fromFile)) {
      fail('--from-file path not found: ' + args.fromFile);
    }
    return fs.readFileSync(args.fromFile, 'utf8');
  }
  if (!fs.existsSync(PENDING)) {
    fail('pending-changes.txt not found.', 1, [
      'Paste a mosaic block into pending-changes.txt at the project root.',
      'Or run with --from-file <path>.',
      'Or pipe content and pass --stdin.',
    ]);
  }
  return fs.readFileSync(PENDING, 'utf8');
}

function printHelp() {
  log('Usage: node apply-changes.mjs [options]');
  log('');
  log('Options:');
  log('  --dry-run        Parse and print the plan without writing.');
  log('  --no-verify      Skip lint/test/build after writing.');
  log('  --start          Run the dev server after a successful apply.');
  log('  --rollback       Restore from the most recent backup.');
  log('  --commit         Skip the commit prompt; commit automatically.');
  log('  --no-commit      Skip the commit prompt; do not commit.');
  log('  --from-file <p>  Read from <p> instead of pending-changes.txt.');
  log('  --stdin          Read from stdin.');
  log('  --help           Print this message.');
  log('');
  log('Input must contain a mosaic block: an opening line of five tildes');
  log('followed by the word "mosaic", then FILE, DELETE, or COMMIT directive');
  log('lines, then a closing line of five tildes alone. Leading and trailing');
  log('prose around the block is tolerated.');
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    return;
  }

  if (args.rollback) {
    doRollback();
    copyToClipboardSafe();
    return;
  }

  const raw = readRawInput(args);
  let parsed;
  try {
    parsed = parseMegaFile(raw);
  } catch (err) {
    fail('Parse error: ' + err.message, 1, err.hints || []);
  }

  const { files, deletes, commit, duplicatePaths } = parsed;
  const commitMsg = truncateCommit(
    commit || suggestCommitFallback(files, deletes)
  );

  log('Parsed ' + files.length + ' file(s), ' + deletes.length + ' delete(s).');
  if (commit) log('Commit: ' + commitMsg);
  if (duplicatePaths.length) {
    log(
      'WARN: duplicate FILE paths detected (last occurrence wins): ' +
        duplicatePaths.join(', ')
    );
  }

  warnSelfModification(files.map((f) => f.path));

  const printPlan = () => {
    log('Plan:');
    for (const f of files) {
      log('  write  ' + f.path + ' (' + formatBytes(f.content.length) + ')');
    }
    for (const d of deletes) log('  delete ' + d);
    if (files.length === 0 && deletes.length === 0) {
      log('  (no files or deletes)');
    }
  };

  if (args.dryRun) {
    log('Dry run - no writes.');
    printPlan();
    copyToClipboardSafe();
    return;
  }

  printPlan();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUP_ROOT, timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  if (fs.existsSync(PENDING)) {
    fs.copyFileSync(PENDING, path.join(backupDir, 'pending-changes.txt'));
  }

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
    log('  wrote ' + f.path);
  }

  for (const d of deletes) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs)) {
      const backupPath = path.join(backupDir, d);
      ensureDir(backupPath);
      fs.copyFileSync(abs, backupPath);
      fs.unlinkSync(abs);
      touchedPaths.push(d);
      log('  deleted ' + d);
    }
  }

  if (touchedPaths.includes(SELF_NAME)) {
    const check = syntaxCheckInstaller();
    if (check !== true) {
      log('FAIL: new ' + SELF_NAME + ' has a syntax error. Rolling back.');
      log(check.stderr || check.stdout);
      doRollback();
      fail('Installer syntax check failed. Rolled back to previous version.');
    }
    log('OK: new ' + SELF_NAME + ' passes node --check.');
  }

  if (args.noVerify) {
    log('');
    log('OK: wrote files (verification skipped).');
    copyToClipboardSafe();
    return;
  }

  const lintOk = await run('npm run lint');
  if (!lintOk) {
    fail('Lint failed. Run "npm run apply:rollback" to revert.');
  }

  const testOk = await run('npm test');
  if (!testOk) {
    fail('Tests failed. Run "npm run apply:rollback" to revert.');
  }

  const buildOk = await run('npm run build');
  if (!buildOk) {
    fail('Build failed. Run "npm run apply:rollback" to revert.');
  }

  log('');
  log('OK: lint, test, and build all green.');

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
    const quoted = touchedPaths.map((p) => "'" + p + "'").join(' ');
    log('');
    log('Not a TTY - copy-paste to commit:');
    log(
      '  git add -- ' +
        quoted +
        ' && git commit -m ' +
        JSON.stringify(commitMsg)
    );
    copyToClipboardSafe();
    return;
  }

  const shouldCommit = promptYesNo('Commit these changes? [Y/n]');
  if (shouldCommit) {
    gitCommit(commitMsg, touchedPaths);
  } else {
    log('Skipped commit.');
  }

  copyToClipboardSafe();

  if (args.start) {
    log('');
    log('Starting dev server...');
    await run('npm run dev');
  }
}

main().catch((err) => {
  fail('Unexpected error: ' + err.message);
});