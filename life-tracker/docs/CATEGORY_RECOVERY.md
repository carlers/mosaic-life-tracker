# Category deletion recovery (v0.68.2 Preview)

Category lifecycle #857 has two distinct destructive operations:

- **Move tasks & delete category** retains tasks at their destination. The
  original category is tombstoned. This is *not* reversed by Delete All
  recovery; no automatic reverse migration of moved tasks is offered.
- **Delete category and all tasks** marks previously active tasks with a
  server-only `category_delete_marker` equal to the source category ID before
  tombstoning them. A category becomes recoverable only after the last
  task tombstone succeeds, at which time its `lifecycle_target` becomes
  `recoverable`. Historical deletions predating this marker are excluded.

The Category Manager's **Recently deleted** section lists recoverable
categories for the authenticated owner. Recovery requires typing the exact
category name. The server claims a `restore` lifecycle lock, restores only
tombstoned tasks with a matching marker using owner/category/row-revision CAS
in batches of 12, then restores the category last. Interrupted recovery
resumes with the same category. Previously independently deleted tasks are
never restored. Task shares revoked at deletion and removed Bucket List links
are not recreated; owners must re-share or re-link explicitly. Tombstone
garbage collection may eventually make recovery impossible.

Cloud rollout is ordered: additive `tasks.category_delete_marker` (varchar
36, default empty) via managed migration `021-category-recovery`, verify
column AVAILABLE in Scratch, reconcile *exact active shared*
`message-action` source without removing media/chat/bug handlers, build
an inactive Function, execute signed owner/foreign-owner deletion and
recovery against disposable Scratch identities, then activate the reviewed
deployment. Existing server gate `CATEGORY_DESTRUCTIVE_ENABLED` applies.
Never enable a frontend recovery promise against an unverified old Function,
or deploy an older repository Function over a newer active shared build.
Production requires a separate explicit authorization.
