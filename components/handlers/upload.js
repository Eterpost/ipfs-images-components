'use strict';

const fsp = require('node:fs/promises');
const multiparty = require('multiparty');

const {
  FileTooLargeError, InvalidInputError, UnsupportedTypeError,
} = require('../errors');
const { DEFAULT_ALLOWED_TYPES, resolveType } = require('../file-type');
const logging = require('../logging').getWrapperForModule('upload');

const HEAD_SIZE = 16;

/**
 * Разбирает форму multipart во временные файлы.
 * @param {import('http').IncomingMessage} request - Запрос
 * @param {number} maxFilesSize - Наибольший размер файлов
 * @return {Promise<Object<string, Object[]>>} Файлы по именам полей
 */
function parseForm(request, maxFilesSize) {
  return new Promise((resolve, reject) => {
    // Немного больше лимита: превышение отличаем по размеру файла (413)
    const form = new multiparty.Form({ maxFilesSize: maxFilesSize + 1 });
    form.parse(request, (error, fields, files) => {
      if (error) {
        reject(error.statusCode === 413 ?
          new FileTooLargeError(error.message) : new InvalidInputError(error.message));
      } else {
        resolve(files);
      }
    });
  });
}

/**
 * @param {string} file - Путь
 * @return {Promise<Buffer>} Первые байты файла
 */
async function readHead(file) {
  const handle = await fsp.open(file, 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(HEAD_SIZE), 0, HEAD_SIZE, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Обработчик загрузки (POST, multipart, поле file). Ответ — {id, filename, mime}.
 * 400 — нет файла или форма битая, 413 — больше MAX_FILE_SIZE, 415 — тип не
 * из ALLOWED_TYPES (по умолчанию картинки png, jpeg, gif, webp).
 * @param {Object} storage - Хранилище
 * @param {Object} metadataStorage - Метаданные
 * @param {{MAX_FILE_SIZE: number, ALLOWED_TYPES?: string[]}} options - Параметры
 * @return {Function} Обработчик Express
 */
module.exports = function (storage, metadataStorage, options) {
  const MAX_FILE_SIZE = options.MAX_FILE_SIZE;
  const ALLOWED_TYPES = options.ALLOWED_TYPES || DEFAULT_ALLOWED_TYPES;

  return async function (request, response) {
    let files = {};
    try {
      files = await parseForm(request, MAX_FILE_SIZE);
      const file = files.file && files.file[0];
      if (!file) {
        throw new InvalidInputError('No file in the form field "file"');
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new FileTooLargeError('File is too big');
      }
      const mimetype = resolveType(await readHead(file.path), file.headers['content-type']);
      if (!mimetype || !ALLOWED_TYPES.includes(mimetype)) {
        throw new UnsupportedTypeError(`Type ${mimetype || 'unknown'} is not allowed`);
      }
      const hash = await storage.add(file);
      await metadataStorage.addRecord(hash, mimetype, file.size);
      response.json({ filename: file.originalFilename, id: hash, mime: mimetype });
    } catch (error) {
      sendError(response, error);
    } finally {
      for (const list of Object.values(files)) {
        for (const file of list) {
          await fsp.rm(file.path, { force: true });
        }
      }
    }
  };
};

/**
 * @param {import('express').Response} response - Ответ
 * @param {Error} error - Ошибка
 */
function sendError(response, error) {
  if (error instanceof InvalidInputError) {
    response.status(400).send(error.message);
  } else if (error instanceof FileTooLargeError) {
    response.status(413).send(error.message);
  } else if (error instanceof UnsupportedTypeError) {
    response.status(415).send(error.message);
  } else {
    logging.error(error);
    response.sendStatus(500);
  }
}
