'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { detectImageType } = require('../components/file-type');
const { GIF, HTML, JPEG, PNG, SVG, WEBP } = require('./images');

describe('detectImageType', () => {
  it('should recognise images by their signatures', () => {
    assert.equal(detectImageType(PNG), 'image/png');
    assert.equal(detectImageType(JPEG), 'image/jpeg');
    assert.equal(detectImageType(GIF), 'image/gif');
    assert.equal(detectImageType(WEBP), 'image/webp');
  });

  it('should not recognise HTML, SVG or short data', () => {
    assert.equal(detectImageType(HTML), null);
    assert.equal(detectImageType(SVG), null);
    assert.equal(detectImageType(Buffer.from([0xff])), null);
  });
});
