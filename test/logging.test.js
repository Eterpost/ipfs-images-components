'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { useTestConfig } = require('./helpers');

useTestConfig();
const logging = require('../components/logging');

describe('logging', () => {
  it('should give a logger for a module with all levels', () => {
    const logger = logging.getWrapperForModule('test');
    for (const level of ['error', 'warn', 'info', 'verbose', 'debug']) {
      assert.equal(typeof logger[level], 'function');
    }
    logger.info('message', new Error('error'));
  });
});
