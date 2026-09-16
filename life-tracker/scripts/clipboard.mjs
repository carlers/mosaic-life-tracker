#!/usr/bin/env node
import { spawnSync } from 'child_process';

/**
 * Copy `text` to the system clipboard synchronously.
 *
 * Tries the platform-appropriate tool(s): `pbcopy` on macOS, `clip` on
 * Windows, and `wl-copy` / `xclip` / `xsel` on Linux (Wayland first if
 * detected). Returns `true` on the first tool that exits 0, `false` if
 * no clipboard tool is available or every attempt fails.
 *
 * Shared by `scripts/dump-files.mjs` (Tier 2 context dump, §25.2) and
 * `apply-changes.mjs` (run-output copy on exit, §5.1). No side effects
 * beyond spawning the clipboard utility.
 */
export function copyToClipboard(text) {
  const attempts = [];
  if (process.platform === 'darwin') {
    attempts.push(['pbcopy', []]);
  } else if (process.platform === 'win32') {
    attempts.push(['clip', []]);
  } else {
    if (process.env.WAYLAND_DISPLAY) attempts.push(['wl-copy', []]);
    attempts.push(['xclip', ['-selection', 'clipboard']]);
    attempts.push(['xsel', ['--clipboard', '--input']]);
  }
  for (const [cmd, args] of attempts) {
    try {
      const res = spawnSync(cmd, args, {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      if (res.status === 0) return true;
    } catch {
      // Tool not installed or spawn failed — try the next candidate.
    }
  }
  return false;
}
