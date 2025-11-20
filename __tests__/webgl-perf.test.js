const { afterEach, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const mockVideo = {
  videoWidth: 2,
  videoHeight: 2,
  readyState: 2
};

function createMockGl(elapsedNs = 40_000_000) {
  const query = {};
  const ext = {
    TIME_ELAPSED_EXT: 'TIME_ELAPSED_EXT',
    GPU_DISJOINT_EXT: 'GPU_DISJOINT_EXT'
  };
  return {
    TEXTURE_2D: 'TEXTURE_2D',
    LINEAR: 'LINEAR',
    CLAMP_TO_EDGE: 'CLAMP_TO_EDGE',
    RGBA: 'RGBA',
    UNSIGNED_BYTE: 'UNSIGNED_BYTE',
    QUERY_RESULT_AVAILABLE: 'QUERY_RESULT_AVAILABLE',
    QUERY_RESULT: 'QUERY_RESULT',
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    texSubImage2D: () => {},
    getExtension: (name) => (name === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    createQuery: () => query,
    beginQuery: () => {},
    endQuery: () => {},
    getQueryParameter: (q, param) => {
      if (q !== query) return null;
      if (param === 'QUERY_RESULT_AVAILABLE') return true;
      if (param === 'QUERY_RESULT') return elapsedNs;
      return null;
    },
    getParameter: (param) => (param === ext.GPU_DISJOINT_EXT ? false : null)
  };
}

beforeEach(() => {
  global.window = {};
});

afterEach(() => {
  delete global.window;
});

test('increases sampling when GPU time exceeds target budget', async () => {
  const state = { sample: 2 };
  const setStateCalls = [];
  const mockGl = createMockGl();

  const getState = () => ({ ...state });
  const setState = (update) => {
    setStateCalls.push(update);
    Object.assign(state, update);
  };

  // Load the script after the global window is available.
  require(path.join(__dirname, '..', 'webgl-perf.js'));
  const WebGLPerfPatch = global.window.WebGLPerfPatch;

  const patch = new WebGLPerfPatch({
    gl: mockGl,
    canvas: {},
    video: mockVideo,
    getState,
    setState,
    targetFps: 30,
    adaptEvery: 2
  });

  patch.step(0, {});
  await new Promise((resolve) => setTimeout(resolve, 0));

  patch.step(1, {});

  assert.equal(setStateCalls.length, 1);
  assert.deepEqual(setStateCalls[0], { sample: 3 });
});
