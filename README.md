# OrbitalSim

An N-body gravity simulation playground — vanilla JS + canvas, no build step.

## Features

- **Click-drag to launch bodies**: press on empty space, drag, release — the drag vector becomes the launch velocity (arrow preview included)
- **Presets**: Binary Star (circumbinary planets), Solar System (star + 7 planets + 260-body asteroid belt), Random Chaos (1200-particle rotating disk)
- **Trail rendering** via a persistent offscreen canvas with exponential fade
- **Collision merging**: overlapping bodies merge conserving momentum and mass
- **Mass slider** for new bodies (1 – ~5000, logarithmic)
- **Pause / Step / Reset** (Space / Period / R)
- **Velocity-Verlet integration** with Plummer softening, fixed 1/120s substeps
- **60fps with 1000+ bodies**: flat typed arrays, symmetric O(n²) pair loop, capacity doubling

## Run

Any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

- `index.html` — layout + control panel
- `style.css` — dark HUD theme
- `physics.js` — `Simulation` class: Verlet integrator, softened gravity, collision merges
- `app.js` — canvas rendering, presets, input, main loop
