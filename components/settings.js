'use strict';

const fs = require('node:fs');

/**
 * Путь к конфигурации: IPFS_IMAGES_CONFIG или config.json в рабочем каталоге
 * @return {string}
 */
function defaultPath() {
  return process.env.IPFS_IMAGES_CONFIG || 'config.json';
}

/**
 * Читает конфигурацию из JSON-файла.
 * @param {string} file - Путь к файлу
 * @return {Object} Настройки
 */
function parseJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, { encoding: 'utf8' });
  } catch {
    throw new Error(`You need to supply config.json in project root ` +
      `(or set IPFS_IMAGES_CONFIG), see config.json.example: ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Config must be a valid JSON document.');
  }
}

const settings = {};

/**
 * Перечитывает настройки в тот же объект: модули, получившие его через
 * require, видят новые значения
 * @param {string} [file] - Путь к файлу
 */
function load(file = defaultPath()) {
  const parsed = parseJson(file);
  for (const key of Object.keys(settings)) {
    delete settings[key];
  }
  Object.assign(settings, parsed);
}

Object.defineProperty(settings, 'load', { enumerable: false, value: load });
load();

module.exports = settings;
