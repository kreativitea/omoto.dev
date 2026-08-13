/**
 * Procedural watercolour.
 *
 * Every illustration on the site is generated from a seed string in a post's
 * front matter — no image assets, no pipeline, and the same seed always gives
 * the same painting.
 *
 * A wash only reads as *wet* if four things are true, and all four are here:
 *   1. the shape is warped off its own geometry (feDisplacementMap)
 *   2. pigment pools darker at the edge  (the same path, stroked and blurred)
 *   3. the pigment granulates inside the shape's own alpha
 *   4. light glints off the surface      (a screen-blended highlight)
 *
 * Two hard-won constraints, see memory/svg-watercolor-technique.md:
 *   - Granulation must live INSIDE the wash filter. A separate overlay layer
 *     shows up as a visible grey rectangle around the figure.
 *   - Keep grain at numOctaves 2 and filter regions tight. High-frequency
 *     turbulence over a large region makes Chromium silently fail to
 *     rasterise — the area paints blank while the DOM is laid out fine.
 */

/* ---------------------------------------------------------------- seeding */

/** FNV-1a — turns a front-matter seed string into a 32-bit integer. */
function hashSeed(input) {
  const str = String(input);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------------------------------------------- palettes */

const PALETTES = {
  indigo: ['#8fa9c4', '#b9a7c4', '#a8bfa8', '#d3b48d'],
  sakura: ['#e2a9b0', '#c9bcd8', '#d3b48d', '#a8bfa8'],
  matcha: ['#a8bfa8', '#8fbfb4', '#d3b48d', '#b9a7c4'],
  ochre:  ['#d3b48d', '#c9a98a', '#b9a7c4', '#8fa9c4'],
  sumi:   ['#9aa2a8', '#8fa9c4', '#b0aaa2', '#a8bfa8'],
};

/** Darken a hex colour — used for the pooled edge, which is the same
 *  pigment concentrated where the water retreated. */
function darken(hex, factor = 0.68) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/* ----------------------------------------------------------------- shapes */

/**
 * A closed, smooth blob. Points are scattered around an ellipse with seeded
 * radial jitter, then joined with Catmull-Rom converted to cubic Béziers so
 * the outline stays continuous rather than faceting into a polygon.
 */
function blobPath(rand, cx, cy, rx, ry, lobes = 7, wobble = 0.26) {
  const pts = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const k = 1 + (rand() * 2 - 1) * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }

  const n = pts.length;
  const at = (i) => pts[(i % n + n) % n];
  let d = `M${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;

  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)},` +
         ` ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

/* ---------------------------------------------------------------- filters */

/**
 * One wash filter. `warpFreq`/`warpScale` must be matched to the figure's
 * size: low frequency with a large scale makes the shape facet into a polygon,
 * which is the single most common way this effect goes wrong.
 */
function washFilter(id, seed, warpFreq, warpScale, blur, grainFreq, grainSlope) {
  return `<filter id="${id}" x="-22%" y="-28%" width="144%" height="156%">
  <feTurbulence type="fractalNoise" baseFrequency="${warpFreq}" numOctaves="4" seed="${seed}" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="${warpScale}" xChannelSelector="R" yChannelSelector="G"/>
  <feGaussianBlur stdDeviation="${blur}" result="shape"/>
  <feTurbulence type="fractalNoise" baseFrequency="${grainFreq}" numOctaves="2" seed="${seed + 7}" result="grain"/>
  <feColorMatrix in="grain" type="saturate" values="0" result="grey"/>
  <feComponentTransfer in="grey" result="soft">
    <feFuncR type="linear" slope="${grainSlope}" intercept="${(1 - grainSlope).toFixed(2)}"/>
    <feFuncG type="linear" slope="${grainSlope}" intercept="${(1 - grainSlope).toFixed(2)}"/>
    <feFuncB type="linear" slope="${grainSlope}" intercept="${(1 - grainSlope).toFixed(2)}"/>
  </feComponentTransfer>
  <feComposite in="soft" in2="shape" operator="in" result="grainIn"/>
  <feBlend in="shape" in2="grainIn" mode="multiply"/>
</filter>`;
}

/* -------------------------------------------------------------- the wash  */

/**
 * Full-width figure for the head of a post.
 * @param {string} seed     any string; same seed → same painting
 * @param {string} palette  key of PALETTES
 */
export function washFigure(seed, palette = 'indigo', w = 640, h = 250) {
  const s = hashSeed(seed);
  const rand = rng(s);
  const colors = PALETTES[palette] || PALETTES.indigo;

  // Filter ids must be unique per figure, or a second figure on the same page
  // silently inherits the first one's warp.
  const uid = s.toString(36);
  const fa = `wa-${uid}`, fb = `wb-${uid}`, fc = `wc-${uid}`;

  const defs = [
    washFilter(fa, s % 500, 0.026, 17, 0.7, 0.4, 0.28),
    washFilter(fb, (s + 91) % 500, 0.032, 13, 1.5, 0.45, 0.24),
    // the bloom filter needs no grain — it is water, not pigment
    `<filter id="${fc}" x="-22%" y="-28%" width="144%" height="156%">
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="${(s + 13) % 500}" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="10" xChannelSelector="R" yChannelSelector="G"/>
  <feGaussianBlur stdDeviation="2.6"/>
</filter>`,
  ].join('\n');

  // Three or four overlapping pools, spread across the canvas so they overlap
  // at the edges rather than stacking into one muddy centre.
  const count = 3 + Math.round(rand());
  const shapes = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const cx = w * (0.18 + t * 0.62) + (rand() - 0.5) * w * 0.08;
    const cy = h * (0.42 + (rand() - 0.5) * 0.3);
    const rx = w * (0.13 + rand() * 0.07);
    const ry = h * (0.2 + rand() * 0.12);
    shapes.push({
      d: blobPath(rand, cx, cy, rx, ry, 7 + Math.round(rand() * 2), 0.24 + rand() * 0.1),
      color: colors[i % colors.length],
      filter: i % 2 === 0 ? fa : fb,
      opacity: (0.26 + rand() * 0.14).toFixed(2),
      cx, cy, rx, ry,
    });
  }

  const paint = shapes
    .map((p) => `    <path d="${p.d}" fill="${p.color}" opacity="${p.opacity}" filter="url(#${p.filter})"/>`)
    .join('\n');

  // Pooled edges on the two largest pools — the strongest "still wet" cue.
  const edges = [...shapes]
    .sort((a, b) => b.rx * b.ry - a.rx * a.ry)
    .slice(0, 2)
    .map((p) => `  <path d="${p.d}" fill="none" stroke="${darken(p.color)}" stroke-width="${(2.6 + rand() * 1.6).toFixed(1)}"` +
                ` opacity="${(0.3 + rand() * 0.14).toFixed(2)}" filter="url(#${p.filter})" style="mix-blend-mode:multiply"/>`)
    .join('\n');

  // A backrun: water pushing pigment outward, leaving a pale bloom.
  const b = shapes[0];
  const bloom = `  <ellipse cx="${(b.cx + b.rx * 0.2).toFixed(0)}" cy="${(b.cy - b.ry * 0.3).toFixed(0)}"` +
    ` rx="${(b.rx * 0.5).toFixed(0)}" ry="${(b.ry * 0.4).toFixed(0)}"` +
    ` fill="var(--paper)" opacity="0.5" filter="url(#${fc})"/>`;

  // Sheen — wet paint catching the light.
  const sheen = shapes
    .slice(0, 2)
    .map((p, i) => `  <ellipse cx="${(p.cx - p.rx * 0.3).toFixed(0)}" cy="${(p.cy - p.ry * 0.7).toFixed(0)}"` +
      ` rx="${(p.rx * 0.5).toFixed(0)}" ry="${(p.ry * 0.22).toFixed(0)}" fill="#fff"` +
      ` opacity="${i === 0 ? '0.38' : '0.26'}" style="mix-blend-mode:screen"/>`)
    .join('\n');

  return `<svg class="wash" viewBox="0 0 ${w} ${h}" role="presentation" aria-hidden="true">
  <defs>
${defs}
  </defs>
  <g style="mix-blend-mode:multiply">
${paint}
  </g>
${edges}
${bloom}
${sheen}
</svg>`;
}

/**
 * A single small dab — used as a category/entry marker in lists, where a full
 * figure would be far too much paint (and far too many live filters).
 */
export function washDab(seed, palette = 'indigo', size = 22) {
  const s = hashSeed(seed);
  const rand = rng(s);
  const colors = PALETTES[palette] || PALETTES.indigo;
  const uid = s.toString(36);
  const f = `wd-${uid}`;
  const c = colors[Math.floor(rand() * colors.length)];
  const r = size * 0.36;

  return `<svg class="dab" viewBox="0 0 ${size} ${size}" role="presentation" aria-hidden="true">
  <defs><filter id="${f}" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" seed="${s % 500}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="0.4"/>
  </filter></defs>
  <g style="mix-blend-mode:multiply">
    <path d="${blobPath(rand, size / 2, size / 2, r, r * 0.92, 7, 0.2)}" fill="${c}" opacity="0.55" filter="url(#${f})"/>
    <path d="${blobPath(rand, size / 2 + 1, size / 2 + 1, r * 0.6, r * 0.55, 6, 0.22)}" fill="${darken(c, 0.8)}" opacity="0.4" filter="url(#${f})"/>
  </g>
</svg>`;
}

export { PALETTES };
