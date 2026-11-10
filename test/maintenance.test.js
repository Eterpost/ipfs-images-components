'use strict';

const assert = require('node:assert/strict');
const { after, describe, it } = require('node:test');
const { redisSkip, useTestConfig } = require('./helpers');

useTestConfig();
const Cleaner = require('../components/cleaner');
const Metadata = require('../components/metadata');
const Pin = require('../components/pin');
const redis = require('../components/redis');

describe('Cleaner and Pin', { skip: redisSkip }, () => {
  const metadata = new Metadata();
  const old = 'b'.repeat(64);
  const fresh = 'c'.repeat(64);

  after(async () => {
    await metadata.delRecord(old);
    await metadata.delRecord(fresh);
    await redis.close();
  });

  it('should delete files uploaded before the expiry', async () => {
    await metadata.addRecord(old, 'image/png', 1);
    await metadata.addRecord(fresh, 'image/png', 1);
    const client = await redis.getClient();
    await client.zAdd(metadata.index, { score: Date.now() - 10_000_000, value: old });
    const deleted = [];
    const storage = {
      delete: async (hash) => { deleted.push(hash); },
      getLocalObjects: async () => [old, fresh],
    };
    const cleaner = new Cleaner(storage, metadata, { expire: 1000, interval: 3600 });
    assert.equal(await cleaner.run(), 1);
    assert.deepEqual(deleted, [old]);
    assert.equal(await client.exists(metadata.prefix + old), 0);
    assert.equal(await client.exists(metadata.prefix + fresh), 1);
  });

  it('should list known files missing from the local IPFS store', async () => {
    await metadata.addRecord(old, 'image/png', 1);
    const pinned = [];
    const storage = {
      getLocalObjects: async () => [fresh],
      pin: async (hash) => { pinned.push(hash); },
    };
    const pin = new Pin(storage, metadata);
    assert.deepEqual(await pin.check(), [old]);
    await pin.all();
    assert.deepEqual(pinned.sort(), [old, fresh].sort());
  });
});
