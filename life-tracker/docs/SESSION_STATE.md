# Session checkpoint

Updated: 2026-10-10
Current task: #407 Backlog safety foundation, user-approved staged implementation; no dev/main promotion approval.
Base: dev 224f8a700f35bbe3853206ee208e1dc103ece5b3 (v0.12.1).
Task branch: chatgpt/backlog-foundation-407.

## Findings and scope
- Scratch Appwrite tasks.date required varchar(50) accepted date='' createRow. Follow-up row lookup was empty and delete returned 404; durable roundtrip/replication still unproven.
- Friend calendar, friend task, reaction and notification paths previously allowed visible category tasks without requiring a scheduled date.
- This non-user-facing foundation adds a shared server-side scheduled-date guard and handler test, **not** the full Backlog UI or Bucket List feature. No schema, feature version or production deployment change.

## Verification / next action
Run focused handler CI for this commit and investigate failures. Then implement client Backlog placement with task IDs preserved, restore format support and search routing, reconcile #406 shared tasks, test old-client/offline/privacy contracts, and stage Scratch Function + Preview. Complete exact-SHA canonical CI, Vercel READY, and human browser/device checks before requesting dev promotion; production remains untouched.
