# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #889 / #526 isolated v0.17.5 legacy Production-client reader compatibility bridge, under full stable Preview verification.

## Source boundary and verification
- Protected Production `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` remains v0.17.4; protected `dev@d51a9c6af7f67ceecdd88f02783debb45692726b` is accepted v0.29.1 with no downgrade or Production promotion.
- Isolated bridge `fix/889-v0175-legacy-bridge-20261015@038544a53510ebb6502c6409acb44ecddcc4e9b5` was squashed from focused-tested task source `81bde2da1d35e95f1b37d39949f8fc5100238908` in PR #910.
- Mapper removes unknown remote Appwrite fields before strict historical RxDB validation for existing collections. Diary/message regression coverage preserves old fallback behavior. Version metadata 0.17.5. No Appwrite schema/Function, Storage, permission, authentication, service-worker or Production change.
- Focused Quality Gate #38725371146 SUCCESS. Historical differential #38756019542: immutable old v0.17.4 BLOCK and isolated 0.17.5 PASS for six actual subscribed collection row/write fixtures (not an installed-device acceptance).
- First stable full Quality Gate #38766697189 FAIL in `checks` because this checkpoint lacked mandatory `## Next action` heading; build succeeded, unit test suite otherwise 984 pass/one documentation-contract failure. Repair adds required heading and updates stale source status; no runtime code change.
- Independent backup-read GitHub Action #38763468167 attempt 2 SUCCESS: R2 `COMPLETED` marker, ciphertext manifest object HEAD and age verified. No decryption or fresh isolated restore asserted.

## Constraints
- This hotfix remains a possible staged Production bridge, not an approval to bypass protected `dev→main` release workflow, alter schemas first, or upgrade an already offline v0.17.4 installation silently.
- `dev` v0.29.1 and its open Production candidate PR #909 remain untouched. Root requirement is verified old-client upgrade and safe subsequent schema/migration cutover, separate authenticated R2 restore evidence, and real signed-in two-account/PWA acceptance.

## Next action
- Verify this task branch with `[verify:focused]`, squash docs-only fix through PR into the existing stable hotfix Preview, then rerun full canonical and trusted CI-first Vercel Preview on the new exact stable SHA.
- Preserve the protected Production branch, Appwrite data/Function, main release tags and 1.0 milestone until release gates are satisfied.
