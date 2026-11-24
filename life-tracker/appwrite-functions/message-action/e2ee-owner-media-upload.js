'use strict';
// Isolated Scratch-only fixed binary multipart upload. The host-local root
// canary proved this wire format, not the Function execution-key path.
// Use only the injected Function endpoint/key, never a browser value.
const crypto = require('node:crypto');
// Match the Undici 6 transport in node-appwrite 29, which reached Storage.
// Node 18's global fetch failed before HTTP in the isolated v0.114.5 run.
const { fetch: undiciFetch } = require('undici');
const PROJECT = '6b00671500279e901846';
const BUCKET = 'private_owner_media_v1';
// Only these two destinations may receive an execution-scoped key. The
// pinned public origin is independently registered to this Scratch project.
const STORAGE_PATH = '/v1/storage/buckets/' + BUCKET + '/files';
const PINNED_PUBLIC_ORIGIN = 'https://129-221-244-67.sslip.io';
const REDIRECT_CODES = new Set([301,302,307,308]);
function blockedRedirect() {
  const error = new Error('Encrypted media Storage redirect blocked');
  error.cause = {code:'MOSAIC_STORAGE_REDIRECT_BLOCKED'};
  return error;
}
function authorizedRedirect(previous,location) {
  if (typeof location !== 'string' || location.length > 512) return null;
  let next;
  try { next = new URL(location,previous); } catch {return null;}
  if (next.username || next.password || next.search || next.hash ||
      !['http:','https:'].includes(next.protocol) ||
      ![STORAGE_PATH,STORAGE_PATH+'/'].includes(next.pathname) ||
      (next.origin !== previous.origin && next.origin !== PINNED_PUBLIC_ORIGIN) ||
      (previous.protocol === 'https:' && next.protocol !== 'https:'))
    return null;
  return next;
}
const ERROR_TYPES = new Set([
  'general_argument_invalid','storage_file_empty','storage_file_type_unsupported',
  'storage_invalid_file_size','storage_invalid_content_range',
  'storage_invalid_appwrite_id','storage_device_not_found',
]);
function failure(code, type) {
  const error = new Error('Encrypted media Storage request failed');
  error.code = code;
  if (ERROR_TYPES.has(type)) error.type = type;
  return error;
}
async function boundedJson(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const parts = [];
  let length = 0;
  try {
    for (;;) {
      const {value,done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        return null;
      }
      parts.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { return null; }
}
async function uploadOwnerMediaChunk(endpoint,project,key,fileId,ciphertext) {
  if (project !== PROJECT || typeof key !== 'string' || !key ||
      !/^em_[a-f0-9]{32}$/.test(fileId) || !Buffer.isBuffer(ciphertext) ||
      ciphertext.length < 17 || ciphertext.length > 65552)
    throw failure(422);
  let url;
  try { url = new URL(endpoint); } catch { throw failure(422); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password ||
      !['/v1','/v1/'].includes(url.pathname) || url.search || url.hash)
    throw failure(422);
  url.pathname = STORAGE_PATH;
  // A random boundary and explicit CRLF framing match the successful Oracle
  // canary. No client-provided name, MIME, permissions, URL, or multipart field.
  const boundary = 'mosaic' + crypto.randomBytes(24).toString('hex');
  const prefix = Buffer.from('--' + boundary +
    '\r\nContent-Disposition: form-data; name="fileId"\r\n\r\n' +
    fileId + '\r\n--' + boundary +
    '\r\nContent-Disposition: form-data; name="file"; filename="' +
    fileId + '.bin"\r\nContent-Type: application/octet-stream\r\n\r\n','ascii');
  const suffix = Buffer.from('\r\n--' + boundary + '--\r\n','ascii');
  const body = Buffer.concat([prefix,ciphertext,suffix]);
  // Node fetch's redirect:'error' converts a harmless 301/302/307/308
  // into TypeError('fetch failed') with no numeric cause. A platform
  // canonicalization redirect must not silently turn POST into GET or
  // forward an ephemeral execution key to an arbitrary Location. Inspect
  // one redirect manually, reissue the same bytes only to a pinned target.
  const deadline = AbortSignal.timeout(10000);
  let response;
  for (let hop=0;hop<2;hop++) {
    response = await undiciFetch(url, {
      method:'POST', redirect:'manual', signal:deadline,
      headers:{
        'X-Appwrite-Project':PROJECT, 'X-Appwrite-Key':key,
        'Content-Type':'multipart/form-data; boundary='+boundary,
        'Content-Length':String(body.length),
      },body,
    });
    if (response.status < 300 || response.status >= 400) break;
    const target = hop===0 && REDIRECT_CODES.has(response.status)
      ? authorizedRedirect(url,response.headers.get('location'))
      : null;
    // Drop redirect response without consuming unbounded remote content.
    if (response.body) try {await response.body.cancel();} catch {}
    if (!target) throw blockedRedirect();
    url = target;
  }
  const value = await boundedJson(response);
  if (!response.ok) throw failure(response.status,value?.type);
  // No ACK without matching opaque identity and a private file ACL. The
  // caller additionally reads the stored ciphertext and compares every byte.
  if (!value || value.$id !== fileId || value.bucketId !== BUCKET ||
      !Array.isArray(value.$permissions) || value.$permissions.length !== 0 ||
      value.sizeOriginal !== ciphertext.length)
    throw failure(422);
}
module.exports = {uploadOwnerMediaChunk,authorizedRedirect};
