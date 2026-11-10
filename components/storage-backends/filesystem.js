'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const { FileNotFoundError } = require('../errors');
const logging = require('../logging').getWrapperForModule('filesystem');

const HASH_ALGORITHM = 'sha256';
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Хранилище в файловой системе: файл лежит по своему sha256
 * (<basePath>/ab/cdef...), одинаковое содержимое хранится один раз.
 */
class FilesystemStorage {
  /**
   * @param {string} basePath - Корневой каталог файлов
   */
  constructor(basePath) {
    this.basePath = basePath;
  }

  /**
   * @param {{path: string, originalFilename?: string}} file - Загруженный файл
   * @return {Promise<string>} Хеш файла
   */
  async add(file) {
    logging.verbose(`Uploading '${file.originalFilename}' to filesystem`);
    const content = await fsp.readFile(file.path);
    const hash = this.computeHash(content);
    const filePath = this.getFilePath(hash);
    if (await this.has(hash)) {
      return hash;
    }
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    // Через свой временный файл: недописанный файл не окажется под хешем, а
    // одновременные загрузки одного содержимого не мешают друг другу
    const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
      await fsp.writeFile(tmpPath, content);
      await fsp.rename(tmpPath, filePath);
    } finally {
      await fsp.rm(tmpPath, { force: true });
    }
    return hash;
  }

  /**
   * @param {string} hash - Хеш файла
   */
  async delete(hash) {
    logging.verbose(`Deleting file ${hash} from filesystem`);
    try {
      await fsp.unlink(this.getFilePath(hash));
    } catch (error) {
      throw notFound(error, hash);
    }
  }

  /**
   * @param {string} hash - Хеш файла
   * @return {Promise<import('stream').Readable>} Содержимое
   */
  async get(hash) {
    logging.verbose(`Serving attachment for ${hash} from filesystem`);
    const filePath = this.getFilePath(hash);
    try {
      await fsp.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw notFound(error, hash);
    }
    return fs.createReadStream(filePath);
  }

  /**
   * @param {string} hash - Хеш файла
   * @return {Promise<boolean>}
   */
  async has(hash) {
    try {
      await fsp.access(this.getFilePath(hash), fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {Buffer} content - Содержимое
   * @return {string} sha256 в hex
   */
  computeHash(content) {
    return crypto.createHash(HASH_ALGORITHM).update(content).digest('hex');
  }

  /**
   * Путь к файлу; не хеш — FileNotFoundError (путь за пределы basePath не строится)
   * @param {string} hash - Хеш файла
   * @return {string}
   */
  getFilePath(hash) {
    if (!HASH_PATTERN.test(hash)) {
      throw new FileNotFoundError(`Invalid hash ${hash}`);
    }
    return path.join(this.basePath, hash.slice(0, 2), hash.slice(2));
  }
}

/**
 * @param {Error} error - Ошибка файловой системы
 * @param {string} hash - Хеш
 * @return {Error}
 */
function notFound(error, hash) {
  if (error instanceof FileNotFoundError) {
    return error;
  }
  return error.code === 'ENOENT' ? new FileNotFoundError(`File ${hash} not found`) : error;
}

module.exports = FilesystemStorage;
