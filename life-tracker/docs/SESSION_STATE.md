# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 diagnose exact Stage 03 fourteen-table Scratch encrypted R2 recovery failure without repeating accepted ten-table backup or bypassing protected main.

## Verified
- Hosted `mosaic-dev` (`hcxtiifzxoaflhjgoglb`) remains on **21 migrations** after five owner-approved additive registry/readiness changes; 87 Auth accounts/mappings (0 crossed), original personal-data row counts preserved, 3 active/84 frozen, registry RLS with no browser grants. No consent or release evidence and **final writer fence not applied**.
- Ten-table BEFORE R2 `20261028T053525682Z` independently age-authenticated and full PG17/GoTrue/Storage restored. Never redo it. New fourteen-table AFTER R2 snapshot is **not accepted**.
- Isolated recovery `feature/1027-supabase-recovery-20261020@e4f356f10ea1744b4193f2fe1b0d702d193765cb` via PR #1422: full canonical #40649583892 SUCCESS, real GoTrue/ten/eight/table specialist labs green; `dev`/`main` unaffected. Protected workflow PR #1421 still DRAFT/BLOCKED by main promotion rules.
- Owner's first Fedora attempt failed PG17 preflight (system PG18). Fedora `postgresql17` conflicts with PG18; operator instead verified both **official Fedora-signed PG17.11 RPM clients extracted privately**, leaving system PG18 untouched.
- Second one-pass Fedora attempt passed Stage 01 (exact SHA, private age/pooler/Docker) and Stage 02 (hidden credentials). Stage 03 `unified-offsite.mjs --backup` failed with generic `GUARDED_CHILD_FAILED` and cleanup Stage 06 PASS. **No fourteen-table COMPLETED ID was reported.** Stage 03 might leave unmarked partial R2 ciphertext if it reached upload; no cause or confirmed remote write is known. Never report a fourteen-table backup as created or restored; no user credentials or output should enter GitHub.

## Scoped repair
- Task `chatgpt/1027-fourteen-stage03-safe-diagnostics-20261028` adds fixed-source substage names for age, PG client, PG data capture, authenticated TOC/profile, private Storage, R2 publish/remote verification, and prevents raw provider output leakage. Parent accepts only exact enumerated status markers, preserving a verified `COMPLETED` ID if publication succeeded but the full-byte readback failed. Offline Python and Node tests cover secret redaction, untrusted labels, and marker retention.
- Do not relax PostgreSQL 17, exact 14-table Auth+Registry TOC, independent R2 watcher, original-password signed local owner isolation, whole-media byte restoration, cleanup, branch checks or release gates.

## Next action
1. Finish focused CI, squash into isolated recovery, verify canonical/specialist CI; **do not promote** `dev`, `main` or Production.
2. Provide ONE exact-source pin Fedora invocation reusing private PG17.11 wrapper dir; capture only `MOSAIC_*` safe stage diagnostics, never keys. If a completed snapshot marker is printed on failure, restore THAT same generation rather than republishing.
3. Require actual fourteen-table encrypted R2 + independent PG17/GoTrue/Storage signed restore acceptance before hosted signed new-RPC, SMTP/device checks or separately approved writer fence/Preview/Production release.

See [operator runbook](OPERATOR_ONEPASS.md), [offsite runbook](SUPABASE_UNIFIED_OFFSITE_DR.md), and [issue #1027](https://github.com/carlers/mosaic-life-tracker/issues/1027).
