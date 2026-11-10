'use strict';

const { FileNotFoundError } = require('../errors');
const logging = require('../logging').getWrapperForModule('del_attachment');

/**
 * Обработчик DELETE /<base-url>/:hash: удаляет файл и его метаданные.
 * @param {Object} storage - Хранилище
 * @param {Object} metadataStorage - Метаданные
 * @return {Function} Обработчик Express
 */
module.exports = function (storage, metadataStorage) {
  return async function (request, response) {
    const hash = request.params.hash;
    try {
      await storage.delete(hash);
      await metadataStorage.delRecord(hash);
      response.sendStatus(200);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        response.sendStatus(404);
      } else {
        logging.error(error);
        response.sendStatus(500);
      }
    }
  };
};
