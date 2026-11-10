'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const { buffer } = require('node:stream/consumers');
const sharp = require('sharp');

const logging = require('./logging').getWrapperForModule('thumbnail');
const settings = require('./settings');

const THUMB_DIMENSIONS = 128;

/**
 * Превью картинок (JPEG на белом фоне), при thumbnails.cache — с кэшем на диске.
 */
class Thumbnail {
  /**
   * @param {Object} storage - Хранилище исходных файлов
   * @param {{cache?: boolean, path?: string, sizes?: number[]}} [options] -
   *   по умолчанию settings.thumbnails
   */
  constructor(storage, options = settings.thumbnails || {}) {
    this.storage = storage;
    this.cache = Boolean(options.cache);
    this.path = options.path;
    this.sizes = options.sizes || [THUMB_DIMENSIONS];
    logging.verbose(`Thumbnail cache ${this.cache ? 'enabled' : 'disabled'}`);
  }

  /**
   * @param {number} size - Запрошенный размер
   * @return {number} Он же, если разрешён, иначе 128
   */
  normalizeSize(size) {
    return this.sizes.includes(size) ? size : THUMB_DIMENSIONS;
  }

  /**
   * @param {string} hash - Хеш файла
   * @param {number} size - Размер
   * @return {string} Путь к превью в кэше
   */
  getThumbsPath(hash, size) {
    return path.join(this.path, String(size), hash.slice(0, 2), hash.slice(2, 4), hash);
  }

  /**
   * Превью; если картинку не удалось разобрать — исходный файл.
   * @param {string} hash - Хеш файла
   * @param {number} size - Размер
   * @return {Promise<{stream: Readable, type: string}>}
   */
  async serve(hash, size) {
    size = this.normalizeSize(size);
    const cachePath = this.cache ? this.getThumbsPath(hash, size) : null;
    if (cachePath) {
      try {
        const cached = await fsp.readFile(cachePath);
        logging.verbose(`Serving thumbnail for ${hash} from cache`);
        return { stream: Readable.from([cached]), type: 'image/jpeg' };
      } catch {
        // нет в кэше — создаём
      }
    }
    const original = await buffer(await this.storage.get(hash));
    let thumb;
    try {
      thumb = await this.create(original, size);
    } catch (error) {
      logging.verbose(`Failed to create ${size}x${size} thumbnail for ${hash}: ${error.message}`);
      return { stream: Readable.from([original]), type: 'application/octet-stream' };
    }
    if (cachePath) {
      await fsp.mkdir(path.dirname(cachePath), { recursive: true });
      await fsp.writeFile(cachePath, thumb);
    }
    return { stream: Readable.from([thumb]), type: 'image/jpeg' };
  }

  /**
   * @param {Buffer} image - Исходная картинка
   * @param {number} size - Размер
   * @return {Promise<Buffer>} JPEG не больше size×size
   */
  create(image, size) {
    return sharp(image)
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg()
      .toBuffer();
  }
}

module.exports = Thumbnail;
