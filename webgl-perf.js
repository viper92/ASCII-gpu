(() => {
  class WebGLPerfPatch {
    constructor(opts) {
      this.gl = opts.gl;
      this.canvas = opts.canvas;
      this.video = opts.video;
      this.getState = opts.getState || (() => ({}));
      this.setState = opts.setState || (() => {});
      this.targetFps = opts.targetFps || 30;
      this.adaptEvery = opts.adaptEvery || 5;
      this.maxSample = opts.maxSample || 36;
      this.draw = opts.draw || (() => {});
      this.playing = false;
      this.rafId = null;
      this.vfcHandle = null;
      this.lastGpuMs = 0;
      this.hasFreshGpuSample = false;
      this.frameCount = 0;
      this.texInitialized = false;
      this.texWidth = 0;
      this.texHeight = 0;
      this._setupTexture();
      this._setupTimer();
    }
    _setupTexture() {
      const gl = this.gl;
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    _setupTimer() {
      const gl = this.gl;
      this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (this.ext) {
        this.pendingQueries = [];
      }
    }
    _drainGpuQueries() {
      if (!this.ext || !Array.isArray(this.pendingQueries) || !this.pendingQueries.length) return;
      const gl = this.gl;
      const ext = this.ext;
      const remaining = [];
      for (const query of this.pendingQueries) {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        if (!available) {
          remaining.push(query);
          continue;
        }
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (!disjoint) {
          const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);
          this.lastGpuMs = ns / 1e6;
          this.hasFreshGpuSample = true;
        }
        if (typeof gl.deleteQuery === 'function') {
          gl.deleteQuery(query);
        }
      }
      this.pendingQueries = remaining;
    }
    ensureTexture() {
      const gl = this.gl;
      const vid = this.video;
      if (!vid.videoWidth || !vid.videoHeight) return;
      const needsInit = !this.texInitialized || this.texWidth !== vid.videoWidth || this.texHeight !== vid.videoHeight;
      if (needsInit) {
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, vid.videoWidth, vid.videoHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        this.texInitialized = true;
        this.texWidth = vid.videoWidth;
        this.texHeight = vid.videoHeight;
      }
    }
    _schedule() {
      if (!this.playing) return;
      if (typeof this.video.requestVideoFrameCallback === 'function') {
        this.vfcHandle = this.video.requestVideoFrameCallback((now, meta) => this.step(now, meta));
      } else {
        this.rafId = requestAnimationFrame((t) => this.step(t, {}));
      }
    }
    step(ts, meta) {
      const gl = this.gl;
      this._drainGpuQueries();
      // update video texture
      if (this.video.readyState >= 2) {
        this.ensureTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
      }
      // begin timer
      let query = null;
      if (this.ext) {
        query = gl.createQuery();
        if (query) {
          gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
        }
      }
      // call draw callback
      if (typeof this.draw === 'function') {
        this.draw(ts, meta);
      }
      // end timer
      if (this.ext && query) {
        gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.pendingQueries.push(query);
      }
      // adaptive sampling
      this.frameCount++;
      if (this.adaptEvery > 0 && this.frameCount % this.adaptEvery === 0 && this.hasFreshGpuSample) {
        const state = this.getState();
        const sample = state && typeof state.sample === 'number' ? state.sample : 0;
        const budget = 1000 / this.targetFps;
        const ms = this.lastGpuMs || 0;
        let newSample = sample;
        if (ms > budget) {
          newSample = Math.min(this.maxSample, sample + 1);
        } else if (ms < budget * 0.6 && sample > 2) {
          newSample = sample - 1;
        }
        if (newSample !== sample) {
          this.setState({ sample: newSample });
        }
        this.hasFreshGpuSample = false;
      }
      this._schedule();
    }
    play() {
      if (this.playing) return;
      this.playing = true;
      this.ensureTexture();
      this._schedule();
    }
    pause() {
      this.playing = false;
      if (this.vfcHandle != null) {
        this.video.cancelVideoFrameCallback(this.vfcHandle);
        this.vfcHandle = null;
      }
      if (this.rafId != null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    get_lastGpuMs() {
      return this.lastGpuMs;
    }
    static init(opts) {
      const patch = new WebGLPerfPatch(opts);
      return {
        play: () => patch.play(),
        pause: () => patch.pause(),
        get_lastGpuMs: () => patch.get_lastGpuMs()
      };
    }
  }
  if (typeof window !== 'undefined') {
    window.WebGLPerfPatch = WebGLPerfPatch;
  }
})();
