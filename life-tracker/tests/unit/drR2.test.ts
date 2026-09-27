import { describe, expect, it, vi } from 'vitest';
import { createR2Client } from '../../appwrite-functions/dr-backup/r2.mjs';

function headers(values: Record<string, string> = {}) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    get(name: string) {
      return normalized.get(name.toLowerCase()) ?? null;
    },
    entries() {
      return normalized.entries();
    },
  };
}

function response(
  body = '',
  { status = 200, responseHeaders = {} }: {
    status?: number;
    responseHeaders?: Record<string, string>;
  } = {}
) {
  const bytes = Buffer.from(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers(responseHeaders),
    text: async () => body,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function client(fetchImpl: any) {
  return createR2Client(
    {
      accountId: 'account',
      accessKeyId: 'access',
      secretAccessKey: 'secret',
      bucket: 'mosaic-backups',
    },
    {
      fetchImpl,
      now: () => new Date('2026-09-27T01:02:03.000Z'),
    }
  );
}

describe('R2 disaster-backup transport', () => {
  it('uses an explicitly configured Cloudflare jurisdiction endpoint', async () => {
    const fetchImpl = vi.fn(async () => response(''));
    const r2 = createR2Client(
      {
        accountId: 'account',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        bucket: 'mosaic-backups',
        endpoint: 'https://account.eu.r2.cloudflarestorage.com',
      },
      {
        fetchImpl,
        now: () => new Date('2026-09-27T01:02:03.000Z'),
      }
    );

    await r2.getObject('snapshot.enc');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://account.eu.r2.cloudflarestorage.com/mosaic-backups/snapshot.enc'
    );
    expect(init.headers.host).toBe('account.eu.r2.cloudflarestorage.com');
  });

  it('rejects arbitrary R2 endpoint overrides', () => {
    expect(() =>
      createR2Client({
        accountId: 'account',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        bucket: 'mosaic-backups',
        endpoint: 'https://example.com',
      })
    ).toThrow(/Invalid R2 endpoint/);
  });

  it('signs object writes and authenticates metadata', async () => {
    const fetchImpl = vi.fn(async () =>
      response('', {
        responseHeaders: { etag: 'etag-1' },
      })
    );
    const r2 = client(fetchImpl);

    await r2.putObject('snapshots/a b/object.enc', Buffer.from('cipher'), {
      metadata: {
        'plain-sha256': 'plain',
        'cipher-sha256': 'cipher',
      },
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://account.r2.cloudflarestorage.com/mosaic-backups/snapshots/a%20b/object.enc'
    );
    expect(init.method).toBe('PUT');
    expect(init.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=access\//
    );
    expect(init.headers['x-amz-meta-plain-sha256']).toBe('plain');
    expect(init.headers['x-amz-meta-cipher-sha256']).toBe('cipher');
  });

  it('uses the exact canonical query encoding in list requests', async () => {
    const fetchImpl = vi.fn(async () =>
      response(
        '<ListBucketResult><Contents><Key>a&amp;b</Key></Contents></ListBucketResult>'
      )
    );
    const r2 = client(fetchImpl);

    await expect(r2.listObjects('snap shots/')).resolves.toEqual(['a&b']);

    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain('list-type=2');
    expect(url).toContain('prefix=snap%20shots%2F');
    expect(url).not.toContain('snap+shots');
  });

  it('returns null for a missing HEAD and exposes R2 metadata otherwise', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response('', { status: 404 }))
      .mockResolvedValueOnce(
        response('', {
          responseHeaders: {
            'content-length': '42',
            etag: 'etag-2',
            'x-amz-meta-cipher-sha256': 'abc',
          },
        })
      );
    const r2 = client(fetchImpl);

    await expect(r2.headObject('missing')).resolves.toBeNull();
    await expect(r2.headObject('present')).resolves.toEqual({
      size: 42,
      etag: 'etag-2',
      metadata: { 'cipher-sha256': 'abc' },
    });
  });
});
