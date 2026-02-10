const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScript(file, context) {
  const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

test('AspectDefaults.measureFont falls back when 2d context is missing', () => {
  const context = vm.createContext({
    window: {},
    document: {
      createElement: () => ({ getContext: () => null })
    }
  });

  loadScript('aspect-defaults.js', context);
  const result = context.window.AspectDefaults.measureFont(20, 'monospace');

  assert.equal(result.lineH, 20);
  assert.ok(result.chW > 0);
});

test('WGPUFix.computeGridFromFont falls back when 2d context is missing', () => {
  const context = vm.createContext({
    window: {},
    document: {
      createElement: () => ({ getContext: () => null })
    }
  });

  loadScript('wgpu-fix.js', context);
  const result = context.window.WGPUFix.computeGridFromFont(16, 'monospace', 160, 80);

  assert.ok(result.chW > 0);
  assert.equal(result.lineH, 16);
  assert.ok(result.cols >= 1);
  assert.ok(result.rows >= 1);
});
