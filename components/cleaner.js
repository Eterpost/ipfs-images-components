'use strict';

const logging = require('./logging').getWrapperForModule('cleaner');
const redis = require('./redis');

/**
 * Удаляет файлы, загруженные раньше чем expire секунд назад (по индексу
 * времени в Redis), из тех, что есть в хранилище.
 */
class Cleaner {
  /**
   * @param {Object} storage - Хранилище (delete, getLocalObjects)
   * @param {Metadata} metadata - Метаданные
   * @param {{expire: number, interval: number}} options - Срок жизни и период, секунды
   */
  constructor(storage, metadata, options) {
    this.storage = storage;
    this.metadata = metadata;
    this.expire = options.expire;
    this.interval = options.interval;
  }

  /**
   * Восстанавливает индекс времени по записям метаданных.
   * @return {Promise<number>} Сколько записей в индексе
   */
  async buildIndex() {
    const client = await redis.getClient();
    const keys = await client.keys(this.metadata.prefix + '*');
    for (const key of keys) {
      const record = await client.hGetAll(key);
      let datetime = Number(record.datetime);
      if (isNaN(datetime)) {
        datetime = new Date(record.datetime).getTime();
      }
      await client.zAdd(this.metadata.index, {
        score: datetime, value: key.slice(this.metadata.prefix.length),
      });
    }
    logging.info(`Indexed ${keys.length} attachments`);
    return keys.length;
  }

  /**
   * @return {Promise<number>} Сколько файлов удалено
   */
  async run() {
    const timestamp = Date.now() - this.expire * 1000;
    logging.info(`Cleaning attachments uploaded before ${new Date(timestamp).toUTCString()}`);
    const local = new Set(await this.storage.getLocalObjects());
    const client = await redis.getClient();
    const outdated = (await client.zRangeByScore(this.metadata.index, '-inf', timestamp))
      .filter((hash) => local.has(hash));
    for (const hash of outdated) {
      await this.storage.delete(hash);
      await this.metadata.delRecord(hash);
      logging.info(`Deleted attachment ${hash}`);
    }
    return outdated.length;
  }
}

module.exports = Cleaner;
