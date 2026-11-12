// One-euro filter: smooths jitter when you're still, stays responsive when you move.
// https://gery.casiez.net/1euro/
class OneEuro {
  constructor(minCutoff, beta, dCutoff) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.reset();
  }
  reset() {
    this.x = null;
    this.dx = 0;
    this.t = 0;
  }
  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(x, tMs) {
    if (this.x === null) {
      this.x = x;
      this.t = tMs;
      return x;
    }
    const dt = Math.max((tMs - this.t) / 1000, 1e-3);
    this.t = tMs;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * ((x - this.x) / dt - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

export class OneEuroVec3 {
  constructor({ minCutoff, beta, dCutoff }) {
    this.f = [0, 1, 2].map(() => new OneEuro(minCutoff, beta, dCutoff));
  }
  reset() {
    this.f.forEach((f) => f.reset());
  }
  /** Filters (x, y, z) and writes the result into `out` (a THREE.Vector3). */
  filter(x, y, z, tMs, out) {
    return out.set(this.f[0].filter(x, tMs), this.f[1].filter(y, tMs), this.f[2].filter(z, tMs));
  }
}
