import { createHash, createHmac } from 'node:crypto';

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function awsEncode(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodePath(bucket, key = '') {
  const parts = [bucket, ...String(key).split('/').filter(Boolean)];
  return `/${parts.map(awsEncode).join('/')}`;
}

function canonicalQuery(params) {
  return [...params.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) => {
      const keyOrder = aKey.localeCompare(bKey);
      return keyOrder || aValue.localeCompare(bValue);
    })
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join('&');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseS3ErrorCode(xml) {
  const match = String(xml || '').match(/<Code>([^<]{1,128})<\/Code>/);
  if (!match) return '';
  return match[1].replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128);
}

function parseListXml(xml) {
  const keys = [];
  for (const match of xml.matchAll(
    /<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/Contents>/g
  )) {
    keys.push(decodeXml(match[1]));
  }
  const tokenMatch = xml.match(
    /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/
  );
  return {
    keys,
    nextToken: tokenMatch ? decodeXml(tokenMatch[1]) : null,
  };
}

export function createR2Client(
  { accountId, accessKeyId, secretAccessKey, bucket, endpoint },
  { fetchImpl = globalThis.fetch, now = () => new Date() } = {}
) {
  for (const [name, value] of Object.entries({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
  })) {
    if (!value) throw new Error(`Missing R2 configuration: ${name}`);
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('R2 client requires fetch');
  }

  const endpointUrl = new URL(
    endpoint || `https://${accountId}.r2.cloudflarestorage.com`
  );
  const allowedHosts = new Set([
    `${accountId}.r2.cloudflarestorage.com`,
    `${accountId}.eu.r2.cloudflarestorage.com`,
    `${accountId}.us.r2.cloudflarestorage.com`,
    `${accountId}.fedramp.r2.cloudflarestorage.com`,
    `${accountId}.fedramp-high.r2.cloudflarestorage.com`,
  ]);
  if (
    endpointUrl.protocol !== 'https:' ||
    endpointUrl.username ||
    endpointUrl.password ||
    endpointUrl.search ||
    endpointUrl.hash ||
    (endpointUrl.pathname && endpointUrl.pathname !== '/') ||
    !allowedHosts.has(endpointUrl.host)
  ) {
    throw new Error('Invalid R2 endpoint for configured account');
  }
  const host = endpointUrl.host;
  const origin = endpointUrl.origin;

  async function request(
    method,
    key,
    { body, query = {}, contentType, metadata = {}, allowNotFound = false } = {}
  ) {
    const payload = body === undefined ? Buffer.alloc(0) : Buffer.from(body);
    const payloadHash = sha256Hex(payload);
    const date = now();
    const dateTime = amzDate(date);
    const dateStamp = dateTime.slice(0, 8);
    const scope = `${dateStamp}/auto/s3/aws4_request`;
    const path = encodePath(bucket, key);
    const params = new URLSearchParams();
    for (const [queryKey, queryValue] of Object.entries(query)) {
      if (queryValue !== undefined && queryValue !== null) {
        params.append(queryKey, String(queryValue));
      }
    }

    const headers = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': dateTime,
    };
    if (contentType) headers['content-type'] = contentType;
    for (const [metaKey, metaValue] of Object.entries(metadata)) {
      headers[`x-amz-meta-${metaKey.toLowerCase()}`] = String(metaValue);
    }

    const headerEntries = Object.entries(headers)
      .map(([name, value]) => [name.toLowerCase(), String(value).trim()])
      .sort(([a], [b]) => a.localeCompare(b));
    const signedHeaders = headerEntries.map(([name]) => name).join(';');
    const canonicalHeaders =
      headerEntries.map(([name, value]) => `${name}:${value}`).join('\n') +
      '\n';
    const queryString = canonicalQuery(params);
    const canonicalRequest = [
      method,
      path,
      queryString,
      canonicalHeaders + signedHeaders,
      payloadHash,
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateTime,
      scope,
      sha256Hex(Buffer.from(canonicalRequest)),
    ].join('\n');
    const dateKey = hmac(Buffer.from(`AWS4${secretAccessKey}`), dateStamp);
    const regionKey = hmac(dateKey, 'auto');
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = hmac(signingKey, stringToSign, 'hex');
    headers.authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `${origin}${path}${
      queryString ? `?${queryString}` : ''
    }`;
    const response = await fetchImpl(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : payload,
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).slice(0, 300);
      } catch {
        detail = '';
      }
      throw new Error(
        `R2 ${method} failed with HTTP ${response.status}${
          detail ? `: ${detail}` : ''
        }`
      );
    }
    return response;
  }

  return {
    async putObject(key, body, options = {}) {
      const response = await request('PUT', key, {
        body,
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata,
      });
      return { etag: response.headers.get('etag') };
    },

    async getObject(key) {
      const response = await request('GET', key);
      return Buffer.from(await response.arrayBuffer());
    },

    async headObject(key) {
      const response = await request('HEAD', key, { allowNotFound: true });
      if (!response) return null;
      const metadata = {};
      for (const [name, value] of response.headers.entries()) {
        if (name.startsWith('x-amz-meta-')) {
          metadata[name.slice('x-amz-meta-'.length)] = value;
        }
      }
      return {
        size: Number(response.headers.get('content-length') || 0),
        etag: response.headers.get('etag'),
        metadata,
      };
    },

    async deleteObject(key) {
      await request('DELETE', key);
    },

    async listObjects(prefix) {
      const keys = [];
      let continuationToken = null;
      do {
        const response = await request('GET', '', {
          query: {
            'list-type': '2',
            prefix,
            ...(continuationToken
              ? { 'continuation-token': continuationToken }
              : {}),
          },
        });
        const page = parseListXml(await response.text());
        keys.push(...page.keys);
        continuationToken = page.nextToken;
      } while (continuationToken);
      return keys;
    },

    async deletePrefix(prefix) {
      const keys = await this.listObjects(prefix);
      for (const objectKey of keys) await this.deleteObject(objectKey);
      return keys.length;
    },
  };
}
