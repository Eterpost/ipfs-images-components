'use strict';

const logging = require('./logging').getWrapperForModule('pin');
const redis = require('./redis');

/**
 * Закрепление в IPFS всех файлов, известных по метаданным.
 */
class Pin {
  /**
   * @param {IpfsStorage} storage - Хранилище IPFS (pin, getLocalObjects)
   * @param {Metadata} metadata - Метаданные
   */
  constructor(storage, metadata) {
    this.storage = storage;
    this.metadata = metadata;
  }

  /**
   * @return {Promise<string[]>} Хеши всех файлов из метаданных
   */
  async hashes() {
    const client = await redis.getClient();
    const keys = await client.keys(this.metadata.prefix + '*');
    return keys.map((key) => key.slice(this.metadata.prefix.length));
  }

  /**
   * Закрепляет все файлы.
   */
  async all() {
    const hashes = await this.hashes();
    let counter = 0;
    for (const hash of hashes) {
      await this.storage.pin(hash);
      logging.info(`Pinned ${hash}, ${++counter}/${hashes.length}`);
    }
  }

  /**
   * @return {Promise<string[]>} Файлы из метаданных, которых нет в хранилище
   */
  async check() {
    const local = new Set(await this.storage.getLocalObjects());
    return (await this.hashes()).filter((hash) => !local.has(hash));
  }
}

module.exports = Pin;
