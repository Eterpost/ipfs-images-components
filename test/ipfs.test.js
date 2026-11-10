'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { text } = require('node:stream/consumers');
const { describe, it } = require('node:test');
const { useTestConfig } = require('./helpers');

const { dir } = useTestConfig();
const IpfsStorage = require('../components/storage-backends/ipfs');

// Подмена kubo-rpc-client: хранит содержимое в памяти
function fakeClient() {
  const objects = new Map();
  const pins = new Set();
  return {
    pins,
    add: async (content) => {
      const chunks = [];
      for await (const chunk of content) chunks.push(chunk);
      const cid = 'Qm' + objects.size;
      objects.set(cid, Buffer.concat(chunks));
      return { cid: { toString: () => cid } };
    },
    cat: async function* (cid) {
      if (!objects.has(cid)) throw new Error('not found');
      yield objects.get(cid);
    },
    pin: {
      add: async (cid) => { pins.add(String(cid)); },
      ls: async function* () { for (const cid of pins) yield { cid: { toString: () => cid } }; },
      rm: async (cid) => { pins.delete(String(cid)); },
    },
  };
}

describe('IpfsStorage', () => {
  it('should add, pin, read and unpin through the client', async () => {
    const client = fakeClient();
    const storage = new IpfsStorage('http://127.0.0.1:5001', { create: async () => client });
    const file = path.join(dir, 'ipfs-upload');
    fs.writeFileSync(file, 'ipfs picture');
    const hash = await storage.add({ originalFilename: 'a.png', path: file });
    assert.equal(hash, 'Qm0');
    assert.deepEqual([...client.pins], ['Qm0']);
    assert.equal(await text(await storage.get(hash)), 'ipfs picture');
    assert.deepEqual(await storage.getLocalObjects(), ['Qm0']);
    await storage.delete(hash);
    assert.deepEqual([...client.pins], []);
  });
});
