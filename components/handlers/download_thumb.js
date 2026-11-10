'use strict';

const { pipeline } = require('node:stream/promises');

const logging = require('../logging').getWrapperForModule('download_thumb');
const { sendError } = require('./download');
const { fileHeaders, isCached } = require('./headers');

/**
 * Обработчик GET /<base-url>/thumb/:size/:hash: превью в JPEG.
 * @param {Thumbnail} thumbnail - Превью
 * @param {Object} metadataStorage - Метаданные
 * @param {{CACHE_DURATION: number}} options - Параметры
 * @return {Function} Обработчик Express
 */
module.exports = function (thumbnail, metadataStorage, options) {
  const CACHE_DURATION = options.CACHE_DURATION;
  return async function (request, response) {
    const size = thumbnail.normalizeSize(Number(request.params.size));
    const hash = request.params.hash;
    const etag = `"${hash}-${size}"`;
    try {
      const record = await metadataStorage.getRecord(hash);
      const headers = fileHeaders(etag, CACHE_DURATION);
      if (isCached(request, etag)) {
        response.writeHead(304, headers).end();
        return;
      }
      const { stream, type } = await thumbnail.serve(hash, size);
      // Превью не сделано — отдаётся исходная картинка со своим типом
      const contentType = type === 'application/octet-stream' && record.mimetype ?
        record.mimetype : type;
      response.writeHead(200, { ...headers, 'Content-Type': contentType });
      await pipeline(stream, response);
    } catch (error) {
      sendError(response, error, logging);
    }
  };
};
