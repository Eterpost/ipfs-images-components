'use strict';

/**
 * Базовая ошибка компонентов: имя класса в name.
 */
class ComponentError extends Error {
  /**
   * @param {string} message - Текст ошибки
   */
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Файл или запись не найдены. */
class FileNotFoundError extends ComponentError {}

/** Тип файла не разрешён (server.allowedTypes). */
class UnsupportedTypeError extends ComponentError {}

/** Файл больше server.size. */
class FileTooLargeError extends ComponentError {}

/** Некорректный запрос: нет файла, битая форма. */
class InvalidInputError extends ComponentError {}

module.exports = {
  FileNotFoundError, FileTooLargeError, InvalidInputError, UnsupportedTypeError,
};
