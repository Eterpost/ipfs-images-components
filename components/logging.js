'use strict';

const winston = require('winston');

const settings = require('./settings');

const LEVELS = ['error', 'warn', 'info', 'verbose', 'debug'];

/**
 * Обёртка над журналом winston: добавляет имя модуля к сообщениям.
 */
class WinstonLoggerWrapper {
  /**
   * @param {winston.Logger} logger - Журнал winston
   * @param {string} [moduleName] - Имя модуля
   */
  constructor(logger, moduleName = '') {
    this.logger = logger;
    this.moduleName = moduleName;
    for (const level of LEVELS) {
      this[level] = this.log.bind(this, level);
    }
  }

  /**
   * @param {string} moduleName - Имя модуля
   * @return {WinstonLoggerWrapper} Журнал для модуля
   */
  getWrapperForModule(moduleName) {
    return new WinstonLoggerWrapper(this.logger, moduleName);
  }

  /**
   * @param {string} level - Уровень
   * @param {...*} messages - Сообщения и ошибки
   */
  log(level, ...messages) {
    const message = messages.map(handleMessage).join(' ');
    const moduleInfo = this.moduleName ? `[${this.moduleName}] ` : '';
    this.logger.log(level, `${moduleInfo}${message}`);
  }
}

const lineFormat = winston.format.printf(({ level, message }) =>
  `${new Date().toLocaleString('ru-RU')} [${level.toUpperCase()}]: ${message}`);

/**
 * @param {Object[]} transportsJson - Транспорты из настроек (console, file)
 * @return {winston.transport[]}
 */
function createTransports(transportsJson = []) {
  const transports = [];
  for (const transport of transportsJson) {
    if (transport.type === 'console') {
      transports.push(new winston.transports.Console({ level: transport.level }));
    } else if (transport.type === 'file') {
      transports.push(new winston.transports.File({
        filename: transport.path, level: transport.level,
      }));
    }
  }
  return transports;
}

/**
 * @param {*} message - Сообщение или ошибка
 * @return {string}
 */
function handleMessage(message) {
  if (message instanceof Error) {
    return message.toString() + ' at: ' + message.stack;
  }
  return String(message);
}

const transports = createTransports(settings.logging && settings.logging.transports);
const logger = new WinstonLoggerWrapper(winston.createLogger({
  format: lineFormat,
  level: 'debug',
  // Без транспортов winston предупреждает при каждой записи
  silent: transports.length === 0,
  transports,
}));

module.exports = logger;
