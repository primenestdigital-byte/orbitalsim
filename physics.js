// OrbitalSim physics core: velocity-Verlet N-body integration with
// momentum-conserving collision merges. Bodies live in flat typed arrays
// so 1000+ particles stay inside a 16ms frame budget.

const G = 2000;         // gravitational constant (px^3 / (mass * s^2))
const SOFTENING = 8;    // Plummer softening (px) — tames close encounters
const MERGE_OVERLAP = 1.0; // merge only on true surface overlap

export function radiusFromMass(m) {
  return 1.5 + Math.cbrt(m) * 1.2;
}

export class Simulation {
  constructor(capacity = 4096) {
    this.capacity = capacity;
    this.count = 0;
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vy = new Float64Array(capacity);
    this.ax = new Float64Array(capacity);
    this.ay = new Float64Array(capacity);
    this.axOld = new Float64Array(capacity);
    this.ayOld = new Float64Array(capacity);
    this.m = new Float64Array(capacity);
    this.r = new Float64Array(capacity);
    this.hue = new Float32Array(capacity);
    this.merges = 0;
  }

  addBody(x, y, vx, vy, m, hue) {
    if (this.count >= this.capacity) this._grow();
    const i = this.count++;
    this.x[i] = x;  this.y[i] = y;
    this.vx[i] = vx; this.vy[i] = vy;
    this.ax[i] = 0; this.ay[i] = 0;
    this.m[i] = m;
    this.r[i] = radiusFromMass(m);
    this.hue[i] = hue;
    return i;
  }

  _grow() {
    const cap = this.capacity * 2;
    const copy = (old) => {
      const a = new old.constructor(cap);
      a.set(old);
      return a;
    };
    for (const key of ['x','y','vx','vy','ax','ay','axOld','ayOld','m','r','hue']) {
      this[key] = copy(this[key]);
    }
    this.capacity = cap;
  }

  clear() {
    this.count = 0;
    this.merges = 0;
  }

  // O(n^2) symmetric pair loop; softened Newtonian gravity.
  computeAccelerations() {
    const n = this.count;
    const { x, y, m, ax, ay } = this;
    ax.fill(0, 0, n);
    ay.fill(0, 0, n);
    const eps2 = SOFTENING * SOFTENING;
    for (let i = 0; i < n; i++) {
      const xi = x[i], yi = y[i], mi = m[i];
      let axi = 0, ayi = 0;
      for (let j = i + 1; j < n; j++) {
        const dx = x[j] - xi;
        const dy = y[j] - yi;
        const d2 = dx * dx + dy * dy + eps2;
        const inv = 1 / (d2 * Math.sqrt(d2));
        const f = G * inv;
        axi += f * m[j] * dx;
        ayi += f * m[j] * dy;
        ax[j] -= f * mi * dx;
        ay[j] -= f * mi * dy;
      }
      ax[i] += axi;
      ay[i] += ayi;
    }
  }

  // One velocity-Verlet step (assumes ax/ay hold the accelerations from the
  // end of the previous step; recomputes them for the next).
  step(dt) {
    const n = this.count;
    const { x, y, vx, vy, ax, ay, axOld, ayOld } = this;
    const half = 0.5 * dt * dt;
    for (let i = 0; i < n; i++) {
      x[i] += vx[i] * dt + ax[i] * half;
      y[i] += vy[i] * dt + ay[i] * half;
      axOld[i] = ax[i];
      ayOld[i] = ay[i];
    }
    this.computeAccelerations();
    const k = 0.5 * dt;
    for (let i = 0; i < n; i++) {
      vx[i] += (axOld[i] + ax[i]) * k;
      vy[i] += (ayOld[i] + ay[i]) * k;
    }
    this._handleCollisions();
  }

  // Merge overlapping bodies (momentum + mass conserving), then compact arrays.
  _handleCollisions() {
    const n = this.count;
    const { x, y, vx, vy, m, r } = this;
    const dead = new Uint8Array(n);
    let merged = 0;
    for (let i = 0; i < n; i++) {
      if (dead[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (dead[j]) continue;
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const rad = (r[i] + r[j]) * MERGE_OVERLAP;
        if (dx * dx + dy * dy < rad * rad) {
          // heaviest body absorbs the other
          const a = m[i] >= m[j] ? i : j;
          const b = a === i ? j : i;
          const M = m[a] + m[b];
          const wa = m[a] / M, wb = m[b] / M;
          x[a] = x[a] * wa + x[b] * wb;
          y[a] = y[a] * wa + y[b] * wb;
          vx[a] = vx[a] * wa + vx[b] * wb;
          vy[a] = vy[a] * wa + vy[b] * wb;
          m[a] = M;
          r[a] = radiusFromMass(M);
          dead[b] = 1;
          merged++;
        }
      }
    }
    if (merged === 0) return;
    this.merges += merged;
    // compact: move every live body into the next free slot
    const keys = ['x','y','vx','vy','ax','ay','axOld','ayOld','m','r','hue'];
    let w = 0;
    for (let i = 0; i < n; i++) {
      if (dead[i]) continue;
      if (i !== w) {
        for (const k of keys) this[k][w] = this[k][i];
      }
      w++;
    }
    this.count = w;
    this.computeAccelerations(); // accelerations now reference stale bodies
  }

  // Total mass at origin-relative center of momentum, for preset builders.
  static circularSpeed(centralMass, radius) {
    return Math.sqrt((G * centralMass) / radius);
  }
}

export { G };
