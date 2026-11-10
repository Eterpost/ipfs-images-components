'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Тесты с Redis: TEST_REDIS_URL=redis://127.0.0.1:16379/1 npm test
const TEST_REDIS_URL = process.env.TEST_REDIS_URL;
const redisSkip = TEST_REDIS_URL ? false : 'TEST_REDIS_URL is not set';

/**
 * Временный каталог и config.json в нём; IPFS_IMAGES_CONFIG указывает на него.
 * Вызывается до первого require компонентов
 */
function useTestConfig(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipfs-images-'));
  const config = {
    logging: { transports: [] },
    redis: {
      index: { datetime: 'TEST_IMAGES.DATETIME.INDEX' },
      options: {},
      prefix: { attachments: 'TEST_IMAGES_' },
      url: TEST_REDIS_URL || 'redis://127.0.0.1:6379',
    },
    server: {
      allowedTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      auth: { allowedIPs: ['.*'], type: 'partial' },
      cache: 604800,
      headers: { origin: 'http://localhost' },
      port: 0,
      size: 1024 * 1024,
      storage: { options: { basePath: path.join(dir, 'files') }, type: 'filesystem' },
    },
    thumbnails: {
      cache: false,
      path: path.join(dir, 'thumbs'),
      // sharp для тестов превью: TEST_SHARP_PATH=/usr/lib/node_modules/sharp
      ...(process.env.TEST_SHARP_PATH ? { sharpPath: process.env.TEST_SHARP_PATH } : {}),
      sizes: [64, 128],
    },
    ...overrides,
  };
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(config));
  process.env.IPFS_IMAGES_CONFIG = file;
  return { config, dir, file };
}

module.exports = { redisSkip, TEST_REDIS_URL, useTestConfig };
