'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { text } = require('node:stream/consumers');
const { describe, it } = require('node:test');
const { useTestConfig } = require('./helpers');

const { dir } = useTestConfig();
const { FileNotFoundError } = require('../components/errors');
const FilesystemStorage = require('../components/storage-backends/filesystem');

function upload(content) {
  const file = path.join(dir, 'upload-' + Math.random());
  fs.writeFileSync(file, content);
  return { originalFilename: 'a.png', path: file };
}

describe('FilesystemStorage', () => {
  const storage = new FilesystemStorage(path.join(dir, 'files'));

  it('should store a file under its sha256 and give it back', async () => {
    const hash = await storage.add(upload('picture'));
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(await text(await storage.get(hash)), 'picture');
    assert.equal(await storage.has(hash), true);
  });

  it('should give the same hash to the same content', async () => {
    const first = await storage.add(upload('same'));
    const second = await storage.add(upload('same'));
    assert.equal(first, second);
  });

  it('should store the same content uploaded at the same time', async () => {
    const content = Buffer.alloc(2 * 1024 * 1024, 7);
    for (let round = 0; round < 5; round++) {
      const hashes = await Promise.all([1, 2, 3, 4].map(() => storage.add(upload(content))));
      assert.equal(new Set(hashes).size, 1);
      assert.deepEqual(fs.readFileSync(storage.getFilePath(hashes[0])), content);
      await storage.delete(hashes[0]);
    }
  });

  it('should not find a missing or malformed hash', async () => {
    for (const hash of ['0'.repeat(64), '../../etc/passwd', 'ab']) {
      await assert.rejects(storage.get(hash), FileNotFoundError, hash);
      assert.equal(await storage.has(hash), false);
    }
  });

  it('should delete a file', async () => {
    const hash = await storage.add(upload('to delete'));
    await storage.delete(hash);
    await assert.rejects(storage.get(hash), FileNotFoundError);
    await assert.rejects(storage.delete(hash), FileNotFoundError);
  });
});
