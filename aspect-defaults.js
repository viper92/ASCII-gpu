// Auto aspect ratio and default sampling helper for the ASCII video player.
//
// This module computes a reasonable default sampling (pixels per character)
// and font size when a video is loaded. It ensures that the ASCII
// representation of the video fits within a given stage element without
// overflowing while preserving the original video aspect ratio. Optionally,
// it nudges the font size so that the resulting sampling approaches a
// target value (e.g. 10 px/char). After computing these defaults, it
// updates the corresponding UI inputs and dispatches events so that the
// existing logic (e.g. updateDerived) re‑runs with the new values.

class AspectDefaults {
  /**
   * Measure approximate character metrics for a given font size and family.
   * Returns an object with { chW, lineH } representing the character
   * cell width and line height in CSS pixels. Uses a temporary canvas
   * for measurement.
   *
   * @param {number} fontPx - Font size in pixels.
   * @param {string} fontFamily - CSS font family string.
   * @returns {{ chW: number, lineH: number }}
   */
  static measureFont(fontPx, fontFamily) {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    ctx.font = fontPx + 'px ' + fontFamily;
    // Use a wide character ("M") as an approximation of typical glyph width.
    const chW = ctx.measureText('M').width;
    // Approximate line height as equal to the font size. Real fonts might
    // differ, but this is sufficient for sizing calculations.
    const lineH = fontPx;
    return { chW, lineH };
  }

  /**
   * Compute a sampling value (px/char) that guarantees the ASCII frame
   * derived from the source video fits within the stage element. The
   * returned sampling is the smallest integer that satisfies both the
   * width and height constraints when mapping the video resolution to
   * character cells. Optionally, this function can adjust the font size
   * toward a desired sampling target.
   *
   * @param {Object} opts - Options for the computation.
   * @param {HTMLVideoElement} opts.video - The <video> element. Its
   *        intrinsic dimensions (videoWidth/videoHeight) are used.
   * @param {HTMLElement} opts.stageEl - Container whose clientWidth and
   *        clientHeight define the maximum CSS size for the ASCII canvas.
   * @param {HTMLInputElement} opts.fontInput - Number input for font size.
   * @param {HTMLInputElement} opts.sampleInput - Range/number input for sampling.
   * @param {HTMLSelectElement} [opts.fontFamilySel] - Select input for font family.
   * @param {HTMLInputElement} [opts.halfBlockCheckbox] - Checkbox to
   *        indicate half‑block mode (each video pixel spans two ASCII rows).
   * @param {number} [opts.targetSample=10] - Preferred sampling (px/char).
   */
  static applyAspectDefaults({ video, stageEl, fontInput, sampleInput, fontFamilySel, halfBlockCheckbox, targetSample = 10 }) {
    if (!video || !stageEl || !fontInput || !sampleInput) return;
    // Wait until fonts are loaded if the Font Loading API is available.
    const ensureFonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ensureFonts.then(() => {
      // Extract current font settings from inputs.
      const fontPx = parseFloat(fontInput.value) || 14;
      const fontFamily = fontFamilySel && fontFamilySel.value ? fontFamilySel.value : getComputedStyle(document.body).fontFamily || 'monospace';
      // Measure character metrics for the current font.
      let { chW, lineH } = AspectDefaults.measureFont(fontPx, fontFamily);
      // Stage dimensions in CSS pixels.
      const stageW = Math.max(1, stageEl.clientWidth);
      const stageH = Math.max(1, stageEl.clientHeight);
      // Video intrinsic resolution.
      const vW = video.videoWidth || 1;
      const vH = video.videoHeight || 1;
      // Adjust video height if half‑block mode is on: each block in half
      // block mode represents two vertical pixels, effectively halving the
      // required number of rows.
      const halfBlock = halfBlockCheckbox && halfBlockCheckbox.checked;
      const vHPrime = halfBlock ? vH / 2 : vH;
      // Compute the sampling (px/char) required to fit width and height.
      const widthFit = (vW * chW) / stageW;
      const heightFit = (vHPrime * chW) / stageH;
      let sampleFit = Math.ceil(Math.max(widthFit, heightFit));
      // Optionally adjust font size toward the target sampling.
      if (targetSample && targetSample > 0) {
        const ratio = chW / fontPx;
        // Ideal font size to bring sampleFit to targetSample.
        let idealFontPx = fontPx * (targetSample / sampleFit);
        // Respect the input's min and max attributes if present.
        const minPx = fontInput.min ? parseFloat(fontInput.min) : 6;
        const maxPx = fontInput.max ? parseFloat(fontInput.max) : 72;
        idealFontPx = Math.max(minPx, Math.min(maxPx, idealFontPx));
        // If the ideal font size differs, recompute metrics and sample.
        if (Math.abs(idealFontPx - fontPx) >= 0.25) {
          const measured = AspectDefaults.measureFont(idealFontPx, fontFamily);
          const newChW = measured.chW;
          // Recompute fits with new character width.
          const newWidthFit = (vW * newChW) / stageW;
          const newHeightFit = (vHPrime * newChW) / stageH;
          const newSampleFit = Math.ceil(Math.max(newWidthFit, newHeightFit));
          // Apply the new values.
          sampleFit = newSampleFit;
          chW = newChW;
          lineH = measured.lineH;
          // Update the font input.
          fontInput.value = Math.round(idealFontPx).toString();
        }
      }
      // Clamp sampleFit to the input's min/max if defined.
      const minSample = sampleInput.min ? parseFloat(sampleInput.min) : 1;
      const maxSample = sampleInput.max ? parseFloat(sampleInput.max) : 100;
      sampleFit = Math.max(minSample, Math.min(maxSample, sampleFit));
      // If the computed sample differs from the current value, update it.
      if (parseFloat(sampleInput.value) !== sampleFit) {
        sampleInput.value = sampleFit.toString();
      }
      // Update associated label if present (e.g. #scaleLabel).
      const labelId = sampleInput.id ? sampleInput.id + 'Label' : null;
      if (labelId) {
        const labelEl = document.getElementById(labelId);
        if (labelEl) {
          labelEl.textContent = sampleFit + ' px/char';
        }
      }
      // Dispatch input/change events to trigger updateDerived and other handlers.
      const dispatchEvent = (el) => {
        if (!el) return;
        const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
        const ev = new Event(eventName, { bubbles: true });
        el.dispatchEvent(ev);
      };
      dispatchEvent(fontInput);
      dispatchEvent(sampleInput);
    }).catch(() => {
      // If fonts couldn't be ensured, still dispatch events to update UI.
      const ev = new Event('input', { bubbles: true });
      sampleInput.dispatchEvent(ev);
    });
  }
}

// Expose the helper to the global scope.
window.AspectDefaults = AspectDefaults;