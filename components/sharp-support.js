'use strict';

const fs = require('node:fs');

const logging = require('./logging').getWrapperForModule('sharp');

/**
 * Почему sharp здесь не запустить. Готовые сборки libvips для x86-64 требуют
 * x86-64-v2 (SSE4.2): на старом процессоре процесс падает с SIGILL прямо при
 * загрузке модуля, и перехватить это нельзя — проверять нужно до require.
 * @param {{platform: string, arch: string, cpuinfo: string}} system - Система
 * @return {string|null} Причина или null, если можно
 */
function sharpUnsupportedReason({ platform, arch, cpuinfo }) {
  if (platform === 'linux' && arch === 'x64' && !/\bsse4_2\b/.test(cpuinfo)) {
    return 'the CPU lacks SSE4.2 (x86-64-v2) required by the prebuilt sharp';
  }
  return null;
}

let cached;

/**
 * sharp, если его можно загрузить на этой машине, иначе null (один раз
 * пишет причину в журнал).
 * @return {Function|null}
 */
function loadSharp() {
  if (cached !== undefined) {
    return cached;
  }
  let cpuinfo = '';
  if (process.platform === 'linux') {
    try {
      cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    } catch {
      // без /proc/cpuinfo считаем, что процессор подходит
      cpuinfo = 'sse4_2';
    }
  }
  const reason = sharpUnsupportedReason({
    arch: process.arch, cpuinfo, platform: process.platform,
  });
  if (reason) {
    logging.warn(`Thumbnails are off: ${reason}`);
    cached = null;
  } else {
    cached = require('sharp');
  }
  return cached;
}

module.exports = { loadSharp, sharpUnsupportedReason };
