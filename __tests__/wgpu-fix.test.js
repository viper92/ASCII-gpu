const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadWgpuFix(context) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'wgpu-fix.js'), 'utf8');
  vm.runInContext(code, context, { filename: 'wgpu-fix.js' });
}

test('setupWebGPU prefers window.requestWebGPUAdapter when available', async () => {
  let helperCalls = 0;
  const adapter = { requestDevice: async () => ({}) };
  const context = vm.createContext({
    window: {
      requestWebGPUAdapter: async () => {
        helperCalls += 1;
        return adapter;
      }
    },
    navigator: {
      gpu: {
        requestAdapter: async () => {
          throw new Error('should not be called when helper exists');
        },
        getPreferredCanvasFormat: () => 'rgba8unorm'
      }
    },
    document: { createElement: () => ({ getContext: () => null }) }
  });

  loadWgpuFix(context);

  const canvas = {
    getContext: () => ({ configure: () => {} })
  };

  await context.window.WGPUFix.setupWebGPU(canvas);
  assert.equal(helperCalls, 1);
});
