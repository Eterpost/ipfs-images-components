'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');
const { useTestConfig } = require('./helpers');
const { HTML, PNG } = require('./images');

const { dir } = useTestConfig();
const express = require('express');
const upload = require('../components/handlers/upload');
const FilesystemStorage = require('../components/storage-backends/filesystem');

describe('upload', () => {
  const storage = new FilesystemStorage(path.join(dir, 'upload-files'));
  const records = [];
  const metadata = { addRecord: async (...args) => { records.push(args); } };
  let server;
  let url;

  before(async () => {
    const app = express();
    app.post('/ul', upload(storage, metadata, { MAX_FILE_SIZE: 1000 }));
    app.post('/ul-pdf', upload(storage, metadata, {
      ALLOWED_TYPES: ['image/png', 'application/pdf'], MAX_FILE_SIZE: 1000,
    }));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  async function send(content, { filename = 'a.png', type = 'application/octet-stream', route = '/ul', field = 'file' } = {}) {
    const form = new FormData();
    form.append(field, new Blob([content], { type }), filename);
    const response = await fetch(url + route, { body: form, method: 'POST' });
    const body = response.headers.get('content-type')?.includes('json') ?
      await response.json() : await response.text();
    return { body, status: response.status };
  }

  it('should store a picture with the type taken from its content', async () => {
    const { body, status } = await send(PNG, { filename: 'Картинка один.png', type: 'text/plain' });
    assert.equal(status, 200);
    assert.equal(body.mime, 'image/png');
    assert.equal(body.filename, 'Картинка один.png');
    assert.equal(await storage.has(body.id), true);
    assert.deepEqual(records.at(-1), [body.id, 'image/png', PNG.length]);
  });

  it('should refuse HTML disguised as a picture', async () => {
    const count = records.length;
    for (const type of ['image/png', 'text/html']) {
      const { status } = await send(HTML, { filename: 'x.png', type });
      assert.equal(status, 415, type);
    }
    assert.equal(records.length, count);
    assert.equal(await storage.has(storage.computeHash(HTML)), false);
  });

  it('should accept another allowed type declared by the client', async () => {
    const { body, status } = await send(Buffer.from('%PDF-1.4'), {
      filename: 'p.pdf', route: '/ul-pdf', type: 'application/pdf',
    });
    assert.equal(status, 200);
    assert.equal(body.mime, 'application/pdf');
  });

  it('should refuse a file that is too large', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2000)]);
    assert.equal((await send(big)).status, 413);
  });

  it('should refuse a form without a file', async () => {
    assert.equal((await send(PNG, { field: 'other' })).status, 400);
    const response = await fetch(url + '/ul', { body: 'x', method: 'POST' });
    assert.equal(response.status, 400);
  });
});
