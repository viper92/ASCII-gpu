
/* webgpu_mobile_patch.js — drop-in helper for Android + WebGPU
   Usage: <script src="webgpu_mobile_patch.js" defer></script>
*/
(function(){
  function showBanner(msg){
    var id = 'wgpuBanner';
    var el = document.getElementById(id);
    if(!el){
      var style = document.createElement('style');
      style.textContent = '.wgpuBanner{position:fixed;top:0;left:0;right:0;z-index:9999;background:#12233a;color:#cde1ff;border-bottom:1px solid #2b63d3;padding:10px 14px;font:12px ui-sans-serif,system-ui;display:none} .wgpuBanner b{color:#fff} .wgpuBanner code{background:#0f1a2b;padding:1px 4px;border-radius:4px}';
      document.head.appendChild(style);
      el = document.createElement('div');
      el.id = id;
      el.className = 'wgpuBanner';
      document.body.appendChild(el);
    }
    el.innerHTML = msg;
    el.style.display = 'block';
  }

  // Secure-context guard
  var isSecure = (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  if(!isSecure){
    showBanner('<b>WebGPU disabled:</b> This page is not running over <b>HTTPS</b>. Host it on GitHub Pages/Netlify or use <code>http://localhost</code>.');
    return;
  }

  // If WebGPU exists, prefer it on mobile
  var wantGPU = ('gpu' in navigator);
  var useWebGPU = document.getElementById('useWebGPU');
  var useWebGL = document.getElementById('useWebGL');
  var usePre   = document.getElementById('usePre');

  if (wantGPU && useWebGPU) {
    useWebGPU.checked = true;
    if (useWebGL) useWebGL.checked = false;
    if (usePre)   usePre.checked   = false;
    try { window.restartBackend && window.restartBackend(); } catch{}
  }

  // Make play more reliable on mobile
  var video = document.getElementById('video') || document.querySelector('video');
  if (video) {
    video.muted = true; // allow autoplay after a gesture
    video.playsInline = true;
    document.getElementById('stage')?.addEventListener('click', function(){
      video.play().catch(function(){});
    }, { once: true });
    video.addEventListener('loadedmetadata', function(){
      try { window.updateDerived && window.updateDerived(); } catch {}
      try { window.restartBackend && window.restartBackend(); } catch {}
    });
  }

  // Small adapter sanity check
  const requestWebGPUAdapter = (typeof window === 'object' && window && typeof window.requestWebGPUAdapter === 'function')
    ? window.requestWebGPUAdapter
    : null;

  async function findAdapter(){
    if (!wantGPU) return null;
    if (requestWebGPUAdapter) {
      return requestWebGPUAdapter();
    }

    const attempts = (typeof window === 'object' && window && Array.isArray(window.__webgpuAdapterAttempts))
      ? window.__webgpuAdapterAttempts
      : [
          { powerPreference: 'high-performance' },
          { powerPreference: 'low-power' },
          null,
          { forceFallbackAdapter: true }
        ];

    let lastError = null;
    for (const opts of attempts) {
      try {
        const adapter = opts ? await navigator.gpu.requestAdapter(opts) : await navigator.gpu.requestAdapter();
        if (adapter) {
          return adapter;
        }
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) throw lastError;
    return null;
  }

  if (wantGPU) {
    (async () => {
      try {
        const ad = await findAdapter();
        if (!ad) {
          showBanner('<b>WebGPU adapter not found.</b> Your device may be blocklisted. You can try <code>chrome://flags/#enable-unsafe-webgpu</code>.');
        }
      } catch (e) {
        showBanner('<b>WebGPU init error:</b> ' + String(e && e.message || e));
      }
    })();
  } else {
    showBanner('<b>WebGPU not available.</b> Update Chrome (v121+) or check GPU support. Falling back automatically.');
  }
})();
