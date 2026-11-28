import { expect, test } from '@playwright/test';
const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true });

test('native Chromium transports only authenticated saved rescue ciphertext across device storage contexts', async ({ page, browser }) => {
  const foreignContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const recoveredPage = await foreignContext.newPage();
  const owner = {
    projectId: '6b00671500279e901846',
    ownerId: 'synthetic_native_rescue_owner',
  };
  try {
    await Promise.all([
      page.goto(BASE_URL + '/tests/e2e/interaction-contract.html'),
      recoveredPage.goto(BASE_URL + '/tests/e2e/interaction-contract.html'),
    ]);
    const prepared = await page.evaluate(async (owner) => {
      const cryptoCore = await import('/src/lib/e2ee/coreCrypto.ts');
      const rescue = await import('/src/lib/e2ee/ownerLocalRescueBundle.ts');
      const root = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
      const secret = Uint8Array.from({ length: 32 }, (_, i) => i + 64);
      const keyId = cryptoCore.generateKeyId();
      const internal = {
        _deleted: true, _rev: '2-synthetic_native_rescue',
        _meta: { lwt: 1795670000000 }, _attachments: {},
      };
      const task = {
        ...internal, id: 'synthetic_browser_tombstone', userId: owner.ownerId,
        isDeleted: false, title: 'SYNTHETIC PRIVATE TOMBSTONE',
        visibility: 'private', date: '2045-07-08',
      };
      const link = {
        ...internal, id: 'synthetic_browser_orphan_link', userId: owner.ownerId,
        isDeleted: true, activityId: 'missing_activity', taskId: 'missing_task',
      };
      const command = {
        id: 'synthetic_pending_social', userId: owner.ownerId,
        action: 'upsert_profile', op: { kind: 'updateRow', bio: 'SYNTHETIC QUEUED SECRET' },
        enqueuedAt: '2026-11-28T00:00:00Z', attempts: 0,
      };
      const pendingKey = 'mosaic_social_outbox:entry:' +
        encodeURIComponent(owner.ownerId) + ':' + encodeURIComponent(command.id);
      const sources = {
        rows: { readAll: async (collection) =>
          collection === 'tasks' ? [{ ...task }] :
          collection === 'activityTaskLinks' ? [{ ...link }] : [] },
        images: { readAll: async () => [{
          id: 'localimg_' + 'f'.repeat(26), ownerUserId: owner.ownerId,
          blob: new Blob(['SYNTHETIC UNUPLOADED IMAGE'], { type: 'image/png' }),
          createdAt: '2026-11-28T00:00:00.000Z',
        }] },
        queues: localStorage,
      };
      const gate = { assertReady: async () => {} };
      try {
        const envelope = await cryptoCore.wrapRootForRecovery(root, secret, owner, keyId);
        localStorage.setItem(pendingKey, JSON.stringify(command));
        const withPending = await rescue.buildOwnerLocalRescueFile(
          owner, root, keyId, gate, sources);
        localStorage.removeItem(pendingKey);
        const withoutPending = await rescue.buildOwnerLocalRescueFile(
          owner, root, keyId, gate, sources);
        return {
          keyId, envelope,
          withPending: await withPending.file.text(),
          withoutPending: await withoutPending.file.text(),
          counts: {
            pending: [withPending.rows, withPending.media, withPending.pending],
            clean: [withoutPending.rows, withoutPending.media, withoutPending.pending],
          },

        };
      } finally {
        localStorage.removeItem(pendingKey);
        root.fill(0); secret.fill(0);
      }
    }, owner);
    expect(prepared.counts).toEqual({ pending: [2, 1, 1], clean: [2, 1, 0] });
    for (const secret of [
      'SYNTHETIC PRIVATE TOMBSTONE', 'SYNTHETIC UNUPLOADED IMAGE',
      'SYNTHETIC QUEUED SECRET', 'synthetic_browser_tombstone',
      'synthetic_browser_orphan_link', 'synthetic_pending_social',
    ]) {
      expect(prepared.withPending).not.toContain(secret);
      expect(prepared.withoutPending).not.toContain(secret);
    }

    const result = await recoveredPage.evaluate(async ({ owner, prepared }) => {
      const core = await import('/src/lib/e2ee/coreCrypto.ts');
      const rescue = await import('/src/lib/e2ee/ownerLocalRescueBundle.ts');
      const stage = await import('/src/lib/e2ee/ownerRescueV2Staging.ts');
      const media = await import('/src/lib/e2ee/ownerSavedMediaIntentStore.ts');
      const intents = await import('/src/lib/e2ee/ownerV2PendingIntentStore.ts');
      const secret = Uint8Array.from({ length: 32 }, (_, i) => i + 64);
      let root;
      const rejected = async (fn) => {
        try { await fn(); return false; } catch { return true; }
      };
      try {
        root = await core.unwrapRootFromRecovery(secret, owner, prepared.envelope);
        const pendingFile = new File([prepared.withPending],
          rescue.OWNER_LOCAL_RESCUE_FILENAME, { type: 'application/octet-stream' });
        const cleanFile = new File([prepared.withoutPending],
          rescue.OWNER_LOCAL_RESCUE_FILENAME, { type: 'application/octet-stream' });
        const pending = await rescue.unpackVerifiedOwnerLocalRescueFile(owner, root, pendingFile);
        const oldWritesPreserved = pending.pending.length === 1 &&
          pending.pending[0].record.op.bio === 'SYNTHETIC QUEUED SECRET';
        const tombstonePreserved = pending.rows.some(item =>
          item.collection === 'tasks' &&
          item.document.id === 'synthetic_browser_tombstone' &&
          item.document._deleted === true);
        const orphanPreserved = pending.rows.some(item =>
          item.collection === 'activityTaskLinks' &&
          item.document.id === 'synthetic_browser_orphan_link');
        const mediaPreserved = pending.media.length === 1 &&
          await pending.media[0].blob.text() === 'SYNTHETIC UNUPLOADED IMAGE';
        const rejectedWhilePending = await rejected(() =>
          stage.stageAuthenticatedScratchRescueFileV2(
            root, owner, pendingFile, prepared.keyId, 1));
        const rejectedWrongOwner = await rejected(() =>
          rescue.verifyOwnerLocalRescueFile(
            { ...owner, ownerId: 'synthetic_foreign' }, root, cleanFile));
        const tampered = JSON.parse(prepared.withoutPending);
        tampered.rows = [];
        const rejectedTamper = await rejected(() =>
          rescue.verifyOwnerLocalRescueFile(
            owner, root, new File([JSON.stringify(tampered)],
              rescue.OWNER_LOCAL_RESCUE_FILENAME)));

        // The second browser has no original RxDB, queued action, image
        // IndexedDB or first browser root store. It receives a reselected
        // encrypted File only. Stage photos and rows in separate local IDB
        // stores, retaining the same original ciphertext for a retry.
        const gate = { assertReady: async () => {} };
        const photos1 = await media.stageSelectedSavedOwnerEncryptedMedia(
          root, owner, cleanFile, prepared.keyId, gate);
        const rows1 = await stage.stageAuthenticatedScratchRescueFileV2WithVerifiedMedia(
          root, owner, cleanFile, prepared.keyId, 1);
        const photos2 = await media.stageSelectedSavedOwnerEncryptedMedia(
          root, owner, cleanFile, prepared.keyId, gate);
        const rows2 = await stage.stageAuthenticatedScratchRescueFileV2WithVerifiedMedia(
          root, owner, cleanFile, prepared.keyId, 1);
        const photoRecords = await media.readStagedOwnerEncryptedMedia(root, owner);
        const rowRecords = await intents.listV2OwnerMigrationIntents(root, owner);
        const parity = await stage.auditSavedScratchOwnerLocalIntentParity(
          root, owner, cleanFile, prepared.keyId, 1, gate);
        return {
          oldWritesPreserved, tombstonePreserved, orphanPreserved, mediaPreserved,
          rejectedWhilePending, rejectedWrongOwner, rejectedTamper,
          staged: [photos1.stored, photos1.reused, rows1.stored, rows1.reused],
          retry: [photos2.stored, photos2.reused, rows2.stored, rows2.reused],
          localCounts: [photoRecords.length, rowRecords.length],
          parity: parity.status

        };
      } finally {
        root?.fill(0); secret.fill(0);
      }
    }, { owner, prepared });
    expect(result).toEqual({
      oldWritesPreserved: true, tombstonePreserved: true,
      orphanPreserved: true, mediaPreserved: true,
      rejectedWhilePending: true, rejectedWrongOwner: true,
      rejectedTamper: true,
      staged: [1, 0, 2, 0],
      retry: [0, 1, 0, 2],
      localCounts: [1, 2],
      parity: 'verified-local-parity-only-no-cutover',
    });
  } finally {
    await foreignContext.close();
  }
});
