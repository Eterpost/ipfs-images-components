'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { useTestConfig } = require('./helpers');

useTestConfig();
const { sharpUnsupportedReason } = require('../components/sharp-support');

describe('sharpUnsupportedReason', () => {
  it('should refuse sharp on x86-64 without SSE4.2', () => {
    const reason = sharpUnsupportedReason({
      arch: 'x64', cpuinfo: 'flags\t\t: fpu sse sse2 popcnt', platform: 'linux',
    });
    assert.match(reason, /SSE4\.2/);
  });

  it('should allow sharp with SSE4.2 or on other systems', () => {
    assert.equal(sharpUnsupportedReason({
      arch: 'x64', cpuinfo: 'flags\t\t: fpu sse4_1 sse4_2 popcnt', platform: 'linux',
    }), null);
    assert.equal(sharpUnsupportedReason({ arch: 'arm64', cpuinfo: '', platform: 'linux' }), null);
    assert.equal(sharpUnsupportedReason({ arch: 'x64', cpuinfo: '', platform: 'darwin' }), null);
  });
});
