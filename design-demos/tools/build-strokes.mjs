import { readFileSync, writeFileSync } from 'node:fs';
import { renderAll } from './strokes.mjs';

// Resolved from this file, not the cwd, so the script runs from anywhere.
const ROOT = new URL('../../', import.meta.url);
const css = readFileSync(new URL('src/assets/css/site.css', ROOT), 'utf8');
const opts = renderAll();

const rows = opts.map((o) => `
  <section class="opt" id="${o.id}">
    <div class="meta">
      <span class="num">${String(o.index).padStart(2, '0')}</span>
      <h2>${o.name}</h2>
      <p>${o.note}</p>
    </div>
    <div class="mark">
      <h3 class="wordmark">Michael <span class="mid">Toshiro</span> Omoto</h3>
      ${o.svg}
    </div>
  </section>`).join('\n');

writeFileSync(new URL('design-demos/10-stroke-studies.html', ROOT), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>masthead stroke studies</title>
<style>
${css}
body{padding:0}
/* Compact on purpose: all eleven have to sit in one viewport. Heavy SVG
   filters on this site fail to rasterise at scroll offsets — the region paints
   blank while the DOM lays out fine — so a page that must be scrolled to be
   seen cannot be screenshotted honestly. */
.sheet{max-width:58rem;margin:0 auto;padding:1.6rem 2rem 2rem}
.sheet > h1{font-family:var(--sans);font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;
  color:var(--faint);font-weight:400;margin:0 0 .4rem}
.sheet > .intro{color:var(--ink-soft);font-size:.84rem;max-width:38rem;margin:0 0 1.4rem;line-height:1.6}
.opt{display:grid;grid-template-columns:13.5rem 1fr;gap:2rem;padding:.85rem 0;align-items:center;
  border-top:1px solid var(--hairline)}
.opt .num{font-family:var(--sans);font-size:.62rem;letter-spacing:.16em;color:var(--faint);display:block}
.opt h2{font-size:.94rem;font-weight:400;margin:.15rem 0 .25rem;line-height:1.3}
.opt .meta p{margin:0;color:var(--ink-soft);font-size:.76rem;line-height:1.5}
.opt .mark{min-width:0}
.opt .wordmark{font-size:1.3rem;margin:0;font-weight:400;letter-spacing:.05em}
/* The overshoot. A hand-drawn underline starts before the first letter and
   finishes after the last, because it is aimed at the word rather than at the
   word's bounding box. Starting flush with the M — or, as these did, a little
   to its right — is what made the mark read as a rule sitting near the name
   instead of a line drawn under it. */
.opt .brush{width:100%;max-width:440px;height:auto;margin:.15rem 0 0 -.75rem}
@media (max-width:800px){.opt{grid-template-columns:1fr;gap:.6rem}}
</style>
</head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${opts.map((o) => o.filterDef).join('\n')}
</defs></svg>
<div class="sheet">
  <h1>Masthead stroke — eleven studies</h1>
  <p class="intro">Each shown at the size it runs on the site, under the wordmark it sits beneath.
  00 is what ships today. Everything below it is built from a centreline, a pressure profile and
  lengthwise kasure, rather than a hand-fitted outline.</p>
${rows}
</div>
</body></html>`);

console.log(`wrote design-demos/10-stroke-studies.html — ${opts.length} options`);
