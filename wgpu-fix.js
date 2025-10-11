// Helper utilities to size and configure the WebGPU canvas.
// This file defines a WGPUFix class with static methods:
//  - setupWebGPU(canvas): obtains an adapter/device, configures the canvas
//    with the preferred format, and returns the device, context and format.
//  - sizeGPUCanvas(canvas, cssW, cssH): sizes the canvas to CSS pixels
//    times the devicePixelRatio and updates its style properties.
//  - computeGridFromFont(fontPx, fontFamily, cssW, cssH): estimates
//    character metrics and how many columns/rows fit in a given CSS area.

class WGPUFix {
  static async setupWebGPU(canvas) {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported in this browser');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Unable to obtain GPU adapter');
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });
    return { device, context, format };
  }

  static sizeGPUCanvas(canvas, cssW, cssH) {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
  }

  static computeGridFromFont(fontPx, fontFamily, cssW, cssH) {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    ctx.font = fontPx + 'px ' + fontFamily;
    const chW = ctx.measureText('M').width;
    // Approximate line height as 1.0× font size; adjust as needed.
    const lineH = fontPx * 1.0;
    const cols = Math.max(1, Math.floor(cssW / chW));
    const rows = Math.max(1, Math.floor(cssH / lineH));
    return { chW, lineH, cols, rows };
  }
}

// Expose to global scope for access in HTML pages
window.WGPUFix = WGPUFix;
