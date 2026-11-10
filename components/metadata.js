'use strict';

const { FileNotFoundError } = require('./errors');
const logging = require('./logging').getWrapperForModule('metadata');
const redis = require('./redis');
const settings = require('./settings');

/**
 * Метаданные файлов в Redis: хеш <prefix><hash> (datetime, mimetype, size) и
 * индекс по времени загрузки (sorted set).
 */
class Metadata {
  constructor() {
    this.prefix = settings.redis.prefix.attachments;
    this.index = settings.redis.index.datetime;
  }

  /**
   * @param {string} hash - Хеш файла
   * @param {string} mimetype - Тип
   * @param {number} size - Размер, байт
   */
  async addRecord(hash, mimetype, size) {
    const record = this.prefix + hash;
    const timestamp = Date.now();
    logging.verbose(`Add record ${record} to Redis`);
    const client = await redis.getClient();
    await client.multi()
      .hSet(record, { datetime: String(timestamp), mimetype, size: String(size) })
      .zAdd(this.index, { score: timestamp, value: hash })
      .exec();
  }

  /**
   * @param {string} hash - Хеш файла
   * @return {Promise<{datetime: string, mimetype: string, size: string}>}
   */
  async getRecord(hash) {
    const record = this.prefix + hash;
    logging.verbose(`Get record ${record} from Redis`);
    const client = await redis.getClient();
    const data = await client.hGetAll(record);
    if (!data || !Object.keys(data).length) {
      throw new FileNotFoundError(`Record ${record} not found in Redis`);
    }
    return data;
  }

  /**
   * @param {string} hash - Хеш файла
   */
  async delRecord(hash) {
    const record = this.prefix + hash;
    logging.verbose(`Delete record ${record} from Redis`);
    const client = await redis.getClient();
    await client.multi().del(record).zRem(this.index, hash).exec();
  }
}

module.exports = Metadata;
