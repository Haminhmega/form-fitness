/** Casiez et al. (2012). Timestamps are seconds; callers retain confidence gates.
 * Filtering reduces jitter, but cannot recover occluded joints or guarantee peaks.
 */
export class OneEuroFilter {
  private time: number | undefined;
  private raw = 0;
  private value = 0;
  private derivative = 0;
  constructor(readonly minCutoff = 1.2, readonly beta = .04, readonly dCutoff = 1) {
    if (![minCutoff, beta, dCutoff].every(Number.isFinite) || minCutoff <= 0 || beta < 0 || dCutoff <= 0) throw new Error('Invalid One Euro settings');
  }
  reset() { this.time = undefined; this.derivative = 0; }
  filter(value: number, time: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(time)) { this.reset(); return NaN; }
    if (this.time === undefined || time <= this.time || time - this.time > .4) {
      this.time = time; this.raw = this.value = value; this.derivative = 0; return value;
    }
    const dt = time - this.time;
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.derivative += alpha(this.dCutoff) * ((value - this.raw) / dt - this.derivative);
    this.value += alpha(this.minCutoff + this.beta * Math.abs(this.derivative)) * (value - this.value);
    this.raw = value; this.time = time;
    return this.value;
  }
}
