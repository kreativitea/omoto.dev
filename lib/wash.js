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

/**
 * Each palette is a wash and two opaque colours.
 *
 * `wash` is the wet part — pigment in a lot of water, laid down at low
 * opacity and multiplied into the paper. Those four are deliberately in
 * tension: a cool field wants a warm one somewhere behind it, or the whole
 * figure sits at one temperature and reads as a stain.
 *
 * `ink` and `accent` are the dry part, and they are the reason the figures
 * have any depth at all. A wash has no value range of its own — every pool is
 * some polite middle grey once it hits cream paper — so the drawing needs one
 * shape at full darkness and one at full chroma to measure itself against.
 * Ink cuts the horizon; accent is the single loud mark per figure.
 */
const PALETTES = {
  indigo: { wash: ['#6d93bd', '#8f7fae', '#7fa88c', '#cf9a52'], ink: '#1d3b5c', accent: '#c2452f' },
  sakura: { wash: ['#dd8b98', '#b79fd0', '#d8a05e', '#8bb59b'], ink: '#5c2740', accent: '#bf6420' },
  matcha: { wash: ['#7fae8b', '#5fa79c', '#cfa15e', '#a98fc0'], ink: '#245049', accent: '#c2452f' },
  ochre:  { wash: ['#d19a55', '#c1804f', '#a98fc0', '#6d93bd'], ink: '#4a3520', accent: '#1d3b5c' },
  sumi:   { wash: ['#8a949c', '#6d93bd', '#a39a8e', '#7fa88c'], ink: '#2b2926', accent: '#c2452f' },
};

/** Falls back rather than throwing: a typo in front matter should cost a
 *  colour scheme, not the build. */
function paletteOf(name) {
  return PALETTES[name] || PALETTES.indigo;
}

/** Darken a hex colour — used for the pooled edge, which is the same
 *  pigment concentrated where the water retreated. */
function darken(hex, factor = 0.68) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Blend a hex colour toward another by `t`. Used to push the far ridge toward
 *  the paper: aerial perspective, the cheapest depth cue there is — distance
 *  reads as loss of contrast long before it reads as loss of detail. */
function mix(hex, toward, t) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(toward.slice(1), 16);
  const ch = (sh) => Math.round((((a >> sh) & 255) * (1 - t)) + (((b >> sh) & 255) * t));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
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

/**
 * A hard-edged band of torn paper: a ragged top edge left to right, a
 * shallower ragged underside back again.
 *
 * Straight segments only, and no blur anywhere near it. Everything else in
 * these figures is wet and soft, which is exactly why this has to be neither:
 * a wash surrounded by more wash has no scale and nothing to be pale against,
 * and the eye gives up on it. One flat shape at full value fixes that.
 *
 * Two earlier passes closed this shape down to the bottom of the canvas
 * instead — a silhouette rather than a band — and both times the figure
 * turned into a picture of some hills. A shape with ground under it is
 * scenery and invites you to read it as a place; a strip with paper showing
 * on both sides stays a mark on a sheet, which is what this site is. It also
 * puts a second torn edge in play, and the torn edge is the whole reason the
 * shape does not look like a bar chart.
 *
 * Segments are asymmetric by construction — each high point sits somewhere in
 * the first two thirds of its span rather than the middle — because evenly
 * spaced peaks read as a sawtooth pattern instead of as a tear.
 */
function bandPath(rand, x0, x1, topY, amp, peaks, thick) {
  const span = (x1 - x0) / peaks;
  let d = `M${x0.toFixed(1)} ${topY.toFixed(1)}`;

  for (let i = 0; i < peaks; i++) {
    const bx = x0 + span * i;
    const px = bx + span * (0.22 + rand() * 0.46);
    const py = topY - amp * (0.3 + rand() * 0.7);
    const vy = topY - amp * rand() * 0.25;   // the notch between this rise and the next
    d += `L${px.toFixed(1)} ${py.toFixed(1)}L${(bx + span).toFixed(1)} ${vy.toFixed(1)}`;
  }

  // Back along the underside. Much shallower: a torn strip is ragged where it
  // was pulled apart and comparatively flat where it was cut.
  const botY = topY + thick;
  for (let i = peaks; i > 0; i--) {
    const bx = x0 + span * i;
    d += `L${(bx - span * 0.5).toFixed(1)} ${(botY + amp * 0.14 * rand()).toFixed(1)}` +
         `L${(bx - span).toFixed(1)} ${(botY - amp * 0.12 * rand()).toFixed(1)}`;
  }
  return `${d}Z`;
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
  const pal = paletteOf(palette);
  const colors = pal.wash;

  // Filter ids must be unique per figure, or a second figure on the same page
  // silently inherits the first one's warp.
  const uid = s.toString(36);
  const fa = `wa-${uid}`, fb = `wb-${uid}`, fc = `wc-${uid}`, ft = `wt-${uid}`;

  const defs = [
    washFilter(fa, s % 500, 0.026, 17, 0.7, 0.4, 0.28),
    washFilter(fb, (s + 91) % 500, 0.032, 13, 1.5, 0.45, 0.24),
    // the bloom filter needs no grain — it is water, not pigment
    `<filter id="${fc}" x="-22%" y="-28%" width="144%" height="156%">
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="${(s + 13) % 500}" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="10" xChannelSelector="R" yChannelSelector="G"/>
  <feGaussianBlur stdDeviation="2.6"/>
</filter>`,
    // Torn edge for the flat shapes. Displacement but no blur: these are the
    // only hard edges in the figure and blurring them would forfeit the whole
    // point of drawing them. The warp just keeps them off their own geometry,
    // so they read as cut paper rather than as a chart.
    // Frequency matters more than scale here. Low frequency bends a straight
    // edge into a smooth curve, which reads as vector geometry that has been
    // nudged; it takes wobble at roughly the scale of a paper fibre before the
    // eye calls the edge torn.
    `<filter id="${ft}" x="-8%" y="-10%" width="116%" height="122%">
  <feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="3" seed="${(s + 43) % 500}" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="4.5" xChannelSelector="R" yChannelSelector="G"/>
</filter>`,
  ].join('\n');

  // Three or four overlapping pools, spread across the canvas so they overlap
  // at the edges rather than stacking into one muddy centre. They sit high:
  // the ridges take the bottom third, and pigment pooling *below* a horizon
  // reads as a stain on the paper rather than as weather above the land.
  const count = 3 + Math.round(rand());
  const shapes = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const cx = w * (0.18 + t * 0.62) + (rand() - 0.5) * w * 0.08;
    const cy = h * (0.34 + (rand() - 0.5) * 0.26);
    const rx = w * (0.13 + rand() * 0.07);
    const ry = h * (0.2 + rand() * 0.12);
    shapes.push({
      d: blobPath(rand, cx, cy, rx, ry, 7 + Math.round(rand() * 2), 0.24 + rand() * 0.1),
      color: colors[i % colors.length],
      filter: i % 2 === 0 ? fa : fb,
      // Heavier than a true watercolour would be. The paper is cream and the
      // wash multiplies into it, so anything under about a third disappears
      // into the ground the moment it leaves a calibrated monitor.
      opacity: (0.34 + rand() * 0.16).toFixed(2),
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

  /* ------------------------------------------------------- the dry part */

  // The disc. One shape at full chroma, hard-edged, the only thing in the
  // figure that is not diluted — this is the note the whole palette is tuned
  // around. Placed off-centre and on the opposite side from the heaviest
  // pool, so it never ends up buried under pigment.
  const heavy = shapes.reduce((a, b) => (a.cx > b.cx ? a : b));
  const discX = heavy.cx > w * 0.5 ? w * (0.2 + rand() * 0.12) : w * (0.68 + rand() * 0.12);
  const discY = h * (0.22 + rand() * 0.12);
  const discR = h * (0.055 + rand() * 0.04);
  const disc = `  <circle cx="${discX.toFixed(0)}" cy="${discY.toFixed(0)}" r="${discR.toFixed(0)}"` +
    ` fill="${pal.accent}" opacity=".88" filter="url(#${ft})"/>`;

  // Two torn bands. They start and end at different places and neither runs
  // the full width — laid down by hand, one after the other, not printed in a
  // single pass. The far one is pushed most of the way to the paper and sits
  // higher; the near one is nearly black and sits lower. That inversion,
  // distant things paler, is the whole depth budget and it is enough.
  const far = bandPath(rand,
    w * (-0.02 + rand() * 0.06), w * (0.94 + rand() * 0.08),
    h * (0.72 + rand() * 0.05), h * (0.10 + rand() * 0.07),
    3 + Math.round(rand() * 2), h * (0.06 + rand() * 0.04));
  const near = bandPath(rand,
    w * (-0.04 + rand() * 0.07), w * (0.9 + rand() * 0.12),
    h * (0.85 + rand() * 0.04), h * (0.06 + rand() * 0.05),
    4 + Math.round(rand() * 3), h * (0.07 + rand() * 0.05));
  // A degree or so of tilt each, in opposite directions. Two torn strips lying
  // exactly parallel read as ruled lines no matter how ragged their edges are;
  // the skew is what says they were put down by hand, and it is the same
  // argument as the seal being stamped off true.
  const tilt = (0.7 + rand() * 1.1).toFixed(2);
  const bands =
    `  <path d="${far}" fill="${mix(pal.ink, '#faf7f1', 0.62)}" opacity=".9" filter="url(#${ft})"` +
    ` transform="rotate(-${tilt} ${(w / 2).toFixed(0)} ${(h * 0.75).toFixed(0)})"/>\n` +
    `  <path d="${near}" fill="${pal.ink}" opacity=".92" filter="url(#${ft})"` +
    ` transform="rotate(${(rand() * 0.9 + 0.4).toFixed(2)} ${(w / 2).toFixed(0)} ${(h * 0.88).toFixed(0)})"/>`;

  // Only the wet part drifts. If the ridges drifted with it the figure would
  // just sway; holding them still is what turns the movement into colour
  // slipping out of register with the drawing.
  return `<svg class="wash" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="presentation" aria-hidden="true">
  <defs>
${defs}
  </defs>
  <g class="swim">
    <g style="mix-blend-mode:multiply">
${paint}
    </g>
${edges}
${bloom}
${sheen}
  </g>
${disc}
${bands}
</svg>`;
}

/**
 * A single small dab — used as a category/entry marker in lists, where a full
 * figure would be far too much paint (and far too many live filters).
 */
export function washDab(seed, palette = 'indigo', size = 22) {
  const s = hashSeed(seed);
  const rand = rng(s);
  const pal = paletteOf(palette);
  const uid = s.toString(36);
  const f = `wd-${uid}`;
  const c = pal.wash[Math.floor(rand() * pal.wash.length)];
  const r = size * 0.36;

  // No boil and no drift here. There are one of these per entry in the index,
  // and animating a column of them would turn a list of essays into a screen
  // of twitching confetti. A dab earns its life from the accent speck instead
  // — the same loud colour as the figure it stands in for, at full strength,
  // which is enough to keep it from reading as a bullet point.
  return `<svg class="dab" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="presentation" aria-hidden="true">
  <defs><filter id="${f}" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" seed="${s % 500}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="0.4"/>
  </filter></defs>
  <g style="mix-blend-mode:multiply">
    <path d="${blobPath(rand, size / 2, size / 2, r, r * 0.92, 7, 0.2)}" fill="${c}" opacity="0.62" filter="url(#${f})"/>
    <path d="${blobPath(rand, size / 2 + 1, size / 2 + 1, r * 0.6, r * 0.55, 6, 0.22)}" fill="${darken(c, 0.8)}" opacity="0.45" filter="url(#${f})"/>
  </g>
  <circle cx="${(size * (0.36 + rand() * 0.2)).toFixed(1)}" cy="${(size * (0.34 + rand() * 0.18)).toFixed(1)}"
          r="${(size * 0.1).toFixed(1)}" fill="${pal.accent}" opacity=".8" filter="url(#${f})"/>
</svg>`;
}

export { PALETTES };
