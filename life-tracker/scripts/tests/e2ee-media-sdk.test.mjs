/**
 * Actual node-appwrite Storage multipart contract. No cloud credentials or
 * external services: a local loopback HTTP server verifies the SDK's real
 * CommonJS InputFile/file upload path, rather than a mock Storage object.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { Client, Storage } = require('node-appwrite');
const { InputFile } = require('node-appwrite/file');

test('real SDK serializes 64-KiB+tag ciphertext into a valid multipart upload', async () => {
  const ciphertext = Buffer.alloc(65552, 0x73);
  const fileId = 'em_' + 'a'.repeat(32);
  const bodyReceived = [];
  const server = createServer((req, res) => {
    (async () => {
      assert.equal(req.method, 'POST');
      assert.equal(req.url, '/v1/storage/buckets/private_owner_media_v1/files');
      assert.equal(req.headers['x-appwrite-project'], '6b00671500279e901846');
      assert.match(String(req.headers['content-type']), /^multipart\/form-data; boundary=/);
      for await (const chunk of req) bodyReceived.push(chunk);
      const raw = Buffer.concat(bodyReceived);
      assert.ok(raw.includes(ciphertext), 'ciphertext passed to real SDK is transmitted byte-for-byte');
      assert.ok(raw.includes(Buffer.from('name="fileId"')), 'opaque file ID field present');
      assert.ok(raw.includes(Buffer.from(fileId)), 'opaque file ID value present');
      assert.ok(raw.includes(Buffer.from('filename="' + fileId + '.bin"')));
      assert.ok(!raw.includes(Buffer.from('name="permissions[]"')), 'no browser file permissions');
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ $id:fileId, bucketId:'private_owner_media_v1' }));
    })().catch(err => {
      res.writeHead(500, { 'content-type':'application/json' });
      res.end(JSON.stringify({ type:'synthetic_error', message:String(err?.message || '') }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  try {
    const client = new Client()
      .setEndpoint('http://127.0.0.1:' + port + '/v1')
      .setProject('6b00671500279e901846')
      .setKey('synthetic-test-key');
    const storage = new Storage(client);
    const uploaded = await storage.createFile({
      bucketId:'private_owner_media_v1',
      fileId,
      file:InputFile.fromBuffer(ciphertext, fileId + '.bin'),
      permissions:[],
    });
    assert.equal(uploaded.$id, fileId);
    assert.ok(bodyReceived.length > 0);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
