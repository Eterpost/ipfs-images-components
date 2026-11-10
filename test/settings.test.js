'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const { useTestConfig } = require('./helpers');

const { dir, config } = useTestConfig();
const settings = require('../components/settings');

describe('settings', () => {
  it('should read the file named by IPFS_IMAGES_CONFIG', () => {
    assert.equal(settings.server.size, config.server.size);
    assert.equal(settings.redis.prefix.attachments, 'TEST_IMAGES_');
  });

  it('should reload the settings in place', () => {
    const other = path.join(dir, 'other.json');
    fs.writeFileSync(other, JSON.stringify({ ...config, server: { ...config.server, size: 7 } }));
    settings.load(other);
    assert.equal(settings.server.size, 7);
    settings.load();
    assert.equal(settings.server.size, config.server.size);
  });

  it('should explain a missing or broken config', () => {
    assert.throws(() => settings.load(path.join(dir, 'missing.json')), /config\.json/);
    const broken = path.join(dir, 'broken.json');
    fs.writeFileSync(broken, '{');
    assert.throws(() => settings.load(broken), /Config must be a valid JSON document/);
    settings.load();
  });
});
