'use strict';

/**
 * Типы, которые узнаются по первым байтам. Если клиент заявил один из них,
 * а содержимое ему не соответствует, файл не принимается
 */
const SIGNATURE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const DEFAULT_ALLOWED_TYPES = SIGNATURE_TYPES;

/**
 * Тип картинки по сигнатуре в начале файла.
 * @param {Buffer} head - Первые байты файла (хватает 12)
 * @return {string|null} MIME-тип или null
 */
function detectImageType(head) {
  const starts = (bytes, offset = 0) =>
    head.length >= offset + bytes.length &&
    head.subarray(offset, offset + bytes.length).equals(Buffer.from(bytes));
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (starts([0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (starts(Buffer.from('GIF87a')) || starts(Buffer.from('GIF89a'))) {
    return 'image/gif';
  }
  if (starts(Buffer.from('RIFF')) && starts(Buffer.from('WEBP'), 8)) {
    return 'image/webp';
  }
  return null;
}

/**
 * Тип загруженного файла: по сигнатуре, иначе заявленный клиентом — если это
 * не тип картинки, который сигнатура должна была подтвердить.
 * @param {Buffer} head - Первые байты файла
 * @param {string} [declared] - Content-Type части формы
 * @return {string|null}
 */
function resolveType(head, declared) {
  const detected = detectImageType(head);
  if (detected) {
    return detected;
  }
  const type = (declared || '').split(';')[0].trim().toLowerCase();
  if (!type || SIGNATURE_TYPES.includes(type)) {
    return null;
  }
  return type;
}

module.exports = { DEFAULT_ALLOWED_TYPES, detectImageType, resolveType, SIGNATURE_TYPES };
