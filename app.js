import { Simulation, radiusFromMass, G } from './physics.js';

// ---------- canvas setup ----------
const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d');
const trailCanvas = document.createElement('canvas');
const trailCtx = trailCanvas.getContext('2d');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = trailCanvas.width = Math.round(W * DPR);
  canvas.height = trailCanvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  trailCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  trailCtx.clearRect(0, 0, W, H);
}
window.addEventListener('resize', resize);
resize();

// ---------- simulation state ----------
const sim = new Simulation(4096);
let paused = false;
let stepOnce = false;
let trailsOn = true;
let hueShift = 0;

// ---------- presets ----------
function clearTrails() { trailCtx.clearRect(0, 0, W, H); }

const presets = {
  binary() {
    const cx = W / 2, cy = H / 2;
    const sep = Math.min(W, H) * 0.30;
    const m = 300;
    // each star orbits the barycenter: v^2 = G*m / (2*sep)
    const v = Math.sqrt((G * m) / (2 * sep));
    sim.addBody(cx - sep / 2, cy, 0, -v, m, 45);
    sim.addBody(cx + sep / 2, cy, 0, v, m, 200);
    // circumbinary planets
    const Mtot = 2 * m;
    for (let i = 0; i < 5; i++) {
      const r = sep * 2.2 + i * (sep * 0.5);
      const pv = Math.sqrt((G * Mtot) / r);
      const ang = Math.random() * Math.PI * 2;
      const pm = 0.4 + Math.random() * 1.2;
      sim.addBody(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r,
                  -Math.sin(ang) * pv, Math.cos(ang) * pv, pm, 30 + i * 35);
    }
  },

  solar() {
    const cx = W / 2, cy = H / 2;
    const starM = 4200;
    const starR = radiusFromMass(starM); // ~21 px
    sim.addBody(cx, cy, 0, 0, starM, 48);
    const maxR = Math.min(W, H) * 0.46;
    for (let i = 0; i < 7; i++) {
      const r = starR * 3 + maxR * (0.75 * (i / 6)) * (0.9 + Math.random() * 0.2);
      const v = Simulation.circularSpeed(starM, r) * (0.98 + Math.random() * 0.04);
      const ang = Math.random() * Math.PI * 2;
      const m = 0.4 + Math.random() * 1.8;
      sim.addBody(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r,
                  -Math.sin(ang) * v, Math.cos(ang) * v, m, 190 + i * 24);
    }
    // asteroid belt
    for (let i = 0; i < 300; i++) {
      const r = starR * 3.5 + Math.random() * (maxR - starR * 4.5);
      const v = Simulation.circularSpeed(starM, r) * (0.97 + Math.random() * 0.06);
      const ang = Math.random() * Math.PI * 2;
      sim.addBody(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r,
                  -Math.sin(ang) * v, Math.cos(ang) * v, 0.05 + Math.random() * 0.15, 40 + Math.random() * 30);
    }
  },

  chaos() {
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.44;
    const inner = 60;                       // keep clear of the central mass
    const central = 2500;
    sim.addBody(cx, cy, 0, 0, central, 48);
    const n = 1200;
    const GA = Math.PI * (3 - Math.sqrt(5)); // sunflower lattice: even coverage
    for (let i = 0; i < n; i++) {
      const r = inner + (R - inner) * Math.sqrt((i + 0.5) / n);
      const ang = i * GA + (Math.random() - 0.5) * 0.08;
      const v = Simulation.circularSpeed(central, r) * (0.98 + Math.random() * 0.06);
      sim.addBody(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r,
                  -Math.sin(ang) * v + (Math.random() - 0.5) * 8,
                  Math.cos(ang) * v + (Math.random() - 0.5) * 8,
                  0.05 + Math.random() * 0.25,
                  Math.random() * 360);
    }
  },
};

function loadPreset(name) {
  sim.clear();
  clearTrails();
  presets[name]();
}

// ---------- controls ----------
const massSlider = document.getElementById('mass');
const massVal = document.getElementById('massVal');
function sliderMass() {
  // 0.2 .. 5000, logarithmic
  return +(0.2 * Math.pow(25000, massSlider.value / 100)).toFixed(2);
}
function updateMassLabel() {
  const m = sliderMass();
  massVal.textContent = m >= 1000 ? (m / 1000).toFixed(1) + 'k' : m >= 10 ? Math.round(m) : m.toFixed(1);
}
massSlider.addEventListener('input', updateMassLabel);
updateMassLabel();

document.getElementById('preset-binary').addEventListener('click', () => loadPreset('binary'));
document.getElementById('preset-solar').addEventListener('click', () => loadPreset('solar'));
document.getElementById('preset-chaos').addEventListener('click', () => loadPreset('chaos'));

const pauseBtn = document.getElementById('pause');
function setPaused(p) {
  paused = p;
  pauseBtn.textContent = p ? 'Resume' : 'Pause';
}
pauseBtn.addEventListener('click', () => setPaused(!paused));
document.getElementById('step').addEventListener('click', () => { stepOnce = true; });
document.getElementById('reset').addEventListener('click', () => loadPreset(currentPreset));

document.getElementById('trails').addEventListener('change', (e) => {
  trailsOn = e.target.checked;
  if (!trailsOn) clearTrails();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
  else if (e.code === 'Period' || e.code === 'ArrowRight') stepOnce = true;
  else if (e.key === 'r' || e.key === 'R') loadPreset(currentPreset);
});

// ---------- drag-to-launch input ----------
let drag = null; // {x0, y0, x1, y1}
function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
canvas.addEventListener('pointerdown', (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic/invalid pointerId */ }
  const p = pointerPos(e);
  drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = pointerPos(e);
  drag.x1 = p.x; drag.y1 = p.y;
});
canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  const m = sliderMass();
  const hue = (massSlider.value * 3.6 + hueShift) % 360;
  // drag vector -> launch velocity (drag length * 2.2 px/s per px)
  sim.addBody(drag.x0, drag.y0, (drag.x1 - drag.x0) * 2.2, (drag.y1 - drag.y0) * 2.2, m, hue);
  hueShift += 47;
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });

// ---------- rendering ----------
function drawBodies(c, drawR) {
  const n = sim.count;
  const { x, y, r, hue } = sim;
  for (let i = 0; i < n; i++) {
    c.fillStyle = `hsl(${hue[i]}, 85%, 62%)`;
    const rad = drawR ? drawR(r[i]) : r[i];
    c.beginPath();
    c.arc(x[i], y[i], rad, 0, 6.2832);
    c.fill();
  }
}

function render() {
  // trail layer: fade previous frame, stamp dots
  if (trailsOn) {
    trailCtx.save();
    trailCtx.globalCompositeOperation = 'destination-out';
    trailCtx.fillStyle = 'rgba(0,0,0,0.045)';
    trailCtx.fillRect(0, 0, W, H);
    trailCtx.restore();
    drawBodies(trailCtx, (r) => Math.max(1, r * 0.55));
  }

  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);
  if (trailsOn) ctx.drawImage(trailCanvas, 0, 0, W, H);
  drawBodies(ctx);

  // drag preview: body + launch arrow
  if (drag) {
    const m = sliderMass();
    const rad = radiusFromMass(m);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(drag.x0, drag.y0, rad, 0, 6.2832);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,168,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(drag.x0, drag.y0);
    ctx.lineTo(drag.x1, drag.y1);
    ctx.stroke();
    // arrowhead
    const dx = drag.x1 - drag.x0, dy = drag.y1 - drag.y0;
    const len = Math.hypot(dx, dy);
    if (len > 8) {
      const ux = dx / len, uy = dy / len;
      ctx.beginPath();
      ctx.moveTo(drag.x1, drag.y1);
      ctx.lineTo(drag.x1 - (ux * 12 - uy * 6), drag.y1 - (uy * 12 + ux * 6));
      ctx.moveTo(drag.x1, drag.y1);
      ctx.lineTo(drag.x1 - (ux * 12 + uy * 6), drag.y1 - (uy * 12 - ux * 6));
      ctx.stroke();
    }
  }
}

// ---------- main loop ----------
const DT = 1 / 120;        // fixed physics step
const SUBSTEPS = 2;        // 2 x 1/120s per 60fps frame
let currentPreset = 'solar';
let last = performance.now();
let fpsEMA = 60;
let statTick = 0;

const statFps = document.getElementById('stat-fps');
const statBodies = document.getElementById('stat-bodies');
const statMerges = document.getElementById('stat-merges');

function updateStats() {
  statFps.textContent = 'fps ' + Math.round(fpsEMA);
  statBodies.textContent = 'bodies ' + sim.count;
  statMerges.textContent = 'merges ' + sim.merges;
}

function frame(now) {
  const rawDt = Math.min((now - last) / 1000, 0.05);
  last = now;
  fpsEMA += (1 / Math.max(rawDt, 1e-4) - fpsEMA) * 0.05;

  if (!paused || stepOnce) {
    for (let s = 0; s < SUBSTEPS; s++) sim.step(DT);
    stepOnce = false;
  }
  render();
  if (++statTick % 12 === 0) updateStats();
  requestAnimationFrame(frame);
}

loadPreset(currentPreset);
updateStats();
requestAnimationFrame(frame);
