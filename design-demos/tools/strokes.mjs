/**
 * Masthead stroke studies.
 *
 * The current mark is a hand-authored outline, which is why it reads a little
 * flat: its edges are two smooth curves, and a brush edge is not smooth. Here
 * a stroke is built the way one is actually made — a centreline, a pressure
 * profile along it, and the paper showing through where the ink ran out — so
 * each option is a few parameters rather than a hand-fitted bezier.
 *
 * Everything is deterministic: same seed, same stroke, every build.
 */

const W = 440, H = 26;

/* ------------------------------------------------------------- seeded rng */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise in [-1,1]. The wobble that keeps a brush edge from
 *  looking like a curve someone drew with a mouse. */
function noise1(seed, n = 14) {
  const r = rng(seed);
  const pts = Array.from({ length: n }, () => r() * 2 - 1);
  return (t) => {
    const x = Math.max(0, Math.min(0.9999, t)) * (n - 1);
    const i = Math.floor(x), f = x - i;
    const s = f * f * (3 - 2 * f);                 // smoothstep
    return pts[i] * (1 - s) + pts[Math.min(n - 1, i + 1)] * s;
  };
}

/* ------------------------------------------------------------- centreline */

const cubic = (p0, p1, p2, p3) => (t) => {
  const u = 1 - t;
  return [
    u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
  ];
};

/** Unit normal at t, by finite difference — accurate enough at this scale and
 *  far less code than differentiating the bezier. */
function normalAt(curve, t) {
  const e = 0.0015;
  const [x1, y1] = curve(Math.max(0, t - e));
  const [x2, y2] = curve(Math.min(1, t + e));
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

/**
 * The outline: forward along one side, back along the other.
 *
 * Sampled as a polyline rather than fitted to beziers. At 440px wide with a
 * displacement filter over the top, nobody can see the facets — and fitting
 * would add a lot of code to hide something already hidden.
 */
function outline(curve, widthFn, n = 150) {
  const a = [], b = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = curve(t);
    const [nx, ny] = normalAt(curve, t);
    const w = Math.max(0, widthFn(t)) / 2;
    a.push([x + nx * w, y + ny * w]);
    b.push([x - nx * w, y - ny * w]);
  }
  const fmt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return `M${a.map(fmt).join('L')}L${b.reverse().map(fmt).join('L')}Z`;
}

/** A line running ALONG the stroke at some fraction of its half-width. This is
 *  what kasure actually looks like: the brush splits lengthwise into bristles,
 *  so the gaps run with the stroke, never across it. */
function streak(curve, widthFn, frac, t0, t1, n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * (i / n);
    const [x, y] = curve(t);
    const [nx, ny] = normalAt(curve, t);
    const w = widthFn(t) / 2;
    pts.push(`${(x + nx * w * frac).toFixed(1)} ${(y + ny * w * frac).toFixed(1)}`);
  }
  return `M${pts.join('L')}`;
}

/* ------------------------------------------------------- pressure profiles */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** ramp up over `inLen`, hold, ramp down over `outLen` */
const ease = (t, inLen, outLen) =>
  Math.min(inLen ? clamp01(t / inLen) : 1, outLen ? clamp01((1 - t) / outLen) : 1);

/* ------------------------------------------------------------- the options */

const OPTIONS = [
  {
    id: 'current',
    name: 'Current',
    note: 'What the masthead ships today, for comparison.',
    raw: `<path d="M8 12 C 80 4.6, 170 9.6, 250 11.6 C 320 13.4, 380 10.6, 424 8.6
             C 430 8.3, 434 9.2, 436 10.6
             L 433 17.6 C 427 19.2, 417 20, 405 19.6 C 365 18.2, 315 21.6, 245 19.6
             C 165 17.4, 77 20.6, 8 18.6 Z" fill="currentColor"/>
      <path d="M120 13 C 200 8, 300 16, 400 11" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".3"/>
      <g stroke="var(--paper)" fill="none">
        <path d="M320 14 H 436" stroke-width="1.5" stroke-dasharray="10 4 2 7 2 11"/>
        <path d="M352 16.4 H 434" stroke-width="1.3" stroke-dasharray="6 5 3 8"/>
        <path d="M386 18.4 H 432" stroke-width="1.1" stroke-dasharray="4 6 2 5"/>
        <path d="M56 15 H 148" stroke-width=".9" stroke-dasharray="17 33" opacity=".55"/>
      </g>`,
    filter: { freq: '.055 .012', oct: 4, seed: 5, scale: 4.5 },
  },

  {
    id: 'tucked',
    name: 'Tucked entry, lifted exit',
    note: 'The textbook 一: the tip is tucked back on itself at the start, swells through the middle, and lifts to a point. The most "written" of the set.',
    seed: 11,
    curve: cubic([14, 15.5], [140, 9], [300, 12], [428, 8.5]),
    width: (t, n) => (2.2 + 9.4 * Math.sin(Math.PI * Math.pow(clamp01(t), 0.62)) ** 0.9) * (1 + 0.1 * n(t)),
    kasure: [{ frac: 0.45, t0: 0.62, t1: 0.99, w: 1.4, dash: '9 5 3 8 2 12' },
             { frac: -0.3, t0: 0.72, t1: 0.99, w: 1.1, dash: '5 6 3 9' }],
    filter: { freq: '.06 .014', oct: 4, seed: 5, scale: 3.6 },
  },

  {
    id: 'heavy-head',
    name: 'Heavy head, dry tail',
    note: 'Lands loaded and leaves dry. Most of the ink is spent in the first third, so the tail is more paper than pigment.',
    seed: 23,
    curve: cubic([12, 13], [130, 10], [310, 13.5], [430, 10]),
    width: (t, n) => (12.5 * Math.pow(1 - clamp01(t), 1.5) + 1.6) * (1 + 0.13 * n(t)),
    kasure: [{ frac: 0.4, t0: 0.3, t1: 1, w: 1.5, dash: '4 5 2 7 6 4' },
             { frac: 0, t0: 0.45, t1: 1, w: 1.2, dash: '3 6 5 4' },
             { frac: -0.45, t0: 0.38, t1: 1, w: 1.3, dash: '6 4 2 9' }],
    filter: { freq: '.07 .016', oct: 4, seed: 41, scale: 4.4 },
  },

  {
    id: 'split-tail',
    name: 'Split tail',
    note: 'The bristles separate as the brush lifts and the mark ends in three prongs. Reads fast.',
    seed: 37,
    curve: cubic([14, 14], [150, 9.5], [300, 12.5], [400, 10.5]),
    width: (t, n) => (2 + 9 * Math.sin(Math.PI * Math.pow(clamp01(t), 0.7))) * (1 + 0.1 * n(t)),
    // Starting the fork earlier and spreading it wider — at 440px a prong that
    // splits in the last tenth of the stroke is indistinguishable from a frayed
    // edge, which the filter is already providing.
    prongs: [{ from: 0.72, dy: -4.2, len: 76, w: 2.6 },
             { from: 0.74, dy: 0.6, len: 88, w: 3.0 },
             { from: 0.73, dy: 4.6, len: 62, w: 2.1 }],
    kasure: [{ frac: 0.4, t0: 0.55, t1: 0.99, w: 1.3, dash: '7 5 3 8' }],
    filter: { freq: '.065 .015', oct: 4, seed: 77, scale: 3.8 },
  },

  {
    id: 'rising',
    name: 'Rising (右上がり)',
    note: 'The lift to the right that a hand naturally puts into a horizontal stroke. Thin, thick, thin, on a clear diagonal.',
    seed: 53,
    curve: cubic([12, 19], [140, 14], [300, 9], [430, 5.5]),
    width: (t, n) => (2 + 8.6 * Math.sin(Math.PI * clamp01(t)) ** 0.8) * (1 + 0.12 * n(t)),
    kasure: [{ frac: 0.35, t0: 0.55, t1: 0.98, w: 1.3, dash: '8 5 3 9' },
             { frac: -0.4, t0: 0.65, t1: 0.98, w: 1.1, dash: '5 7 2 8' }],
    filter: { freq: '.058 .013', oct: 4, seed: 13, scale: 3.9 },
  },

  {
    id: 'flying-white',
    name: 'Flying white (飛白)',
    note: 'Ink starved the whole way, not just at the end. The paper runs through the middle of the mark in long lengthwise gaps.',
    seed: 67,
    curve: cubic([10, 13.5], [130, 10.5], [310, 13], [432, 10]),
    width: (t, n) => (3 + 8 * Math.sin(Math.PI * clamp01(t)) ** 0.5) * (1 + 0.16 * n(t)),
    kasure: [{ frac: 0.55, t0: 0.06, t1: 0.99, w: 1.7, dash: '13 6 4 9 7 5' },
             { frac: 0.15, t0: 0.02, t1: 0.99, w: 1.5, dash: '9 7 16 5' },
             { frac: -0.25, t0: 0.1, t1: 0.99, w: 1.6, dash: '6 8 11 6' },
             { frac: -0.6, t0: 0.04, t1: 0.99, w: 1.3, dash: '15 5 5 10' }],
    filter: { freq: '.075 .018', oct: 4, seed: 91, scale: 4.2 },
  },

  {
    id: 'pressed',
    name: 'Pressed stop (蔵鋒)',
    note: 'Blunt at both ends, weight held even across the whole length. The most formal and the quietest.',
    seed: 89,
    curve: cubic([16, 13.5], [140, 11], [300, 13], [424, 11]),
    width: (t, n) => (9.4 * ease(t, 0.06, 0.05)) * (1 + 0.09 * n(t)),
    kasure: [{ frac: 0.3, t0: 0.7, t1: 0.96, w: 1.2, dash: '5 7 3 10' }],
    filter: { freq: '.05 .011', oct: 4, seed: 29, scale: 3.2 },
  },

  {
    id: 'fast-dry',
    name: 'Fast and dry',
    note: 'Thin, quick and scratchy — more gesture than ink. Sits lightest under the wordmark.',
    seed: 101,
    curve: cubic([12, 15], [150, 10], [300, 13], [434, 9]),
    width: (t, n) => (1.6 + 4.4 * Math.sin(Math.PI * clamp01(t)) ** 0.7) * (1 + 0.22 * n(t)),
    kasure: [{ frac: 0.3, t0: 0.2, t1: 1, w: 1.1, dash: '10 6 3 8' },
             { frac: -0.35, t0: 0.35, t1: 1, w: 0.9, dash: '6 9 4 7' }],
    filter: { freq: '.09 .02', oct: 4, seed: 5, scale: 4.6 },
  },

  {
    id: 'wet',
    name: 'Loaded and wet',
    note: 'A full brush: fat, saturated, almost no dry break. Pools slightly where it slows.',
    seed: 127,
    curve: cubic([12, 13], [140, 10], [300, 13.5], [430, 10.5]),
    // A symmetric profile with little noise came out as a smooth lens — read as
    // vector geometry rather than as ink. A wet stroke is still made by a hand:
    // it needs an off-centre bulge where the brush slowed and enough edge
    // wobble to stop the outline resolving into an arc.
    width: (t, n) => (4 + 8.4 * Math.sin(Math.PI * clamp01(t) ** 1.22) ** 0.45) * (1 + 0.17 * n(t)),
    kasure: [{ frac: 0.5, t0: 0.86, t1: 0.99, w: 1.1, dash: '4 8' }],
    filter: { freq: '.045 .013', oct: 4, seed: 61, scale: 3.4 },
  },

  {
    id: 'side-brush',
    name: 'Side brush (側鋒)',
    note: 'Held at an angle, so one edge is clean and the other frays. Asymmetry is the whole idea.',
    seed: 149,
    curve: cubic([12, 12.5], [140, 10], [300, 13], [430, 10]),
    width: (t, n) => (3 + 8 * Math.sin(Math.PI * clamp01(t)) ** 0.6) * (1 + 0.1 * n(t)),
    lopsided: 0.72,
    kasure: [{ frac: -0.55, t0: 0.15, t1: 0.99, w: 1.6, dash: '8 5 3 7 2 9' },
             { frac: -0.8, t0: 0.3, t1: 0.99, w: 1.2, dash: '5 6 4 8' }],
    filter: { freq: '.068 .015', oct: 4, seed: 103, scale: 4.0 },
  },

  {
    id: 'doubled',
    name: 'Doubled back',
    note: 'Two passes, the second not quite on the first — a correction rather than a flourish. The most on-brief for a practice sheet.',
    seed: 173,
    curve: cubic([14, 12.5], [140, 9.5], [300, 12.5], [426, 9.5]),
    width: (t, n) => (2.4 + 7.6 * Math.sin(Math.PI * clamp01(t)) ** 0.75) * (1 + 0.11 * n(t)),
    second: { curve: cubic([40, 15.5], [160, 13], [300, 16], [400, 13.5]),
              width: (t, n) => (1.4 + 4.2 * Math.sin(Math.PI * clamp01(t)) ** 0.8) * (1 + 0.18 * n(t)),
              opacity: 0.55, seed: 174 },
    kasure: [{ frac: 0.4, t0: 0.6, t1: 0.99, w: 1.3, dash: '8 5 3 9' }],
    filter: { freq: '.062 .014', oct: 4, seed: 151, scale: 3.7 },
  },
];

/* ------------------------------------------------------------------ render */

/**
 * Global weight trim. The profiles were drawn to look right on their own and
 * came out lighter than the mark they replace, which made every option read
 * as a downgrade regardless of its character — texture needs body to sit in.
 * One factor here keeps the options in the same relation to each other, which
 * is the thing actually being chosen between.
 */
const WEIGHT = 1.26;

/**
 * Where the ink starts, in viewBox units.
 *
 * Each option was drawn with its own left inset, between 10 and 16, which is
 * why the mark read as sitting too far right — it began *after* the M rather
 * than before it, so it scanned as a rule the layout happened to place there
 * instead of as an underline someone drew beneath a name. Normalising them all
 * to the same lead-in makes the options differ only in the thing being chosen,
 * and the overshoot itself is CSS: see the negative margin on .brush, which
 * pulls the whole mark left of the wordmark's first letter.
 *
 * Overshooting is what hand underlining does. You start before the word and
 * finish after it, because you are aiming at the word, not at its bounding box.
 */
const LEAD_X = 1;

/**
 * Length is applied by stretching x only, never by scaling the whole mark.
 *
 * A longer stroke is a longer *travel of the same brush*, so its width must
 * stay in absolute units while its length grows — the mark gets proportionally
 * finer, exactly as it would on paper. Uniformly scaling the SVG instead would
 * fatten the stroke in step with its length and just produce a bigger version
 * of the same picture, which is not what a longer stroke looks like.
 */
function renderStroke(o, len, samples = 150) {
  if (o.raw) return o.raw;

  const k = len / W;
  const curve = (t) => { const [x, y] = o.curve(t); return [x * k, y]; };
  const n = noise1(o.seed);
  const widthFn = (t) => o.width(t, n) * WEIGHT;
  const parts = [];

  // A lopsided stroke puts most of its body on one side of the centreline —
  // the same trick as holding the brush over rather than upright.
  if (o.lopsided) {
    const shifted = (t) => {
      const [x, y] = curve(t);
      const [nx, ny] = normalAt(curve, t);
      const off = widthFn(t) * (o.lopsided - 0.5) * 0.5;
      return [x + nx * off, y + ny * off];
    };
    parts.push(`<path d="${outline(shifted, widthFn, samples)}" fill="currentColor"/>`);
  } else {
    parts.push(`<path d="${outline(curve, widthFn, samples)}" fill="currentColor"/>`);
  }

  for (const p of o.prongs || []) {
    const [bx, by] = curve(p.from);
    const L = p.len * k;                       // prongs travel with the stroke
    const tip = cubic([bx, by], [bx + L * 0.4, by + p.dy * 0.5],
                      [bx + L * 0.75, by + p.dy], [bx + L, by + p.dy * 1.25]);
    parts.push(`<path d="${outline(tip, (t) => p.w * (1 - t) ** 1.3, 40)}" fill="currentColor"/>`);
  }

  if (o.second) {
    const n2 = noise1(o.second.seed);
    const c2 = (t) => { const [x, y] = o.second.curve(t); return [x * k, y]; };
    parts.push(`<path d="${outline(c2, (t) => o.second.width(t, n2) * WEIGHT, samples)}" ` +
               `fill="currentColor" opacity="${o.second.opacity}"/>`);
  }

  if (o.kasure?.length) {
    // Dash lengths stay absolute, deliberately. SVG dasharrays are already in
    // user units and do not stretch with the path, and that is the correct
    // behaviour here: kasure gaps are set by how far apart the bristles are,
    // which is a property of the brush and not of how far it travelled. A
    // longer stroke should therefore show MORE gaps of the same size, not the
    // same number of longer ones — scaling them, as an earlier version did,
    // makes a long stroke read as a coarser, wetter brush instead of a faster
    // one.
    parts.push(`<g stroke="var(--paper)" fill="none" stroke-linecap="round">` +
      o.kasure.map((kk) =>
        `<path d="${streak(curve, widthFn, kk.frac, kk.t0, kk.t1, Math.round(samples * 0.4))}" ` +
        `stroke-width="${kk.w}" stroke-dasharray="${kk.dash}"/>`).join('') +
      `</g>`);
  }

  return parts.join('\n      ');
}

/** How far this option's ink starts from the left edge at this length, so it
 *  can be shifted to the shared lead-in. The current mark's outline opens at
 *  M8; the generated ones stretch with the mark. */
const startXOf = (o, len) => (o.raw ? 8 : o.curve(0)[0] * (len / W));

/** One option at one length. `idSuffix` keeps filter ids unique when the same
 *  option appears more than once on a page. */
export function render(o, len = W, idSuffix = '', samples = 150) {
  const fid = `f-${o.id}${idSuffix}`;
  return {
    ...o,
    len,
    svg: `<svg class="brush" width="${len}" height="${H}" viewBox="0 0 ${len} ${H}" aria-hidden="true">
      <g transform="translate(${(LEAD_X - startXOf(o, len)).toFixed(1)} 0)">
      <g style="mix-blend-mode:var(--wash-blend)" filter="url(#${fid})" opacity=".82">
      ${renderStroke(o, len, samples)}
      </g>
      </g>
    </svg>`,
    filterDef: `<filter id="${fid}" x="-20%" y="-70%" width="140%" height="240%">
      <feTurbulence type="fractalNoise" baseFrequency="${o.filter.freq}" numOctaves="${o.filter.oct}" seed="${o.filter.seed}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${o.filter.scale}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`,
  };
}

export function renderAll(len = W) {
  return OPTIONS.map((o, i) => ({ ...render(o, o.raw ? W : len), index: i }));
}

export { OPTIONS, W, H };
