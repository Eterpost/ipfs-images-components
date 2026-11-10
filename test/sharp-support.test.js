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

describe('chooseSharp', () => {
  const { chooseSharp } = require('../components/sharp-support');
  const oldCpu = { arch: 'x64', cpuinfo: 'flags : sse2', platform: 'linux' };

  function fakeRequire(available) {
    const calls = [];
    const fn = (id) => {
      calls.push(id);
      if (!available.includes(id)) {
        const error = new Error(`Cannot find module '${id}'`);
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      }
      return `sharp from ${id}`;
    };
    return { calls, fn };
  }

  it('should take the system package even on an old CPU', () => {
    const req = fakeRequire(['/usr/lib/node_modules/sharp', 'sharp']);
    const { sharp } = chooseSharp(['/usr/lib/node_modules/sharp'], req.fn, oldCpu);
    assert.equal(sharp, 'sharp from /usr/lib/node_modules/sharp');
  });

  it('should not load a prebuilt npm sharp on a CPU without SSE4.2', () => {
    const req = fakeRequire(['sharp']);
    const { reason, sharp } = chooseSharp(['/usr/lib/node_modules/sharp'], req.fn, oldCpu);
    assert.equal(sharp, null);
    assert.match(reason, /SSE4\.2/);
    assert.deepEqual(req.calls, ['/usr/lib/node_modules/sharp']);
  });

  it('should fall back to npm sharp on a capable CPU', () => {
    const req = fakeRequire(['sharp']);
    const { sharp } = chooseSharp(['/usr/lib/node_modules/sharp'], req.fn, {
      ...oldCpu, cpuinfo: 'flags : sse4_2',
    });
    assert.equal(sharp, 'sharp from sharp');
  });

  it('should explain that sharp is not installed', () => {
    const req = fakeRequire([]);
    const { reason, sharp } = chooseSharp(['/usr/lib/node_modules/sharp'], req.fn, {
      ...oldCpu, cpuinfo: 'sse4_2',
    });
    assert.equal(sharp, null);
    assert.match(reason, /not installed/);
  });
});
