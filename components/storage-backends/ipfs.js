'use strict';

const fs = require('node:fs');
const { Readable } = require('node:stream');

const { FileNotFoundError } = require('../errors');
const logging = require('../logging').getWrapperForModule('ipfs');

/**
 * kubo-rpc-client — модуль ESM, из CommonJS он подключается через import()
 * @param {string} url - Адрес RPC демона IPFS (Kubo)
 * @return {Promise<Object>} Клиент
 */
async function createKuboClient(url) {
  const { create } = await import('kubo-rpc-client');
  return create({ url });
}

/**
 * Хранилище в IPFS через демон Kubo: файлы закрепляются (pin), чтобы их не
 * удалила сборка мусора.
 */
class IpfsStorage {
  /**
   * @param {string} url - Адрес RPC демона
   * @param {{create?: function(string): Promise<Object>}} [options] - create
   *   подменяет создание клиента (тесты)
   */
  constructor(url, options = {}) {
    this.url = url;
    this.create = options.create || createKuboClient;
    this.clientPromise = null;
  }

  /**
   * @return {Promise<Object>} Клиент Kubo
   */
  client() {
    if (!this.clientPromise) {
      this.clientPromise = this.create(this.url);
    }
    return this.clientPromise;
  }

  /**
   * @param {{path: string, originalFilename?: string}} file - Загруженный файл
   * @return {Promise<string>} CID файла
   */
  async add(file) {
    logging.verbose(`Uploading '${file.originalFilename}' to IPFS`);
    const ipfs = await this.client();
    const result = await ipfs.add(fs.createReadStream(file.path));
    const hash = result.cid.toString();
    await this.pin(hash);
    return hash;
  }

  /**
   * Снимает закрепление: файл удалит ближайший `ipfs repo gc`
   * @param {string} hash - CID
   */
  async delete(hash) {
    logging.verbose(`Unpinning object ${hash} from local storage`);
    const ipfs = await this.client();
    try {
      await ipfs.pin.rm(hash);
    } catch (error) {
      throw new FileNotFoundError(`Object ${hash} is not pinned: ${error.message}`);
    }
  }

  /**
   * @param {string} hash - CID
   * @return {Promise<import('stream').Readable>}
   */
  async get(hash) {
    logging.verbose(`Serving attachment for ${hash}`);
    const ipfs = await this.client();
    const chunks = ipfs.cat(hash);
    // Первый кусок читается сразу: так отсутствие файла видно до ответа клиенту
    const iterator = chunks[Symbol.asyncIterator]();
    let first;
    try {
      first = await iterator.next();
    } catch (error) {
      throw new FileNotFoundError(`Object ${hash} not found: ${error.message}`);
    }
    return Readable.from((async function* () {
      if (!first.done) {
        yield first.value;
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
          yield next.value;
        }
      }
    })());
  }

  /**
   * @param {string} hash - CID
   * @return {Promise<boolean>}
   */
  async has(hash) {
    return (await this.getLocalObjects()).includes(hash);
  }

  /**
   * @return {Promise<string[]>} CID закреплённых объектов
   */
  async getLocalObjects() {
    const ipfs = await this.client();
    const result = [];
    for await (const { cid } of ipfs.pin.ls()) {
      result.push(cid.toString());
    }
    return result;
  }

  /**
   * @param {string} hash - CID
   */
  async pin(hash) {
    logging.verbose(`Pinning object ${hash} to local storage`);
    const ipfs = await this.client();
    await ipfs.pin.add(hash);
  }
}

module.exports = IpfsStorage;
