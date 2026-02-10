const { afterEach, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'webgl-perf.js');

function createMockVideo() {
  return {
    videoWidth: 2,
    videoHeight: 2,
    readyState: 2
  };
}

function createMockGl(elapsedNs = 40_000_000) {
  const createdQueries = [];
  const deletedQueries = [];
  const texImageCalls = [];
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
    texImageCalls,
    deletedQueries,
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: (...args) => texImageCalls.push(args),
    texSubImage2D: () => {},
    getExtension: (name) => (name === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    createQuery: () => {
      const query = {};
      createdQueries.push(query);
      return query;
    },
    beginQuery: () => {},
    endQuery: () => {},
    deleteQuery: (query) => deletedQueries.push(query),
    getQueryParameter: (query, param) => {
      if (!createdQueries.includes(query)) return null;
      if (param === 'QUERY_RESULT_AVAILABLE') return true;
      if (param === 'QUERY_RESULT') return elapsedNs;
      return null;
    },
    getParameter: (param) => (param === ext.GPU_DISJOINT_EXT ? false : null)
  };
}

beforeEach(() => {
  global.window = {};
  delete require.cache[modulePath];
});

afterEach(() => {
  delete global.window;
  delete require.cache[modulePath];
});

test('increases sampling when GPU time exceeds target budget', () => {
  const state = { sample: 2 };
  const setStateCalls = [];
  const mockGl = createMockGl();

  const getState = () => ({ ...state });
  const setState = (update) => {
    setStateCalls.push(update);
    Object.assign(state, update);
  };

  require(modulePath);
  const WebGLPerfPatch = global.window.WebGLPerfPatch;

  const patch = new WebGLPerfPatch({
    gl: mockGl,
    canvas: {},
    video: createMockVideo(),
    getState,
    setState,
    targetFps: 30,
    adaptEvery: 2
  });

  patch.step(0, {});
  patch.step(1, {});

  assert.equal(setStateCalls.length, 1);
  assert.deepEqual(setStateCalls[0], { sample: 3 });
});

test('reallocates texture when video dimensions change', () => {
  const mockGl = createMockGl();
  const video = createMockVideo();

  require(modulePath);
  const WebGLPerfPatch = global.window.WebGLPerfPatch;

  const patch = new WebGLPerfPatch({
    gl: mockGl,
    canvas: {},
    video,
    adaptEvery: 1000
  });

  patch.step(0, {});
  video.videoWidth = 4;
  video.videoHeight = 3;
  patch.step(1, {});

  assert.equal(mockGl.texImageCalls.length, 2);
});

test('does not adapt quality without a fresh GPU sample', () => {
  const state = { sample: 3 };
  const mockGl = createMockGl();
  const setStateCalls = [];

  require(modulePath);
  const WebGLPerfPatch = global.window.WebGLPerfPatch;

  const patch = new WebGLPerfPatch({
    gl: mockGl,
    canvas: {},
    video: createMockVideo(),
    getState: () => ({ ...state }),
    setState: (update) => setStateCalls.push(update),
    targetFps: 30,
    adaptEvery: 2
  });

  patch.hasFreshGpuSample = false;
  patch.frameCount = 1;
  patch.step(2, {});

  assert.equal(setStateCalls.length, 0);
});
