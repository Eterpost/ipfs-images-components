'use strict';

/**
 * Заголовки отдачи файла: содержимое по хешу неизменно, поэтому кэш
 * публичный и immutable. nosniff и sandbox не дают браузеру выполнить
 * загруженный файл как страницу на домене сервиса
 * @param {string} etag - ETag (в кавычках)
 * @param {number} cacheDuration - max-age, секунды
 * @return {Object<string, string>}
 */
function fileHeaders(etag, cacheDuration) {
  return {
    'Cache-Control': `public, max-age=${cacheDuration}, immutable`,
    'Content-Security-Policy': 'sandbox',
    'ETag': etag,
    'X-Content-Type-Options': 'nosniff',
  };
}

/**
 * @param {import('express').Request} request - Запрос
 * @param {string} etag - ETag файла
 * @return {boolean} Клиент уже получил этот файл (If-None-Match)
 */
function isCached(request, etag) {
  const header = request.headers['if-none-match'];
  return Boolean(header) && header.split(',').some((value) => value.trim() === etag);
}

module.exports = { fileHeaders, isCached };
