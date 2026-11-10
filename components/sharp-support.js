'use strict';

const fs = require('node:fs');

const logging = require('./logging').getWrapperForModule('sharp');
const settings = require('./settings');

/**
 * Где искать sharp из пакета ALT (собран из исходников с системной libvips).
 * thumbnails.sharpPath в настройках заменяет этот список
 */
const SYSTEM_SHARP_PATHS = ['/usr/lib/node_modules/sharp'];

/**
 * Почему sharp из npm здесь не запустить. Его готовые сборки libvips для
 * x86-64 требуют x86-64-v2 (SSE4.2): на старом процессоре процесс падает с
 * SIGILL прямо при загрузке модуля, и перехватить это нельзя.
 * @param {{platform: string, arch: string, cpuinfo: string}} system - Система
 * @return {string|null} Причина или null, если можно
 */
function sharpUnsupportedReason({ platform, arch, cpuinfo }) {
  if (platform === 'linux' && arch === 'x64' && !/\bsse4_2\b/.test(cpuinfo)) {
    return 'the CPU lacks SSE4.2 (x86-64-v2) required by the prebuilt sharp';
  }
  return null;
}

/**
 * @param {Error} error - Ошибка require
 * @param {string} id - Что загружали
 * @return {boolean} Модуля просто нет
 */
function isMissing(error, id) {
  return error.code === 'MODULE_NOT_FOUND' && error.message.includes(`'${id}'`);
}

/**
 * Выбирает sharp: сначала системный (пакет ALT), затем из npm — только если
 * процессор подходит для его готовой сборки.
 * @param {string[]} systemPaths - Пути к системному sharp
 * @param {function(string): *} requireFn - require
 * @param {{platform: string, arch: string, cpuinfo: string}} system - Система
 * @return {{sharp: *, reason: string|null}}
 */
function chooseSharp(systemPaths, requireFn, system) {
  for (const id of systemPaths) {
    try {
      return { reason: null, sharp: requireFn(id) };
    } catch (error) {
      if (!isMissing(error, id)) {
        throw error;
      }
    }
  }
  const reason = sharpUnsupportedReason(system);
  if (reason) {
    return { reason, sharp: null };
  }
  try {
    return { reason: null, sharp: requireFn('sharp') };
  } catch (error) {
    if (!isMissing(error, 'sharp')) {
      throw error;
    }
  }
  return {
    reason: `sharp is not installed (system package: ${systemPaths.join(', ')})`,
    sharp: null,
  };
}

/**
 * @return {string} /proc/cpuinfo или пусто
 */
function readCpuinfo() {
  if (process.platform !== 'linux') {
    return '';
  }
  try {
    return fs.readFileSync('/proc/cpuinfo', 'utf8');
  } catch {
    // без /proc/cpuinfo считаем, что процессор подходит
    return 'sse4_2';
  }
}

let cached;

/**
 * sharp для превью или null (один раз пишет причину в журнал).
 * @return {Function|null}
 */
function loadSharp() {
  if (cached !== undefined) {
    return cached;
  }
  const configured = settings.thumbnails && settings.thumbnails.sharpPath;
  const paths = configured ? [].concat(configured) : SYSTEM_SHARP_PATHS;
  const { reason, sharp } = chooseSharp(paths, require, {
    arch: process.arch, cpuinfo: readCpuinfo(), platform: process.platform,
  });
  if (reason) {
    logging.warn(`Thumbnails are off: ${reason}`);
  }
  cached = sharp;
  return cached;
}

module.exports = { chooseSharp, loadSharp, sharpUnsupportedReason, SYSTEM_SHARP_PATHS };
