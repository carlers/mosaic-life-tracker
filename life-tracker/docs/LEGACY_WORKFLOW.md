# Legacy revision tooling

Mosaic retains the former DeepSeek web workflow as an optional recovery and portability
tool. It is not part of normal Codex work. Codex edits the workspace directly and runs
the project's checks itself.

## Retained tools

- `npm run dump -- <paths>` prints exact files in repomix-compatible XML and attempts
  to copy the output to the clipboard.
- `npm run apply:dry` parses and validates `pending-changes.txt` without writing files.
- `npm run apply` applies a legacy mega file, creates a backup, then runs lint, tests,
  and build before offering to commit touched paths.
- `npm run apply:docs` applies a legacy documentation patch without verification.
- `npm run apply:start` applies, verifies, and starts the development server.
- `npm run apply:rollback` restores the most recent `.mosaic-backup` snapshot.
- `repomix` and `repomix.config.json` remain available for exporting repository context.

`pending-changes.txt` and `.mosaic-backup/` remain ignored. Existing pending content is
user-owned and must not be overwritten or cleared by the Codex workflow.

## Legacy mega-file format

The installer accepts the original `mosaic` fenced format with `===FILE:path===`,
`===DELETE:path===`, and optional `===COMMIT:message===` directives. The parser is
fence-aware, backs up touched paths before writing, and leaves a failed verified apply
in place until the user explicitly runs rollback.

The complete historical specification, including the retired Chat 1/Chat 2 protocol,
is preserved in `docs/PROJECT_REFERENCE.md` §§5, 5.1, and 25. Those sections are a
historical record and do not instruct Codex.
