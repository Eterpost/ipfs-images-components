'use strict';

const { createClient } = require('redis');

const settings = require('./settings');

let clientPromise = null;

/**
 * Общее подключение к Redis (settings.redis.url), создаётся при первом вызове.
 * @return {Promise<import('redis').RedisClientType>}
 */
function getClient() {
  if (!clientPromise) {
    const client = createClient({ ...settings.redis.options, url: settings.redis.url });
    client.on('error', (error) => {
      require('./logging').getWrapperForModule('redis').error(error);
    });
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

/**
 * Закрывает общее подключение (тесты, остановка сервера).
 */
async function close() {
  if (clientPromise) {
    const client = await clientPromise;
    clientPromise = null;
    await client.quit();
  }
}

module.exports = { close, getClient };
