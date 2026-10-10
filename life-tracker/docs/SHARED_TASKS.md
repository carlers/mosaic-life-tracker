# Shared tasks: owner and collaborator contract

Issue #406, candidate 0.14.2. One canonical owner task. Sharing requires a mutually accepted
friendship and accepted invitation; owner can revoke, collaborator can leave.
Normal task visibility never grants collaboration. Only minimal shared fields (title,
scheduled date, one global completion, status, revision, editable-title/date booleans)
are projected through the server Function; category, image, memo, and other private
metadata are never returned.

- **Owner:** Controls memberships and **separate per-friend toggles** for editing
  the shared title and date. Defaults are false (existing shares remain completion-only).
  Neither toggle can give away owner account, category, images, memo, visibility or
  deletion control. Owner task category and personal ordering never change when
  a collaborator organizes the task.
- **Collaborator:** Can independently group a received share into **their own** existing
  category and drag shared rows across categories/reorder among other received rows.
  Personal grouping/order is stored in account-scoped, synced settings keyed by membership;
  it is not copied into owner task or RxDB tasks. Unassigned items remain in the
  \`Shared with me\` virtual group. Copies made from received shares become independent,
  incomplete personal tasks with only public shared title/date fields, and can then
  be edited/deleted like personal tasks.
- **Granted global edits:** Title and date changes go to the trusted Function; the
  Function checks active accepted membership, mutual friendship/version, grant epoch,
  grant flag, task owner and expected task revision inside an Appwrite transaction.
  A successful change is global and appears for owner/all accepted recipients. Failed or
  stale writes are rejected; client must reload. Global title/date edits require online
  connectivity in this revision; don't claim they are queued offline.
- **Other actions:** Global completion retains its durable offline queue. Local
  category/reorder changes sync as owner-scoped settings. Owner can always revoke
  permissions without deleting the share. Recipient **cannot** edit/delete owner
  memo/image/category, move the owner task into their private categories, or delete
  the canonical task.
- **Drag boundary:** The current received-share drag targets are category headers
  and task rows. Dropping on a native task moves the received share into that
  category; shared-vs-owned exact interleaving isn't persisted by this revision.
  Reordering among received shares is per-recipient only. Never route a received
  share through owner-task RxDB mutation, bulk delete, or export operations.

Delivery requires additive migration 009, an exact-SHA Scratch Function package
and activation, full stable Preview CI and Vercel readiness; manual multi-account
and device acceptance remain separate evidence. Do not activate backend changes on
Production as a side effect of Preview testing.

## Recipient task-row interaction parity (v0.14.3)

Accepted shared tasks use the same Day View row structure and 24px category-colored
checkbox as normal tasks. A small muted “Shared by <friend>” line remains the
only visible distinction. The original 3-dot management button and drag-grip
are removed. Single-tap or keyboard activation of the **title** opens the
permission-aware shared task Action Sheet; double-tap edits the title inline
when the owner has granted title editing. Without permission, double-tap opens
the Action Sheet; it must never bypass server authorization. The Action Sheet
presents Edit/Duplicate and text-copy, recipient category, permitted date and
leave controls in the same UI language as owned TaskActionSheet. Checkbox
remains independent from title gestures. When reorder mode is active, long-press
the title (~500ms) to drag; the source row hides during drag and the overlay
uses the same task silhouette and category color. This keeps the server-owned
minimal projection and all owner-private data boundaries unchanged.
