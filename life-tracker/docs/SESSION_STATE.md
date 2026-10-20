# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 app-owned signed Supabase core Auth + real RxDB lifecycle coordinator.

## Baseline and authorization
- Accepted isolated stable Preview `refactor/1027-app-rxdb-core-bridge-20261020@4e1718132632c55b79d218daa6cbbb006f9b1fce`. PRs #1072/#1073, focused repair CI #39396790705 SUCCESS, full canonical #39396934431 SUCCESS, trusted #39397143268 READY; issue #1027 comment #6287335605.
- Task branch `chatgpt/1027-signed-core-auth-coordinator-20261020`. Version impact NONE: no app login UI or active cloud provider selection, no dev/main/Production/provider/schema/user data operations.
- Maintain 3 backend deployments: Appwrite Cloud, Oracle-hosted Appwrite, Supabase Cloud. Old-PWA server cutoff, trustworthy ID mapping, two-provider lease exclusion, DR and reverse-delta migration must precede any real switch.

## Implementation
- `src/lib/supabaseCoreAuth.ts`: app-side signed account orchestration of in-memory Supabase GoTrue sign-in/optional isolated restore, current signed owner verification, separately resolved canonical identity and existing real-RxDB two-domain core startup bridge.
- Authenticated owner is published only after signed owner and legacy mapping match and the remote writer starts; never trust cached metadata or stored owner hints. No browser refresh token persistence enabled.
- Explicit stop-before-logout and stop-before-refresh/renewal; retry both mapping and server/local writer safeguards on each refreshed session. Concurrent logins blocked; late owner switches cancel started writers. Unconfirmed stop/start and uncertain local Auth cleanup fail closed.
- `tests/unit/supabaseCoreAuth.test.ts`: signed activation, no-op restore, mapping mismatch, delayed account switch, late post-start switch, uncertain cleanup and revoked writer, logout order, refresh/reacquire and denied provider/guards.
- `docs/CORE_MVP_PROVIDER_RETURN.md`: describe this as non-shipped contract and enumerate trusted cloud/app UI gaps.

## Verification
- Coherent task SHA focused verification required. Do not claim tests or deployment passed before CI reports them.

## Next action
- If focused CI fails, batch repair; when green squash into separate isolated stable Preview and require canonical full CI + trusted exact-SHA READY. Do not promote protected branches without user approval.
- Next bring provider-aware `AuthProvider` to app UI behind genuine server-mapped accounts and old Appwrite writer cutoff + cross-tab Auth credential rotation; no alternate backend startup with test-injected no-op guards. Hosted signed two-owner security, reverse Appwrite/Oracle/Supabase import/DR and multi-device/offline acceptance remain mandatory.
- Diary #1029 immediately after working core release; #1027/#967/#975/#1026 remain open.
