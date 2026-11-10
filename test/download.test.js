'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');
const { useTestConfig } = require('./helpers');

const { dir } = useTestConfig();
const express = require('express');
const sharp = require('sharp');
const { FileNotFoundError } = require('../components/errors');
const delAttachment = require('../components/handlers/del_attachment');
const download = require('../components/handlers/download');
const downloadThumb = require('../components/handlers/download_thumb');
const FilesystemStorage = require('../components/storage-backends/filesystem');
const Thumbnail = require('../components/thumbnail');

// Метаданные в памяти с тем же интерфейсом, что Metadata
function memoryMetadata() {
  const records = new Map();
  return {
    addRecord: async (hash, mimetype, size) => {
      records.set(hash, { datetime: String(Date.now()), mimetype, size: String(size) });
    },
    delRecord: async (hash) => { records.delete(hash); },
    getRecord: async (hash) => {
      if (!records.has(hash)) throw new FileNotFoundError(`no ${hash}`);
      return records.get(hash);
    },
  };
}

describe('download, thumbnails and delete', () => {
  const storage = new FilesystemStorage(path.join(dir, 'dl-files'));
  const metadata = memoryMetadata();
  let server;
  let url;
  let hash;
  let picture;

  before(async () => {
    picture = await sharp({
      create: { background: '#f00', channels: 3, height: 300, width: 400 },
    }).png().toBuffer();
    const file = path.join(dir, 'dl-upload');
    fs.writeFileSync(file, picture);
    hash = await storage.add({ path: file });
    await metadata.addRecord(hash, 'image/png', picture.length);

    const app = express();
    const thumbnail = new Thumbnail(storage, { cache: false, sizes: [64, 128] });
    app.get('/dl/thumb/:size/:hash', downloadThumb(thumbnail, metadata, { CACHE_DURATION: 60 }));
    app.get('/dl/:hash/:filename', download(storage, metadata, { CACHE_DURATION: 60 }));
    app.delete('/del/:hash', delAttachment(storage, metadata));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  it('should serve a file with cache and safety headers', async () => {
    const response = await fetch(`${url}/dl/${hash}/${encodeURIComponent('Картинка один.png')}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('etag'), `"${hash}"`);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60, immutable');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('content-security-policy'), 'sandbox');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), picture);
  });

  it('should answer 304 only for the matching ETag of an existing file', async () => {
    const same = await fetch(`${url}/dl/${hash}/a.png`, { headers: { 'If-None-Match': `"${hash}"` } });
    assert.equal(same.status, 304);
    const other = await fetch(`${url}/dl/${hash}/a.png`, { headers: { 'If-None-Match': '"x"' } });
    assert.equal(other.status, 200);
    const missing = '0'.repeat(64);
    const absent = await fetch(`${url}/dl/${missing}/a.png`, {
      headers: { 'If-Modified-Since': new Date().toUTCString(), 'If-None-Match': `"${missing}"` },
    });
    assert.equal(absent.status, 404);
  });

  it('should not serve a path instead of a hash', async () => {
    const response = await fetch(`${url}/dl/${encodeURIComponent('../../etc/passwd')}/x`);
    assert.equal(response.status, 404);
  });

  it('should make a JPEG thumbnail that fits the size', async () => {
    const response = await fetch(`${url}/dl/thumb/64/${hash}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const info = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(info.format, 'jpeg');
    assert.ok(info.width <= 64 && info.height <= 64, `${info.width}x${info.height}`);
  });

  it('should delete the file and its record', async () => {
    const file = path.join(dir, 'dl-delete');
    fs.writeFileSync(file, 'delete me');
    const id = await storage.add({ path: file });
    await metadata.addRecord(id, 'image/png', 9);
    assert.equal((await fetch(`${url}/del/${id}`, { method: 'DELETE' })).status, 200);
    assert.equal(await storage.has(id), false);
    await assert.rejects(metadata.getRecord(id), FileNotFoundError);
    assert.equal((await fetch(`${url}/del/${id}`, { method: 'DELETE' })).status, 404);
  });
});
