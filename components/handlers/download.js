'use strict';

const { pipeline } = require('node:stream/promises');

const { FileNotFoundError } = require('../errors');
const logging = require('../logging').getWrapperForModule('download');
const { fileHeaders, isCached } = require('./headers');

/**
 * Обработчик GET /<base-url>/:hash/:filename. Имя в адресе — для людей и
 * почтовых программ, файл ищется только по хешу.
 * @param {Object} storage - Хранилище
 * @param {Object} metadataStorage - Метаданные
 * @param {{CACHE_DURATION: number}} options - Параметры
 * @return {Function} Обработчик Express
 */
module.exports = function (storage, metadataStorage, options) {
  const CACHE_DURATION = options.CACHE_DURATION;
  return async function (request, response) {
    const hash = request.params.hash;
    const etag = `"${hash}"`;
    try {
      const record = await metadataStorage.getRecord(hash);
      const headers = fileHeaders(etag, CACHE_DURATION);
      if (isCached(request, etag)) {
        response.writeHead(304, headers).end();
        return;
      }
      const stream = await storage.get(hash);
      response.writeHead(200, {
        ...headers,
        'Content-Type': record.mimetype || 'application/octet-stream',
      });
      await pipeline(stream, response);
    } catch (error) {
      sendError(response, error, logging);
    }
  };
};

/**
 * @param {import('express').Response} response - Ответ
 * @param {Error} error - Ошибка
 * @param {Object} log - Журнал
 */
function sendError(response, error, log) {
  if (response.headersSent) {
    log.error(error);
    response.destroy(error);
  } else if (error instanceof FileNotFoundError) {
    response.sendStatus(404);
  } else {
    log.error(error);
    response.sendStatus(500);
  }
}

module.exports.sendError = sendError;
