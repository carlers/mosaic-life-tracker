# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #745 approved permanent chat send-denial repair, v0.29.3 isolated Preview candidate.

## Verified baseline
- Published Production main@b952f71ecd2add3172f90104bc0e856a2648ccc9 is v0.29.1; owner reports installed laptop and phone PWAs working.
- Protected dev@f9e01b6fc8f8913b75a9738fc978c0ed55427d98 is still v0.29.1. No v1.0.0 approval.
- Owner accepts #855 v0.29.2 Day View date jumps; stable fix/855-day-view-window-20261016@10feb70b8d942593fbbd11b2ed5d6120cab35500 passed full canonical #38915794320, not yet promoted.
- #914 source-only supported-release pin stable eec2d3bfabb945ee91790a06213827b5028aac1a passed full canonical/Preview. Its Phase B live old/new offline/PWA rehearsal has not been run.

## Current implementation
- #745 fix: permanent Function 400/403/404/409/422 errors previously left outgoing pending messages auto-retrying without usable feedback.
- Keep RxDB schema and remote delivery_status pending/delivered unchanged. Track denied message IDs locally per owner with bounded persistent metadata; suppress automatic retries of denied IDs; render accessible Not sent + Retry; retry the original ID and clear marker only after verified server receipt and local delivered patch. No message body/error logged into denial storage.
- Preserve bounded transient, timeout, 429 and 5xx retries; 401 is authentication/session handling. Do not silently discard local messages or move denial metadata into Appwrite.
- Work branch chatgpt/745-send-denial-20261016, stable Preview target fix/745-send-denial-20261016. Version candidate 0.29.3 follows v0.29.2 #855.

## Next action
- Focused exact-SHA CI, repair if necessary, task→stable squash, full canonical CI and READY Preview. Record manual denied-send/revoked-friend/two-account testing separately.
- #855, #745, #914 promotions to dev require independent owner authorization/tree-parity checks. #889 controls the 1.0 milestone and final go/no-go; never tag 1.0.0 automatically.
