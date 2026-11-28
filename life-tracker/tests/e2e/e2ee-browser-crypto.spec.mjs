import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true });

test('dormant E2EE native Chromium WebCrypto uses only synthetic local data', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`);
  const result = await page.evaluate(async () => {
    // These are dormant browser crypto modules. No Appwrite SDK, fetch,
    // actual account, remote key delivery, or live application sync is used.
    const core = await import('/src/lib/e2ee/coreCrypto.ts');
    const media = await import('/src/lib/e2ee/privateMediaCodec.ts');
    const approval = await import('/src/lib/e2ee/deviceApprovalPreflight.ts');

    const owner = {
      projectId: '6b00671500279e901846',
      ownerId: 'synthetic_browser_only',
    };
    const root = core.generateAccountRoot();
    const keyId = core.generateKeyId();
    const context = {
      ...owner, payloadDomain: 'task', rowId: core.generateOpaqueRowId(),
      keyId, revision: core.generateRevision(),
    };
    const plaintext = { id: 'synthetic_task', title: 'SYNTHETIC_SECRET' };
    const sealed = await core.encryptPrivateRecord(root, context, plaintext);
    const opened = await core.decryptPrivateRecord(root, context, sealed);
    let tamperRejected = false;
    try {
      const changed = {
        ...sealed,
        ct: (sealed.ct[0] === 'A' ? 'B' : 'A') + sealed.ct.slice(1),
      };
      await core.decryptPrivateRecord(root, context, changed);
    } catch { tamperRejected = true; }

    const original = Uint8Array.from({ length: 131_111 }, (_, i) => i % 251);
    const source = new Blob([original], { type: 'image/png' });
    const encryptedMedia = await media.sealPrivateMedia(root, owner, keyId, source);
    const restored = await media.openPrivateMedia(
      root, owner, encryptedMedia.manifest, encryptedMedia.ciphertext);
    const bytes = new Uint8Array(await restored.arrayBuffer());
    const mediaEqual = bytes.length === original.length &&
      bytes.every((value, i) => value === original[i]);

    // IndexedDB must persist a nonextractable CryptoKey and authenticate the
    // remembered root in Chromium. Only this synthetic owner is ever stored.
    const vault = await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
    let vaultRoundTrip = false;
    let vaultWrongRootRejected = false;
    let vaultOwnerIsolation = false;
    let vaultForgotten = false;
    try {
      await vault.indexedDbRememberedRoots.remember(owner, root, keyId, 1);
      const saved = await vault.indexedDbRememberedRoots.unlock(owner);
      vaultRoundTrip = saved !== null &&
        saved.keyId === keyId && saved.generation === 1 &&
        saved.root.every((value, i) => value === root[i]);
      saved?.root.fill(0);
      vaultOwnerIsolation = await vault.indexedDbRememberedRoots.unlock({
        ...owner, ownerId: 'synthetic_other_owner',
      }) === null;
      const wrongRoot = core.generateAccountRoot();
      try {
        await vault.indexedDbRememberedRoots.remember(owner, wrongRoot, keyId, 1);
      } catch { vaultWrongRootRejected = true; }
      finally { wrongRoot.fill(0); }
    } finally {
      await vault.forgetRememberedAccountRoot(owner);
      vaultForgotten = await vault.indexedDbRememberedRoots.unlock(owner) === null;
    }

    const gate = { assertReady: async () => {} };
    const now = Date.now();
    const device = await approval.createNewDeviceApprovalRequest(
      owner, 'synthetic_new_device', keyId, 1, now, gate);
    const fingerprint = await approval.deviceRequestFingerprint(device.request);
    const checked = await approval.requireMatchedDeviceApprovalRequest(
      device.request, owner, 'synthetic_trusted_device',
      keyId, 1, now + 1000, fingerprint, gate);

    // No root, recovery secret, ciphertext bytes, or private key crosses out
    // of the browser context. Only synthetic contract assertions are returned.
    const result = {
      recordRoundTrip: JSON.stringify(opened) === JSON.stringify(plaintext),
      tamperRejected,
      mediaRoundTrip: mediaEqual && restored.type === 'image/png',
      mediaChunks: encryptedMedia.manifest.chunks,
      vaultRoundTrip, vaultWrongRootRejected, vaultOwnerIsolation, vaultForgotten,
      privateKeyNonextractable: device.privateKey.extractable === false,
      fingerprintIs96Bit: /^(?:[a-f0-9]{4}-){5}[a-f0-9]{4}$/.test(fingerprint),
      requestImmutable: Object.isFrozen(device.request) &&
        Object.isFrozen(checked.request),
      status: checked.status,
    };
    root.fill(0);
    return result;
  });

  expect(result).toEqual({
    recordRoundTrip: true, tamperRejected: true, mediaRoundTrip: true,
    mediaChunks: 3, vaultRoundTrip: true, vaultWrongRootRejected: true,
    vaultOwnerIsolation: true, vaultForgotten: true,
    privateKeyNonextractable: true,
    fingerprintIs96Bit: true, requestImmutable: true,
    status: 'fingerprint-matched-not-approved',
  });
});

test('two native Chromium tabs permit only one first root vault writer', async ({ page }) => {
  const second = await page.context().newPage();
  const syntheticOwner = {
    projectId: '6b00671500279e901846',
    ownerId: 'synthetic_chromium_root_race',
  };
  const keyId = 'k_' + 'a'.repeat(32);
  const runTab = (tab, offset) => tab.evaluate(async ({ owner, keyId, offset }) => {
    const { indexedDbRememberedRoots } =
      await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
    const root = Uint8Array.from({ length: 32 }, (_, i) => offset + i);
    try {
      await indexedDbRememberedRoots.remember(owner, root, keyId, 1);
      return 'stored';
    } catch {
      return 'rejected';
    } finally {
      root.fill(0);
    }
  }, { owner: syntheticOwner, keyId, offset });

  try {
    await Promise.all([
      page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`),
      second.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`),
    ]);
    // Distinct pages share a real browser origin and IndexedDB, rather than
    // merely simulating a race inside a Node in-memory storage mock.
    await page.evaluate(async (owner) => {
      const { forgetRememberedAccountRoot } =
        await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
      await forgetRememberedAccountRoot(owner);
    }, syntheticOwner);
    const results = await Promise.all([runTab(page, 1), runTab(second, 64)]);
    const readback = await page.evaluate(async (owner) => {
      const { indexedDbRememberedRoots } =
        await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
      const saved = await indexedDbRememberedRoots.unlock(owner);
      if (!saved) return { matchesFirst: false, matchesSecond: false };
      try {
        return {
          matchesFirst: saved.root.every((value, i) => value === i + 1),
          matchesSecond: saved.root.every((value, i) => value === i + 64),
        };
      } finally { saved.root.fill(0); }
    }, syntheticOwner);
    expect(results.filter(result => result === 'stored')).toHaveLength(1);
    expect(results.filter(result => result === 'rejected')).toHaveLength(1);
    expect(readback).toEqual({
      matchesFirst: results[0] === 'stored',
      matchesSecond: results[1] === 'stored',
    });
  } finally {
    await page.evaluate(async owner => {
      const { forgetRememberedAccountRoot } =
        await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
      await forgetRememberedAccountRoot(owner);
    }, syntheticOwner);
    await second.close();
  }
});

test('synthetic emergency recovery works in an independent Chromium storage context', async ({ page, browser }) => {
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  const fresh = await other.newPage();
  const owner = { projectId: '6b00671500279e901846', ownerId: 'synthetic_cross_context_recovery' };
  try {
    await Promise.all([
      page.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`),
      fresh.goto(`${BASE_URL}/tests/e2e/interaction-contract.html`),
    ]);
    const sealed = await page.evaluate(async (owner) => {
      const core = await import('/src/lib/e2ee/coreCrypto.ts');
      const vault = await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
      // Deterministic, publicly known test bytes only. Never use these as real keys.
      const root = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
      const secret = Uint8Array.from({ length: 32 }, (_, i) => i + 64);
      try {
        const keyId = core.generateKeyId();
        const context = { ...owner, rowId: core.generateOpaqueRowId(),
          keyId, revision: core.generateRevision(), payloadDomain: 'diary' };
        const envelope = await core.wrapRootForRecovery(root, secret, owner, keyId);
        const record = await core.encryptPrivateRecord(root, context, { content: 'SYNTHETIC_RECOVERY' });
        await vault.indexedDbRememberedRoots.remember(owner, root, keyId, 1);
        // Only ciphertext and public context cross browser contexts.
        return { context, envelope, record };
      } finally { root.fill(0); secret.fill(0); }
    }, owner);
    const result = await fresh.evaluate(async ({ owner, sealed }) => {
      const core = await import('/src/lib/e2ee/coreCrypto.ts');
      const vault = await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
      const secret = Uint8Array.from({ length: 32 }, (_, i) => i + 64);
      const wrongSecret = new Uint8Array(32);
      const rejected = async (fn) => {
        try { const opened = await fn(); if (opened instanceof Uint8Array) opened.fill(0); return false; }
        catch { return true; }
      };
      let recovered;
      let parsed;
      try {
        const initiallyEmpty = await vault.indexedDbRememberedRoots.unlock(owner) === null;
        const emergencyKey = await core.formatEmergencyRecoveryKey(secret);
        parsed = await core.parseEmergencyRecoveryKey(emergencyKey);
        const badChecksum = emergencyKey.slice(0, -6) +
          (emergencyKey.at(-6) === 'A' ? 'B' : 'A') + emergencyKey.slice(-5);
        const checksumRejected = await rejected(() => core.parseEmergencyRecoveryKey(badChecksum));
        const wrongKeyRejected = await rejected(() => core.unwrapRootFromRecovery(wrongSecret, owner, sealed.envelope));
        const wrongOwnerRejected = await rejected(() => core.unwrapRootFromRecovery(parsed, {
          ...owner, ownerId: 'synthetic_wrong_owner',
        }, sealed.envelope));
        const wrongProjectRejected = await rejected(() => core.unwrapRootFromRecovery(parsed, {
          ...owner, projectId: 'synthetic_wrong_project',
        }, sealed.envelope));
        const altered = { ...sealed.envelope,
          ct: (sealed.envelope.ct[0] === 'A' ? 'B' : 'A') + sealed.envelope.ct.slice(1) };
        const tamperRejected = await rejected(() => core.unwrapRootFromRecovery(parsed, owner, altered));
        recovered = await core.unwrapRootFromRecovery(parsed, owner, sealed.envelope);
        const data = await core.decryptPrivateRecord(recovered, sealed.context, sealed.record);
        await vault.indexedDbRememberedRoots.remember(owner, recovered, sealed.context.keyId, 1);
        const remembered = await vault.indexedDbRememberedRoots.unlock(owner);
        try {
          return {
            initiallyEmpty, checksumRejected, wrongKeyRejected, wrongOwnerRejected,
            wrongProjectRejected, tamperRejected,
            correctRoot: recovered.every((value, i) => value === i + 1),
            decrypted: data.content === 'SYNTHETIC_RECOVERY',
            remembered: remembered !== null && remembered.generation === 1 &&
              remembered.keyId === sealed.context.keyId &&
              remembered.root.every((value, i) => value === recovered[i]),
          };
        } finally { remembered?.root.fill(0); }
      } finally { secret.fill(0); wrongSecret.fill(0); parsed?.fill(0); recovered?.fill(0); }
    }, { owner, sealed });
    expect(result).toEqual({
      initiallyEmpty: true, checksumRejected: true, wrongKeyRejected: true,
      wrongOwnerRejected: true, wrongProjectRejected: true, tamperRejected: true,
      correctRoot: true, decrypted: true, remembered: true,
    });
  } finally {
    await other.close();
    await page.evaluate(async owner => {
      const { forgetRememberedAccountRoot } =
        await import('/src/lib/e2ee/rememberedRootIndexedDb.ts');
      await forgetRememberedAccountRoot(owner);
    }, owner);
  }
});
