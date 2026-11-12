// Blink trigger from MediaPipe face blendshapes (eyeBlinkLeft / eyeBlinkRight, 0..1).
//
// - Fires once when both eyes close (a one-eyed wink doesn't count).
// - Hysteresis: the eyes must open again before the next shot.
// - Adapts to your resting eye openness, since some faces (or looking down at a
//   laptop) sit at a higher "blink" score even with eyes open.
// - Short cooldown so one blink can never double-fire.
export class BlinkDetector {
  constructor({ cooldownMs = 250 } = {}) {
    this.cooldownMs = cooldownMs;
    this.closed = false;
    this.lastFire = -Infinity;
    this.baseline = 0.1; // resting score with eyes open
    this.score = 0; // latest combined score, for display
  }

  /** Feed one tracking result. Returns true on the frame a blink starts. */
  update(blendshapes, now) {
    if (!blendshapes?.length) return false;
    let l = 0;
    let r = 0;
    for (const c of blendshapes) {
      if (c.categoryName === 'eyeBlinkLeft') l = c.score;
      else if (c.categoryName === 'eyeBlinkRight') r = c.score;
    }
    const s = Math.min(l, r); // both eyes must close
    this.score = s;

    if (!this.closed) this.baseline = Math.min(0.4, this.baseline + (s - this.baseline) * 0.02);
    const closeAt = Math.max(0.45, this.baseline + 0.3);
    const openAt = Math.max(0.25, this.baseline + 0.12);

    if (!this.closed && s > closeAt) {
      this.closed = true;
      if (now - this.lastFire > this.cooldownMs) {
        this.lastFire = now;
        return true;
      }
    } else if (this.closed && s < openAt) {
      this.closed = false;
    }
    return false;
  }

  reset() {
    this.closed = false;
  }
}
