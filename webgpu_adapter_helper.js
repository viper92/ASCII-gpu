(function(global){
  if (!global) return;

  const defaultAttempts = Object.freeze([
    { powerPreference: 'high-performance' },
    { powerPreference: 'low-power' },
    null,
    { forceFallbackAdapter: true }
  ]);

  async function requestWebGPUAdapter(customAttempts) {
    const hasNavigator = typeof navigator === 'object' && navigator !== null;
    if (!hasNavigator || !('gpu' in navigator)) return null;

    const attempts = Array.isArray(customAttempts) && customAttempts.length
      ? customAttempts
      : defaultAttempts;

    let lastError = null;
    for (const opts of attempts) {
      try {
        const adapter = opts ? await navigator.gpu.requestAdapter(opts) : await navigator.gpu.requestAdapter();
        if (adapter) {
          if (opts && opts.forceFallbackAdapter) {
            console.info('[WebGPU] using fallback adapter');
          } else if (opts && opts.powerPreference) {
            console.info(`[WebGPU] adapter obtained with powerPreference="${opts.powerPreference}"`);
          }
          return adapter;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    return null;
  }

  if (!global.requestWebGPUAdapter) {
    global.requestWebGPUAdapter = requestWebGPUAdapter;
  }
  global.__webgpuAdapterAttempts = defaultAttempts;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : undefined));
