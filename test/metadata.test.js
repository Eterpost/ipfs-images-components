'use strict';

const assert = require('node:assert/strict');
const { after, describe, it } = require('node:test');
const { redisSkip, useTestConfig } = require('./helpers');

useTestConfig();
const { FileNotFoundError } = require('../components/errors');
const Metadata = require('../components/metadata');
const redis = require('../components/redis');

describe('Metadata', { skip: redisSkip }, () => {
  const metadata = new Metadata();
  const hash = 'a'.repeat(64);

  after(async () => {
    await metadata.delRecord(hash);
    await redis.close();
  });

  it('should add, read and delete a record', async () => {
    await metadata.addRecord(hash, 'image/png', 247223);
    const record = await metadata.getRecord(hash);
    assert.equal(record.mimetype, 'image/png');
    assert.equal(record.size, '247223');
    assert.ok(Number(record.datetime) > 0);
    const client = await redis.getClient();
    assert.notEqual(await client.zScore('TEST_IMAGES.DATETIME.INDEX', hash), null);

    await metadata.delRecord(hash);
    await assert.rejects(metadata.getRecord(hash), FileNotFoundError);
    assert.equal(await client.zScore('TEST_IMAGES.DATETIME.INDEX', hash), null);
  });
});
