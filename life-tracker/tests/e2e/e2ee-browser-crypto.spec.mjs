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
    mediaChunks: 3, privateKeyNonextractable: true,
    fingerprintIs96Bit: true, requestImmutable: true,
    status: 'fingerprint-matched-not-approved',
  });
});
